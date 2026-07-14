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

const DASHSCOPE_ENDPOINT =
  process.env.DASHSCOPE_API_ENDPOINT || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';
const DEFAULT_MODEL = process.env.QWEN_MODEL || 'qwen-plus';
const DEFAULT_EMBEDDING_MODEL = process.env.QWEN_EMBEDDING_MODEL || 'text-embedding-v2';

export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  if (!DASHSCOPE_API_KEY) throw new Error('DASHSCOPE_API_KEY not configured');
  if (!text || text.trim().length === 0) return { embedding: [], tokenCount: 0 };

  const response = await fetch(`${DASHSCOPE_ENDPOINT}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_EMBEDDING_MODEL,
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
  if (!DASHSCOPE_API_KEY) throw new Error('DASHSCOPE_API_KEY not configured');

  const startTime = Date.now();
  const response = await fetch(`${DASHSCOPE_ENDPOINT}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
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
  if (!DASHSCOPE_API_KEY) throw new Error('DASHSCOPE_API_KEY not configured');

  const response = await fetch(`${DASHSCOPE_ENDPOINT}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
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

  if (DASHSCOPE_API_KEY) {
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
  generateEmbedding,
  generateEmbeddings,
  chat,
  chatStream,
  detectIntent,
};
