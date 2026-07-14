import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock ai-config-service so llm-service can be tested in isolation.
// The mock factory is hoisted; getActiveAiConfig is a vi.fn() whose
// implementation each test can override via mockResolvedValue.
vi.mock('../ai-config-service', () => ({
  getActiveAiConfig: vi.fn(),
  clearCache: vi.fn(),
}));

import { getActiveAiConfig } from '../ai-config-service';

/**
 * Helper to (re)import the llm-service module after env/resetModules changes.
 * The module reads DASHSCOPE_API_KEY at load time, so tests that need a
 * different env state must reset modules and re-import.
 */
async function importLlmService() {
  return await import('../llm-service');
}

function mockFetchResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const ok = init.ok ?? true;
  const status = init.status ?? 200;
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
    body: null as ReadableStream<Uint8Array> | null,
  } as unknown as Response;
}

describe('llm-service', () => {
  let originalFetch: typeof global.fetch;
  let originalKey: string | undefined;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalKey = process.env.DASHSCOPE_API_KEY;
    process.env.DASHSCOPE_API_KEY = 'test-key';
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) {
      delete process.env.DASHSCOPE_API_KEY;
    } else {
      process.env.DASHSCOPE_API_KEY = originalKey;
    }
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe('generateEmbedding', () => {
    test('returns embedding array and token count for valid text', async () => {
      const embeddingVector = Array.from({ length: 8 }, (_, i) => i / 10);
      global.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse({
          data: [{ embedding: embeddingVector }],
          usage: { total_tokens: 12 },
        })
      );

      const { generateEmbedding } = await importLlmService();
      const result = await generateEmbedding('佑森小课堂的校区有哪些？');

      expect(result.embedding).toEqual(embeddingVector);
      expect(result.tokenCount).toBe(12);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/embeddings');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.model).toBe('text-embedding-v2');
      expect(body.input).toBe('佑森小课堂的校区有哪些？');
      expect(body.encoding_format).toBe('float');
      expect((init as RequestInit).headers).toMatchObject({
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      });
    });

    test('returns empty embedding and zero tokens for empty text', async () => {
      global.fetch = vi.fn();

      const { generateEmbedding } = await importLlmService();
      const result = await generateEmbedding('   ');

      expect(result.embedding).toEqual([]);
      expect(result.tokenCount).toBe(0);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('throws when DASHSCOPE_API_KEY is not configured', async () => {
      delete process.env.DASHSCOPE_API_KEY;
      vi.resetModules();
      const { generateEmbedding } = await importLlmService();
      await expect(generateEmbedding('hello')).rejects.toThrow(
        'DASHSCOPE_API_KEY not configured'
      );
    });

    test('throws when API responds with an error status', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse('invalid api key', { ok: false, status: 401 })
      );

      const { generateEmbedding } = await importLlmService();
      await expect(generateEmbedding('hello')).rejects.toThrow(/Embedding API error: 401/);
    });
  });

  describe('generateEmbeddings (batch)', () => {
    test('maps over multiple texts and returns one result per input', async () => {
      global.fetch = vi.fn().mockImplementation(async () =>
        mockFetchResponse({
          data: [{ embedding: [0.5, 0.5] }],
          usage: { total_tokens: 5 },
        })
      );

      const { generateEmbeddings } = await importLlmService();
      const results = await generateEmbeddings(['one', 'two', 'three']);

      expect(results).toHaveLength(3);
      for (const r of results) {
        expect(r.embedding).toEqual([0.5, 0.5]);
        expect(r.tokenCount).toBe(5);
      }
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('chat', () => {
    test('returns content, token count and latency for valid messages', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse({
          choices: [{ message: { content: '我们有6大校区' } }],
          usage: { total_tokens: 42 },
        })
      );

      const { chat } = await importLlmService();
      const messages = [
        { role: 'system' as const, content: '你是客服' },
        { role: 'user' as const, content: '佑森有几个校区？' },
      ];
      const result = await chat(messages, { temperature: 0.3, maxTokens: 500 });

      expect(result.content).toBe('我们有6大校区');
      expect(result.tokenCount).toBe(42);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);

      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.model).toBe('qwen-plus');
      expect(body.messages).toEqual(messages);
      expect(body.temperature).toBe(0.3);
      expect(body.max_tokens).toBe(500);
    });

    test('uses default temperature and max_tokens when options omitted', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse({
          choices: [{ message: { content: 'ok' } }],
          usage: { total_tokens: 1 },
        })
      );

      const { chat } = await importLlmService();
      await chat([{ role: 'user', content: 'hi' }]);

      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.temperature).toBe(0.7);
      expect(body.max_tokens).toBe(2000);
    });

    test('throws when API responds with error', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse('rate limited', { ok: false, status: 429 })
      );

      const { chat } = await importLlmService();
      await expect(chat([{ role: 'user', content: 'hi' }])).rejects.toThrow(
        /Chat API error: 429/
      );
    });

    test('throws when DASHSCOPE_API_KEY is not configured', async () => {
      delete process.env.DASHSCOPE_API_KEY;
      vi.resetModules();
      const { chat } = await importLlmService();
      await expect(chat([{ role: 'user', content: 'hi' }])).rejects.toThrow(
        'DASHSCOPE_API_KEY not configured'
      );
    });
  });

  describe('chatStream', () => {
    test('returns the underlying stream from the response body', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'));
          controller.close();
        },
      });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: stream,
        text: vi.fn().mockResolvedValue(''),
      } as unknown as Response);

      const { chatStream } = await importLlmService();
      const result = await chatStream([{ role: 'user', content: 'hi' }]);
      expect(result).toBe(stream);

      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.stream).toBe(true);
    });

    test('throws when API responds with error', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse('server error', { ok: false, status: 500 })
      );

      const { chatStream } = await importLlmService();
      await expect(chatStream([{ role: 'user', content: 'hi' }])).rejects.toThrow(
        /Chat stream API error: 500/
      );
    });
  });

  describe('detectIntent', () => {
    test('returns shouldTransfer=true when transfer keyword present', async () => {
      global.fetch = vi.fn(); // should NOT be called when keyword matches

      const { detectIntent } = await importLlmService();
      const result = await detectIntent('我要转人工');

      expect(result.shouldTransfer).toBe(true);
      expect(result.reason).toContain('转人工');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('detects "人工客服" keyword', async () => {
      const { detectIntent } = await importLlmService();
      const result = await detectIntent('请帮我接人工客服');
      expect(result.shouldTransfer).toBe(true);
      expect(result.reason).toContain('人工客服');
    });

    test('detects "投诉" keyword', async () => {
      const { detectIntent } = await importLlmService();
      const result = await detectIntent('我要投诉你们的服务');
      expect(result.shouldTransfer).toBe(true);
      expect(result.reason).toContain('投诉');
    });

    test('returns shouldTransfer=false when LLM says no transfer intent', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse({
          choices: [{ message: { content: '{"shouldTransfer": false, "reason": "咨询课程"}' } }],
          usage: { total_tokens: 10 },
        })
      );

      const { detectIntent } = await importLlmService();
      const result = await detectIntent('你们有哪些课程？');

      expect(result.shouldTransfer).toBe(false);
      expect(result.reason).toBe('咨询课程');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('returns shouldTransfer=true when LLM detects transfer intent without keyword', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse({
          choices: [{ message: { content: '{"shouldTransfer": true, "reason": "情绪激动要求真人"}' } }],
          usage: { total_tokens: 10 },
        })
      );

      const { detectIntent } = await importLlmService();
      const result = await detectIntent('我不想跟机器人说话了');

      expect(result.shouldTransfer).toBe(true);
      expect(result.reason).toBe('情绪激动要求真人');
    });

    test('falls back to shouldTransfer=false when LLM returns invalid JSON', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse({
          choices: [{ message: { content: 'not valid json' } }],
          usage: { total_tokens: 5 },
        })
      );

      const { detectIntent } = await importLlmService();
      const result = await detectIntent('今天天气怎么样');

      expect(result.shouldTransfer).toBe(false);
      expect(result.reason).toBe('无转人工意图');
    });
  });

  describe('default export', () => {
    test('exposes all service functions', async () => {
      global.fetch = vi.fn();
      const mod = await importLlmService();
      const def = mod.default;
      expect(typeof def.generateEmbedding).toBe('function');
      expect(typeof def.generateEmbeddings).toBe('function');
      expect(typeof def.chat).toBe('function');
      expect(typeof def.chatStream).toBe('function');
      expect(typeof def.detectIntent).toBe('function');
    });
  });

  describe('ai-config integration', () => {
    const aiConfigStub = {
      provider: 'qwen' as const,
      model: 'qwen-plus',
      embeddingModel: 'text-embedding-v2',
      apiKey: 'sk-test-key',
      apiEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      systemPrompt: '你是佑森小课堂的AI助手',
      temperature: 0.7,
      maxTokens: 2000,
      topK: 5,
      chunkSize: 500,
      chunkOverlap: 50,
    };

    // Each test in this block re-imports llm-service (parent beforeEach calls
    // vi.resetModules), so strapiInstance starts as null. We inject a mock
    // strapi via setStrapi so getConfig() will consult ai-config-service.
    beforeEach(() => {
      (getActiveAiConfig as unknown as ReturnType<typeof vi.fn>).mockReset();
    });

    test('无 active 配置时应降级到 process.env', async () => {
      (getActiveAiConfig as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      global.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse({
          data: [{ embedding: [0.1, 0.2] }],
          usage: { total_tokens: 10 },
        })
      );

      const { generateEmbedding, setStrapi } = await importLlmService();
      setStrapi({} as any); // strapi set, but ai-config returns null → env fallback

      const result = await generateEmbedding('测试文本');
      expect(result).toBeDefined();
      expect(result.embedding).toEqual([0.1, 0.2]);

      // Fetch should use env-based key (test-key), not any ai-config value.
      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const init = callArgs[1] as RequestInit;
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer test-key');
    });

    test('应使用 ai-config 的 apiKey 而非 process.env', async () => {
      (getActiveAiConfig as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(aiConfigStub);
      global.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse({
          data: [{ embedding: [0.1, 0.2] }],
          usage: { total_tokens: 10 },
        })
      );

      const { generateEmbedding, setStrapi } = await importLlmService();
      setStrapi({} as any); // strapi set, ai-config returns the stub

      await generateEmbedding('测试文本');

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const url = callArgs[0] as string;
      const init = callArgs[1] as RequestInit;
      const headers = init.headers as Record<string, string>;
      // Should use ai-config apiKey, not process.env.DASHSCOPE_API_KEY
      expect(headers.Authorization).toBe('Bearer sk-test-key');
      // Should use ai-config endpoint
      expect(url).toContain('dashscope.aliyuncs.com');
      // Body should use ai-config embeddingModel
      const body = JSON.parse(init.body as string);
      expect(body.model).toBe('text-embedding-v2');
    });
  });
});
