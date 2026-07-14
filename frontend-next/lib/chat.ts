/**
 * AI 客服 Chat API 客户端
 * 前端 → Next.js API Route (代理) → Strapi 后端
 */

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessageData {
  role: ChatRole;
  content: string;
  timestamp?: string;
  type?: 'text' | 'transfer';
  streaming?: boolean;
}

export interface SSEData {
  token?: string;
  type?: 'transfer' | 'done' | 'error';
  message?: string;
  error?: string;
}

/**
 * 创建聊天会话
 */
export async function startChat(options?: {
  sourcePage?: string;
  visitorName?: string;
  visitorPhone?: string;
}): Promise<{ sessionId: string; visitorId: string }> {
  const res = await fetch('/api/chat/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options || {}),
  });

  if (!res.ok) {
    throw new Error(`Failed to start chat: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * 发送消息并获取 AI 回复（JSON 响应）
 * 后端返回 { type: 'answer' | 'transfer', content: string, retrievedDocs?: number, actionUrl?: string }
 */
export interface ChatResponse {
  type: 'answer' | 'transfer';
  content: string;
  retrievedDocs?: number;
  actionUrl?: string;
}

export async function sendMessage(
  sessionId: string,
  message: string
): Promise<ChatResponse> {
  const res = await fetch('/api/chat/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message }),
  });

  if (!res.ok) {
    throw new Error(`Failed to send message: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * 转人工客服
 */
export async function transferToHuman(
  sessionId: string
): Promise<{ success: boolean; sessionId: string; status: string }> {
  const res = await fetch('/api/chat/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });

  if (!res.ok) {
    throw new Error(`Failed to transfer: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * 获取聊天历史
 */
export async function getChatHistory(
  sessionId: string
): Promise<{ messages: ChatMessageData[] }> {
  const res = await fetch(`/api/chat/history/${sessionId}`, {
    method: 'GET',
  });

  if (!res.ok) {
    throw new Error(`Failed to get history: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * 解析 SSE 流
 * @param stream ReadableStream from fetch response
 * @param onData 每个 SSE data 事件的回调
 * @param onDone 流结束的回调
 */
export async function parseSSEStream(
  stream: ReadableStream<Uint8Array>,
  onData: (data: SSEData) => void,
  onDone: () => void
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE 事件以 \n\n 分隔
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const block of lines) {
        const line = block.trim();
        if (!line.startsWith('data: ')) continue;

        const dataStr = line.slice(6).trim();
        if (dataStr === '[DONE]') {
          onDone();
          return;
        }

        try {
          const data = JSON.parse(dataStr) as SSEData;
          onData(data);
        } catch {
          // 非 JSON 数据，跳过
        }
      }
    }
    // 流自然结束
    onDone();
  } finally {
    reader.releaseLock();
  }
}
