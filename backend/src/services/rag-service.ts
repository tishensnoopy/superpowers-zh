import { generateEmbedding, chat, type ChatMessage } from './llm-service';
import { getActiveAiConfig } from './ai-config-service';

/**
 * Strapi instance injected via `setStrapi()`. Kept as a module-level singleton
 * (same pattern as src/workers/document-processor.ts) so the service functions
 * stay synchronous to call while still being injectable for tests.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let strapiInstance: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setStrapi(strapi: any): void {
  strapiInstance = strapi;
}

export interface RetrievedDoc {
  id: number;
  chunkText: string;
  knowledgeBaseId: number;
  similarity: number;
}

export interface RetrievalResult {
  docs: RetrievedDoc[];
  isRelevant: boolean;
  usedFallback: boolean;
}

export interface FeedbackFaqResult {
  documentId: string;
  id: number;
  [key: string]: unknown;
}

const MAX_HISTORY_MESSAGES = 10;

/**
 * Minimum cosine similarity for a chunk to be considered relevant. Chunks
 * below this threshold are filtered out before returning; when no chunk
 * reaches the threshold `isRelevant` is `false` so the chat controller can
 * fall back to human handoff ("guided mode").
 */
const SIMILARITY_THRESHOLD = 0.3;

export const SYSTEM_PROMPT_TEMPLATE = `你是佑森小课堂的AI客服助手。佑森小课堂是武汉的幼小衔接教育机构。
你的职责是回答家长关于课程、校区、预约、费用等问题。

【最高优先级规则——禁止编造】
1. 你只能使用下方"知识库内容"中的信息作答。
2. 知识库中没有的信息，一律回答"暂无该信息"，不得编造任何校区、课程、价格、政策、师资细节。
3. 检索结果与问题无关时，不得强行作答；如实说明并引导家长：转人工客服，或留下姓名电话预约回电。
4. 涉及费用、名额、开班时间等可能变动的信息，即使知识库中有，也建议家长致电确认。

知识库内容:
{retrieved_docs}

回答要求:
1. 语气亲切、专业
2. 回答简洁明了
3. 如实反映课程信息，不夸大`;

/**
 * Retrieve relevant knowledge-base chunks by locale.
 *
 * - When locale='en-US' and en-US hits < 2, automatically fallback to zh-CN
 *   and merge results. `usedFallback=true` indicates the merge happened.
 * - When locale='zh-CN' (default), no fallback.
 */
export async function retrieve(
  query: string,
  topK = 5,
  locale: 'zh-CN' | 'en-US' = 'zh-CN'
): Promise<RetrievalResult> {
  if (!query || query.trim().length === 0) {
    return { docs: [], isRelevant: false, usedFallback: false };
  }

  if (!strapiInstance) {
    throw new Error('Strapi instance not initialized. Call setStrapi() first.');
  }

  const { embedding } = await generateEmbedding(query);
  if (!embedding || embedding.length === 0) {
    return { docs: [], isRelevant: false, usedFallback: false };
  }

  const embeddingJson = JSON.stringify(embedding);

  const buildSql = () =>
    `SELECT ke.id, ke.chunk_text, ke.knowledge_base_id, 1 - (ke.embedding <=> ?::vector) as similarity
     FROM knowledge_embeddings ke
     JOIN knowledge_bases kb ON ke.knowledge_base_id = kb.id
     WHERE kb.status = 'ready' AND kb.locale = ?
     ORDER BY ke.embedding <=> ?::vector
     LIMIT ?`;

  const fetchByLocale = async (loc: 'zh-CN' | 'en-US'): Promise<RetrievedDoc[]> => {
    const result = await strapiInstance.db.connection.raw(buildSql(), [
      embeddingJson,
      loc,
      embeddingJson,
      topK,
    ]);
    // Knex returns { rows: [...] } for PostgreSQL and a plain array for SQLite.
    const rows: Array<Record<string, unknown>> = Array.isArray(result)
      ? result
      : result.rows || [];
    return rows
      .map((row) => ({
        id: Number(row.id),
        chunkText: String(row.chunk_text ?? ''),
        knowledgeBaseId: Number(row.knowledge_base_id),
        similarity: Number(row.similarity),
      }))
      .filter((doc) => doc.similarity >= SIMILARITY_THRESHOLD);
  };

  // Primary locale query
  const primaryDocs = await fetchByLocale(locale);

  // Fallback: en-US with < 2 hits → merge zh-CN results
  if (locale === 'en-US' && primaryDocs.length < 2) {
    const fallbackDocs = await fetchByLocale('zh-CN');
    const merged = [...primaryDocs, ...fallbackDocs].slice(0, topK);
    return {
      docs: merged,
      isRelevant: merged.length > 0,
      usedFallback: fallbackDocs.length > 0,
    };
  }

  return {
    docs: primaryDocs,
    isRelevant: primaryDocs.length > 0,
    usedFallback: false,
  };
}

