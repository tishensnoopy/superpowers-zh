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

const SYSTEM_PROMPT_TEMPLATE = `你是佑森小课堂的AI客服助手。佑森小课堂是武汉的幼小衔接教育机构，有6大校区。
你的职责是回答家长关于课程、校区、预约、费用等问题。

请基于以下知识库内容回答问题。如果知识库中没有相关信息，请诚实告知并建议联系人工客服。

知识库内容:
{retrieved_docs}

回答要求:
1. 语气亲切、专业
2. 回答简洁明了
3. 如实反映课程信息，不夸大
4. 涉及具体费用、名额等可能变动的信息，建议家长致电确认`;

/**
 * Generate an embedding for the query and search the pgvector store for the
 * most similar knowledge-base chunks. Only chunks belonging to a knowledge
 * base whose status is "ready" are considered. Chunks whose similarity is
 * below `SIMILARITY_THRESHOLD` are filtered out; `isRelevant` indicates
 * whether any relevant chunk was found so callers can fall back to human
 * handoff when the knowledge base has no matching content.
 */
export async function retrieve(query: string, topK = 5): Promise<RetrievalResult> {
  if (!query || query.trim().length === 0) {
    return { docs: [], isRelevant: false };
  }

  if (!strapiInstance) {
    throw new Error('Strapi instance not initialized. Call setStrapi() first.');
  }

  const { embedding } = await generateEmbedding(query);
  if (!embedding || embedding.length === 0) {
    return { docs: [], isRelevant: false };
  }

  const embeddingJson = JSON.stringify(embedding);

  const sql = `SELECT ke.id, ke.chunk_text, ke.knowledge_base_id, 1 - (ke.embedding <=> ?::vector) as similarity
   FROM knowledge_embeddings ke
   JOIN knowledge_bases kb ON ke.knowledge_base_id = kb.id
   WHERE kb.status = 'ready'
   ORDER BY ke.embedding <=> ?::vector
   LIMIT ?`;

  const result = await strapiInstance.db.connection.raw(sql, [
    embeddingJson,
    embeddingJson,
    topK,
  ]);

  // Knex returns { rows: [...] } for PostgreSQL and a plain array for SQLite.
  const rows: Array<Record<string, unknown>> = Array.isArray(result)
    ? result
    : result.rows || [];

  const docs = rows
    .map((row) => ({
      id: Number(row.id),
      chunkText: String(row.chunk_text ?? ''),
      knowledgeBaseId: Number(row.knowledge_base_id),
      similarity: Number(row.similarity),
    }))
    .filter((doc) => doc.similarity >= SIMILARITY_THRESHOLD);

  return {
    docs,
    isRelevant: docs.length > 0,
  };
}

async function buildSystemPrompt(retrievedDocs: RetrievedDoc[]): Promise<string> {
  let docsSection: string;
  if (retrievedDocs.length === 0) {
    docsSection = '（暂无相关知识库内容）';
  } else {
    docsSection = retrievedDocs
      .map((doc, index) => `[${index + 1}] ${doc.chunkText}`)
      .join('\n');
  }

  // 优先使用 ai-config 中配置的 systemPrompt，回退到硬编码默认值
  if (strapiInstance) {
    try {
      const aiConfig = await getActiveAiConfig(strapiInstance);
      if (aiConfig?.systemPrompt) {
        return aiConfig.systemPrompt.replace('{retrieved_docs}', docsSection);
      }
    } catch (err) {
      console.warn('[rag-service] Failed to load ai-config systemPrompt, using default:', err instanceof Error ? err.message : err, err instanceof Error ? err.stack : '');
    }
  }

  return SYSTEM_PROMPT_TEMPLATE.replace('{retrieved_docs}', docsSection);
}

/**
 * Build a chat completion request from the retrieved context and recent
 * history, then return the assistant's answer.
 */
export async function generateAnswer(
  query: string,
  retrievedDocs: RetrievedDoc[],
  history: ChatMessage[] = []
): Promise<string> {
  const systemPrompt = await buildSystemPrompt(retrievedDocs);

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
