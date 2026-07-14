import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock llm-service so rag-service is tested in isolation.
vi.mock('../llm-service', () => ({
  generateEmbedding: vi.fn(),
  chat: vi.fn(),
}));

// Import mocked functions (typed as vitest mocks).
import { generateEmbedding, chat } from '../llm-service';
import { setStrapi, retrieve, generateAnswer, feedbackToFaq } from '../rag-service';
import type { RetrievedDoc } from '../rag-service';

const mockGenerateEmbedding = generateEmbedding as unknown as ReturnType<typeof vi.fn>;
const mockChat = chat as unknown as ReturnType<typeof vi.fn>;

function buildMockStrapi(rawRows: unknown[] = []) {
  const createFn = vi.fn().mockResolvedValue({ documentId: 'faq-doc-1', id: 1 });
  return {
    db: {
      connection: {
        raw: vi.fn().mockResolvedValue({ rows: rawRows }),
      },
    },
    documents: vi.fn().mockReturnValue({ create: createFn }),
  };
}

describe('rag-service', () => {
  let mockStrapi: ReturnType<typeof buildMockStrapi>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStrapi = buildMockStrapi();
    setStrapi(mockStrapi as any);
  });

  afterEach(() => {
    setStrapi(null as any);
  });

  describe('retrieve', () => {
    test('generates embedding and returns matching chunks ordered by similarity', async () => {
      mockGenerateEmbedding.mockResolvedValue({
        embedding: [0.1, 0.2, 0.3],
        tokenCount: 5,
      });
      const rows = [
        { id: 1, chunk_text: '校区A在光谷', knowledge_base_id: 10, similarity: 0.95 },
        { id: 2, chunk_text: '校区B在徐东', knowledge_base_id: 10, similarity: 0.88 },
      ];
      mockStrapi.db.connection.raw.mockResolvedValue({ rows });

      const result = await retrieve('光谷校区在哪', 5);

      expect(result.docs).toEqual<RetrievedDoc[]>([
        { id: 1, chunkText: '校区A在光谷', knowledgeBaseId: 10, similarity: 0.95 },
        { id: 2, chunkText: '校区B在徐东', knowledgeBaseId: 10, similarity: 0.88 },
      ]);
      expect(result.isRelevant).toBe(true);
      expect(mockGenerateEmbedding).toHaveBeenCalledTimes(1);
      expect(mockGenerateEmbedding).toHaveBeenCalledWith('光谷校区在哪');

      expect(mockStrapi.db.connection.raw).toHaveBeenCalledTimes(1);
      const [sql, params] = mockStrapi.db.connection.raw.mock.calls[0];
      expect(sql).toContain('knowledge_embeddings');
      expect(sql).toContain('knowledge_bases');
      expect(sql).toContain('status');
      expect(sql).toContain('LIMIT');
      // params: [embedding, embedding, topK]
      expect(params).toHaveLength(3);
      expect(params[0]).toBe(JSON.stringify([0.1, 0.2, 0.3]));
      expect(params[1]).toBe(JSON.stringify([0.1, 0.2, 0.3]));
      expect(params[2]).toBe(5);
    });

    test('uses default topK of 5 when not specified', async () => {
      mockGenerateEmbedding.mockResolvedValue({ embedding: [0.1], tokenCount: 1 });
      mockStrapi.db.connection.raw.mockResolvedValue({ rows: [] });

      await retrieve('hello');

      const params = mockStrapi.db.connection.raw.mock.calls[0][1];
      expect(params[2]).toBe(5);
    });

    test('returns empty array when query is empty or whitespace', async () => {
      const result = await retrieve('   ');
      expect(result.docs).toEqual([]);
      expect(result.isRelevant).toBe(false);
      expect(mockGenerateEmbedding).not.toHaveBeenCalled();
      expect(mockStrapi.db.connection.raw).not.toHaveBeenCalled();
    });

    test('returns empty array when no matching chunks found', async () => {
      mockGenerateEmbedding.mockResolvedValue({ embedding: [0.1], tokenCount: 1 });
      mockStrapi.db.connection.raw.mockResolvedValue({ rows: [] });

      const result = await retrieve('random question');
      expect(result.docs).toEqual([]);
      expect(result.isRelevant).toBe(false);
    });

    test('propagates error when embedding generation fails', async () => {
      mockGenerateEmbedding.mockRejectedValue(new Error('DASHSCOPE_API_KEY not configured'));

      await expect(retrieve('hello')).rejects.toThrow('DASHSCOPE_API_KEY not configured');
      expect(mockStrapi.db.connection.raw).not.toHaveBeenCalled();
    });

    describe('相似度阈值 0.3', () => {
      test('相似度低于 0.3 的结果应被过滤，isRelevant=false', async () => {
        mockGenerateEmbedding.mockResolvedValue({ embedding: [0.1], tokenCount: 1 });
        const rows = [
          { id: 10, chunk_text: '不相关内容', knowledge_base_id: 1, similarity: 0.1 },
          { id: 11, chunk_text: '弱相关', knowledge_base_id: 1, similarity: 0.25 },
        ];
        mockStrapi.db.connection.raw.mockResolvedValue({ rows });

        const result = await retrieve('测试问题', 5);

        expect(result.docs).toHaveLength(0);
        expect(result.isRelevant).toBe(false);
      });

      test('相似度高于 0.3 的结果应保留，isRelevant=true', async () => {
        mockGenerateEmbedding.mockResolvedValue({ embedding: [0.1], tokenCount: 1 });
        const rows = [
          { id: 20, chunk_text: '相关内容', knowledge_base_id: 1, similarity: 0.8 },
          { id: 21, chunk_text: '不相关', knowledge_base_id: 1, similarity: 0.2 },
        ];
        mockStrapi.db.connection.raw.mockResolvedValue({ rows });

        const result = await retrieve('测试问题', 5);

        expect(result.docs).toHaveLength(1);
        expect(result.docs[0].id).toBe(20);
        expect(result.isRelevant).toBe(true);
      });

      test('相似度恰好等于 0.3 的结果应保留（边界 >=）', async () => {
        mockGenerateEmbedding.mockResolvedValue({ embedding: [0.1], tokenCount: 1 });
        const rows = [
          { id: 30, chunk_text: '边界内容', knowledge_base_id: 1, similarity: 0.3 },
        ];
        mockStrapi.db.connection.raw.mockResolvedValue({ rows });

        const result = await retrieve('测试问题', 5);

        expect(result.docs).toHaveLength(1);
        expect(result.isRelevant).toBe(true);
      });
    });
  });

  describe('generateAnswer', () => {
    const docs: RetrievedDoc[] = [
      { id: 1, chunkText: '佑森在武汉有6大校区', knowledgeBaseId: 10, similarity: 0.9 },
      { id: 2, chunkText: '课程包括幼小衔接班', knowledgeBaseId: 11, similarity: 0.85 },
    ];

    test('builds system prompt with retrieved docs and calls chat, returns content', async () => {
      mockChat.mockResolvedValue({
        content: '佑森在武汉有6大校区，欢迎咨询。',
        tokenCount: 30,
        latencyMs: 120,
      });

      const history = [
        { role: 'user' as const, content: '你好' },
        { role: 'assistant' as const, content: '您好，有什么可以帮您？' },
      ];

      const result = await generateAnswer('佑森有几个校区？', docs, history);

      expect(result).toBe('佑森在武汉有6大校区，欢迎咨询。');
      expect(mockChat).toHaveBeenCalledTimes(1);

      const [messages, options] = mockChat.mock.calls[0];
      // First message is system prompt
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toContain('佑森小课堂');
      expect(messages[0].content).toContain('6大校区');
      expect(messages[0].content).toContain('佑森在武汉有6大校区');
      expect(messages[0].content).toContain('课程包括幼小衔接班');
      expect(messages[0].content).toContain('知识库内容');
      // History messages included
      expect(messages).toContainEqual({ role: 'user', content: '你好' });
      expect(messages).toContainEqual({ role: 'assistant', content: '您好，有什么可以帮您？' });
      // Final user query appended at the end
      expect(messages[messages.length - 1]).toEqual({
        role: 'user',
        content: '佑森有几个校区？',
      });
      expect(options).toEqual({ temperature: 0.3, maxTokens: 2000 });
    });

    test('works without chat history', async () => {
      mockChat.mockResolvedValue({ content: 'answer', tokenCount: 1, latencyMs: 1 });

      await generateAnswer('question', docs);

      const messages = mockChat.mock.calls[0][0];
      // system + final user question only
      expect(messages).toHaveLength(2);
      expect(messages[1]).toEqual({ role: 'user', content: 'question' });
    });

    test('includes notice when no docs retrieved', async () => {
      mockChat.mockResolvedValue({ content: '暂无相关信息', tokenCount: 1, latencyMs: 1 });

      await generateAnswer('question', []);

      const systemPrompt = mockChat.mock.calls[0][0][0].content;
      expect(systemPrompt).toContain('暂无相关');
    });

    test('truncates history to last 10 messages', async () => {
      mockChat.mockResolvedValue({ content: 'ok', tokenCount: 1, latencyMs: 1 });

      const longHistory = Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
        content: `msg-${i}`,
      }));

      await generateAnswer('q', docs, longHistory);

      const messages = mockChat.mock.calls[0][0];
      // system + last 10 history + final user query = 12
      expect(messages).toHaveLength(12);
      // Last 10 of 15 = indices 5..14. msg-5: i=5 -> 5%2=1 -> assistant.
      expect(messages[1]).toEqual({ role: 'assistant', content: 'msg-5' });
      // msg-14: i=14 -> 14%2=0 -> user.
      expect(messages[10]).toEqual({ role: 'user', content: 'msg-14' });
      expect(messages[11]).toEqual({ role: 'user', content: 'q' });
    });
  });

  describe('feedbackToFaq', () => {
    test('creates FAQ item with chat-feedback sourceType and pending reviewStatus', async () => {
      const createFn = mockStrapi.documents().create;
      createFn.mockResolvedValue({ documentId: 'faq-1', id: 1 });

      const result = await feedbackToFaq('课程价格是多少？', '请致电确认', 'chat-session-doc-1');

      expect(mockStrapi.documents).toHaveBeenCalledWith('api::faq-item.faq-item');
      expect(createFn).toHaveBeenCalledTimes(1);
      const call = createFn.mock.calls[0][0];
      expect(call.data.question).toBe('课程价格是多少？');
      expect(call.data.answer).toBe('请致电确认');
      expect(call.data.sourceType).toBe('chat-feedback');
      expect(call.data.reviewStatus).toBe('pending');
      expect(call.data.sourceSession).toBe('chat-session-doc-1');
      expect(result.documentId).toBe('faq-1');
    });

    test('throws when strapi is not initialized', async () => {
      setStrapi(null as any);
      await expect(
        feedbackToFaq('q', 'a', 'session-1')
      ).rejects.toThrow(/strapi.*not.*initialized|Strapi.*not.*initialized/i);
    });

    test('propagates error when document service create fails', async () => {
      const createFn = mockStrapi.documents().create;
      createFn.mockRejectedValue(new Error('DB write failed'));

      await expect(
        feedbackToFaq('q', 'a', 'session-1')
      ).rejects.toThrow('DB write failed');
    });
  });
});