async function buildSystemPrompt(
  retrievedDocs: RetrievedDoc[],
  locale: 'zh-CN' | 'en-US' = 'zh-CN'
): Promise<string> {
  let docsSection: string;
  if (retrievedDocs.length === 0) {
    docsSection = '（暂无相关知识库内容）';
  } else {
    docsSection = retrievedDocs
      .map((doc, index) => `[${index + 1}] ${doc.chunkText}`)
      .join('\n');
  }

  // 按 locale 选择 systemPrompt，fallback 链：
  //   en-US: config.systemPromptEn → config.systemPrompt → env AI_CHAT_SYSTEM_PROMPT → SYSTEM_PROMPT_TEMPLATE
  //   zh-CN: config.systemPrompt → env AI_CHAT_SYSTEM_PROMPT → SYSTEM_PROMPT_TEMPLATE
  if (strapiInstance) {
    try {
      const aiConfig = await getActiveAiConfig(strapiInstance);
      if (locale === 'en-US' && aiConfig?.systemPromptEn) {
        return aiConfig.systemPromptEn.replace('{retrieved_docs}', docsSection);
      }
      if (aiConfig?.systemPrompt) {
        return aiConfig.systemPrompt.replace('{retrieved_docs}', docsSection);
      }
    } catch (err) {
      console.warn('[rag-service] Failed to load ai-config systemPrompt, using default:', err instanceof Error ? err.message : err, err instanceof Error ? err.stack : '');
    }
  }

  return (process.env.AI_CHAT_SYSTEM_PROMPT || SYSTEM_PROMPT_TEMPLATE).replace('{retrieved_docs}', docsSection);
}

/**
 * Build a chat completion request from the retrieved context and recent
 * history, then return the assistant's answer.
 *
 * `locale` selects the system prompt language (en-US uses systemPromptEn when
 * available). `usedFallback` — when true alongside locale='en-US' — appends an
 * instruction to translate the answer to English, because the retrieved
 * context may contain Chinese chunks from the zh-CN fallback merge.
 */
export async function generateAnswer(
  query: string,
  retrievedDocs: RetrievedDoc[],
  history: ChatMessage[] = [],
  locale: 'zh-CN' | 'en-US' = 'zh-CN',
  usedFallback: boolean = false
): Promise<string> {
  let systemPrompt = await buildSystemPrompt(retrievedDocs, locale);

  // en-US fallback 时追加翻译指令（context 可能含中文 chunk）
  if (locale === 'en-US' && usedFallback) {
    systemPrompt += '\n\nNote: Some context is in Chinese. Translate the answer to English.';
  }

  const truncatedHistory = history.slice(-MAX_HISTORY_MESSAGES);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...truncatedHistory,
    { role: 'user', content: query },
  ];

  // 从 ai-config 读取 temperature/maxTokens，未配置时使用默认值
  let temperature = 0.3;
  let maxTokens = 2000;
  if (strapiInstance) {
    try {
      const aiConfig = await getActiveAiConfig(strapiInstance);
      if (aiConfig) {
        temperature = aiConfig.temperature ?? temperature;
        maxTokens = aiConfig.maxTokens ?? maxTokens;
      }
    } catch (err) {
      console.warn('[rag-service] Failed to load ai-config temperature/maxTokens, using defaults:', err instanceof Error ? err.message : err);
    }
  }

  const result = await chat(messages, { temperature, maxTokens });
  return result.content;
}

/**
 * Persist a chat feedback item as a pending FAQ for human review. The item is
 * linked back to the originating chat session via the sourceSession relation.
 */
export async function feedbackToFaq(
  question: string,
  answer: string,
  sessionDocumentId: string
): Promise<FeedbackFaqResult> {
  if (!strapiInstance) {
    throw new Error('Strapi instance not initialized. Call setStrapi() first.');
  }

  const created = await strapiInstance
    .documents('api::faq-item.faq-item')
    .create({
      data: {
        question,
        answer,
        sourceType: 'chat-feedback',
        reviewStatus: 'pending',
        sourceSession: sessionDocumentId,
      },
    });

  return created as FeedbackFaqResult;
}

export default {
  setStrapi,
  retrieve,
  generateAnswer,
  feedbackToFaq,
};
