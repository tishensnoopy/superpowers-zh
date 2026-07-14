import { getActiveAiConfig } from './ai-config-service';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

export interface ChatResult {
  content: string;
  tokenCount: number;
  latencyMs: number;
}

export interface IntentResult {
  shouldTransfer: boolean;
  reason: string;
}

interface EmbeddingApiResponse {
  data: Array<{ embedding: number[] }>;
  usage?: { total_tokens: number };
}

interface ChatApiResponse {
  choices: Array<{ message?: { content?: string } }>;
  usage?: { total_tokens: number };
}

interface LlmConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  embeddingModel: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

const DEFAULT_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen-plus';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-v2';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 2000;

/**
 * Strapi instance injected via `setStrapi()`. Kept as a module-level singleton
 * (same pattern as src/services/rag-service.ts and src/workers/document-processor.ts)
 * so the service functions stay callable without threading strapi through every
 * call site. When null, getConfig() falls back to process.env.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let strapiInstance: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setStrapi(strapi: any): void {
  strapiInstance = strapi;
}

/**
 * Resolve the LLM config to use for this call. Prefers an active ai-config row
 * (read through the cached ai-config-service) when a strapi instance has been
 * injected; otherwise falls back to process.env defaults.
 */
async function getConfig(): Promise<LlmConfig> {
  if (strapiInstance) {
    try {
      const aiConfig = await getActiveAiConfig(strapiInstance);
      if (aiConfig) {
        return {
          endpoint: aiConfig.apiEndpoint || DEFAULT_ENDPOINT,
          apiKey: aiConfig.apiKey,
          model: aiConfig.model || DEFAULT_MODEL,
          embeddingModel: aiConfig.embeddingModel || DEFAULT_EMBEDDING_MODEL,
          temperature: aiConfig.temperature ?? DEFAULT_TEMPERATURE,
          maxTokens: aiConfig.maxTokens ?? DEFAULT_MAX_TOKENS,
          systemPrompt: aiConfig.systemPrompt || '',
        };
      }
    } catch (err) {
      console.error('[llm-service] Failed to read ai-config, falling back to env:', err);
    }
  }

  return {
    endpoint: process.env.DASHSCOPE_API_ENDPOINT || DEFAULT_ENDPOINT,
    apiKey: process.env.DASHSCOPE_API_KEY || '',
    model: process.env.QWEN_MODEL || DEFAULT_MODEL,
    embeddingModel: process.env.QWEN_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: DEFAULT_MAX_TOKENS,
    systemPrompt: '',
  };
}

export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  if (!text || text.trim().length === 0) return { embedding: [], tokenCount: 0 };

  const { endpoint, apiKey, embeddingModel } = await getConfig();
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY not configured');

  const response = await fetch(`${endpoint}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: embeddingModel,
      input: text,
      encoding_format: 'float',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding API error: ${response.status} ${error}`);
  }

  const data = (await response.json()) as EmbeddingApiResponse;
  return {
    embedding: data.data[0].embedding,
    tokenCount: data.usage?.total_tokens || 0,
  };
}

export async function generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  const results = await Promise.all(texts.map((t) => generateEmbedding(t)));
  return results;
}

export async function chat(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<ChatResult> {
  const { endpoint, apiKey, model, temperature: defaultTemp, maxTokens: defaultMax } =
    await getConfig();
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY not configured');

  const startTime = Date.now();
  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? defaultTemp,
      max_tokens: options.maxTokens ?? defaultMax,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Chat API error: ${response.status} ${error}`);
  }

  const data = (await response.json()) as ChatApiResponse;
  const latencyMs = Date.now() - startTime;
  return {
    content: data.choices[0]?.message?.content || '',
    tokenCount: data.usage?.total_tokens || 0,
    latencyMs,
  };
}

export async function chatStream(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<ReadableStream<Uint8Array>> {
  const { endpoint, apiKey, model, temperature: defaultTemp, maxTokens: defaultMax } =
    await getConfig();
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY not configured');

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? defaultTemp,
      max_tokens: options.maxTokens ?? defaultMax,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const error = await response.text();
    throw new Error(`Chat stream API error: ${response.status} ${error}`);
  }

  return response.body;
}

const TRANSFER_KEYWORDS = [
  '转人工',
  '人工客服',
  '找人工',
  '真人客服',
  '人工服务',
  '投诉',
  '转接',
];

export async function detectIntent(message: string): Promise<IntentResult> {
  const lowerMessage = message.toLowerCase();
  for (const keyword of TRANSFER_KEYWORDS) {
    if (message.includes(keyword) || lowerMessage.includes(keyword.toLowerCase())) {
      return { shouldTransfer: true, reason: `关键词触发: ${keyword}` };
    }
  }

  const { apiKey } = await getConfig();
  if (apiKey) {
    try {
      const result = await chat(
        [
          {
            role: 'system',
            content:
              '你是一个意图识别助手。判断用户消息是否表达了转人工客服的意愿。只回答JSON: {"shouldTransfer": true/false, "reason": "简短原因"}',
          },
          { role: 'user', content: message },
        ],
        { temperature: 0.1, maxTokens: 100 }
      );

      const parsed = JSON.parse(result.content.trim());
      if (parsed && typeof parsed.shouldTransfer === 'boolean') {
        return parsed;
      }
    } catch {
      // If LLM fails, fall through to keyword-based result (already checked above)
    }
  }

  return { shouldTransfer: false, reason: '无转人工意图' };
}

export default {
  setStrapi,
  generateEmbedding,
  generateEmbeddings,
  chat,
  chatStream,
  detectIntent,
};
