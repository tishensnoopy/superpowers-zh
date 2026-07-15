import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import Module from 'module';

/**
 * The chat controller loads services lazily via CommonJS `require()` (for
 * incremental dev safety — see controller comment). Vitest's `vi.mock`
 * intercepts ESM imports but does NOT intercept runtime `require()` calls
 * that resolve `.ts` files. We therefore intercept `Module._load` to return
 * mock service modules when the controller `require`s them.
 */

const mockRetrieve = vi.fn();
const mockGenerateAnswer = vi.fn();
const mockDetectIntent = vi.fn();

interface MockSession {
  id: number;
  documentId: string;
  sessionId: string;
  status: string;
  messageCount: number;
  locale?: string;
}

function buildMockStrapi(session: MockSession | null) {
  const sessionFindMany = vi.fn().mockResolvedValue(session ? [session] : []);
  const messageCreate = vi.fn().mockResolvedValue({ id: 1, documentId: 'msg-doc-1' });
  const messageFindMany = vi.fn().mockResolvedValue([]);
  const dbUpdate = vi.fn().mockResolvedValue({});

  return {
    documents: vi.fn((uid: string) => {
      if (uid === 'api::chat-session.chat-session') {
        return { findMany: sessionFindMany };
      }
      if (uid === 'api::chat-message.chat-message') {
        return {
          create: messageCreate,
          findMany: messageFindMany,
        };
      }
      throw new Error(`unexpected documents uid: ${uid}`);
    }),
    db: {
      query: vi.fn((uid: string) => {
        if (uid === 'api::chat-session.chat-session') {
          return { update: dbUpdate };
        }
        if (uid === 'api::chat-message.chat-message') {
          return { findMany: messageFindMany };
        }
        throw new Error(`unexpected db.query uid: ${uid}`);
      }),
    },
    __sessionFindMany: sessionFindMany,
    __messageCreate: messageCreate,
    __messageFindMany: messageFindMany,
    __dbUpdate: dbUpdate,
  };
}

function buildCtx(body: { sessionId?: string; message?: string; question?: string; answer?: string; helpful?: boolean }) {
  const ctx: any = {
    request: { body },
    body: undefined as unknown,
    throw(status: number, msg: string) {
      const err: any = new Error(msg);
      err.status = status;
      throw err;
    },
  };
  return ctx;
}

// Import the controller at the top level. The controller's `require()` calls
// are lazy (inside method bodies), so they execute when sendMessage is called
// — at which point the Module._load interceptor (set up in beforeEach) is
// already active.
import chatController from '../chat';

describe('chat controller - sendMessage 防滥用机制', () => {
  let originalStrapi: unknown;
  let originalLoad: typeof Module._load;

  beforeEach(() => {
    vi.clearAllMocks();
    originalStrapi = (globalThis as any).strapi;
    originalLoad = Module._load;

    // Intercept require() calls from the chat controller to return mocks.
    Module._load = function (request: string, parent: NodeJS.Module | undefined, isMain: boolean) {
      if (parent?.filename?.includes('chat') && parent.filename.includes('controllers')) {
        if (request.includes('services/llm-service')) {
          return { detectIntent: mockDetectIntent };
        }
        if (request.includes('services/rag-service')) {
          return {
            retrieve: mockRetrieve,
            generateAnswer: mockGenerateAnswer,
            feedbackToFaq: vi.fn(),
          };
        }
      }
      return originalLoad.call(this, request, parent, isMain);
    } as typeof Module._load;

    // Set default mock implementations.
    mockDetectIntent.mockResolvedValue({ shouldTransfer: false });
    mockRetrieve.mockResolvedValue({
      docs: [{ id: 1, chunkText: 'relevant doc', knowledgeBaseId: 10, similarity: 0.9 }],
      isRelevant: true,
      usedFallback: false,
    });
    mockGenerateAnswer.mockResolvedValue('mock answer');
  });

  afterEach(() => {
    Module._load = originalLoad;
    if (originalStrapi === undefined) {
      delete (globalThis as any).strapi;
    } else {
      (globalThis as any).strapi = originalStrapi;
    }
  });

  describe('500 字符限制', () => {
    test('消息超过 500 字符时返回 400 错误', async () => {
      const mockStrapi = buildMockStrapi(null);
      (globalThis as any).strapi = mockStrapi;

      const longMessage = 'a'.repeat(501);
      const ctx = buildCtx({ sessionId: 'sess_1', message: longMessage });

      await expect(chatController.sendMessage(ctx)).rejects.toMatchObject({
        status: 400,
      });

      // 不应进行任何 DB 查询或 LLM 调用
      expect(mockStrapi.__sessionFindMany).not.toHaveBeenCalled();
      expect(mockRetrieve).not.toHaveBeenCalled();
      expect(mockGenerateAnswer).not.toHaveBeenCalled();
    });

    test('消息恰好 500 字符时不被拒绝（边界）', async () => {
      const session: MockSession = {
        id: 1,
        documentId: 'sess-doc-1',
        sessionId: 'sess_1',
        status: 'active',
        messageCount: 0,
      };
      const mockStrapi = buildMockStrapi(session);
      (globalThis as any).strapi = mockStrapi;

      const exactMessage = 'a'.repeat(500);
      const ctx = buildCtx({ sessionId: 'sess_1', message: exactMessage });

      await chatController.sendMessage(ctx);

      expect(ctx.body).toMatchObject({ type: 'answer' });
      expect(mockStrapi.__sessionFindMany).toHaveBeenCalled();
    });
  });

  describe('10 轮阈值', () => {
    test('messageCount >= 10 时返回 transfer + actionUrl=/appointment', async () => {
      const session: MockSession = {
        id: 1,
        documentId: 'sess-doc-1',
        sessionId: 'sess_1',
        status: 'active',
        messageCount: 10,
      };
      const mockStrapi = buildMockStrapi(session);
      (globalThis as any).strapi = mockStrapi;

      const ctx = buildCtx({ sessionId: 'sess_1', message: '再来一个问题' });
      await chatController.sendMessage(ctx);

      expect(ctx.body).toMatchObject({
        type: 'transfer',
        actionUrl: '/appointment',
        retrievedDocs: 0,
      });
      expect((ctx.body as any).content).toBeTruthy();

      // 不应调用 RAG / LLM
      expect(mockRetrieve).not.toHaveBeenCalled();
      expect(mockGenerateAnswer).not.toHaveBeenCalled();
      // 不应递增 messageCount
      const updateCalls = mockStrapi.__dbUpdate.mock.calls;
      const messageCountUpdate = updateCalls.find(
        (call: any[]) => call[0]?.data && Object.prototype.hasOwnProperty.call(call[0].data, 'messageCount')
      );
      expect(messageCountUpdate).toBeUndefined();
    });

    test('messageCount = 9 时不触发阈值（边界，正常回复后递增到 10）', async () => {
      const session: MockSession = {
        id: 1,
        documentId: 'sess-doc-1',
        sessionId: 'sess_1',
        status: 'active',
        messageCount: 9,
      };
      const mockStrapi = buildMockStrapi(session);
      (globalThis as any).strapi = mockStrapi;

      const ctx = buildCtx({ sessionId: 'sess_1', message: '最后一个正常问题' });
      await chatController.sendMessage(ctx);

      expect(ctx.body).toMatchObject({ type: 'answer' });
      // 应递增 messageCount 到 10
      const updateCalls = mockStrapi.__dbUpdate.mock.calls;
      const messageCountUpdate = updateCalls.find(
        (call: any[]) => call[0]?.data && Object.prototype.hasOwnProperty.call(call[0].data, 'messageCount')
      );
      expect(messageCountUpdate).toBeDefined();
      expect(messageCountUpdate![0].data.messageCount).toBe(10);
    });
  });

  describe('引导模式（isRelevant=false 转人工）', () => {
    test('RAG 返回 isRelevant=false 时返回 transfer 并更新 session.status', async () => {
      const session: MockSession = {
        id: 1,
        documentId: 'sess-doc-1',
        sessionId: 'sess_1',
        status: 'active',
        messageCount: 2,
      };
      const mockStrapi = buildMockStrapi(session);
      (globalThis as any).strapi = mockStrapi;
      mockRetrieve.mockResolvedValueOnce({ docs: [], isRelevant: false });

      const ctx = buildCtx({ sessionId: 'sess_1', message: '冷门问题' });
      await chatController.sendMessage(ctx);

      expect(ctx.body).toMatchObject({
        type: 'transfer',
        retrievedDocs: 0,
      });
      expect((ctx.body as any).content).toBeTruthy();

      // 应更新 session.status 为 transferred
      const updateCalls = mockStrapi.__dbUpdate.mock.calls;
      const statusUpdate = updateCalls.find(
        (call: any[]) => call[0]?.data && call[0].data.status === 'transferred'
      );
      expect(statusUpdate).toBeDefined();

      // 不应调用 LLM 生成答案
      expect(mockGenerateAnswer).not.toHaveBeenCalled();
      // 不应递增 messageCount（引导模式不递增）
      const messageCountUpdate = updateCalls.find(
        (call: any[]) => call[0]?.data && Object.prototype.hasOwnProperty.call(call[0].data, 'messageCount')
      );
      expect(messageCountUpdate).toBeUndefined();
    });

    test('RAG 返回 isRelevant=true 时正常生成答案', async () => {
      const session: MockSession = {
        id: 1,
        documentId: 'sess-doc-1',
        sessionId: 'sess_1',
        status: 'active',
        messageCount: 2,
      };
      const mockStrapi = buildMockStrapi(session);
      (globalThis as any).strapi = mockStrapi;

      const ctx = buildCtx({ sessionId: 'sess_1', message: '光谷校区在哪' });
      await chatController.sendMessage(ctx);

      expect(ctx.body).toMatchObject({
        type: 'answer',
        content: 'mock answer',
        isRelevant: true,
      });
      expect(mockGenerateAnswer).toHaveBeenCalled();
    });
  });

  describe('正常回复后递增 messageCount', () => {
    test('正常回复后 messageCount 递增 1', async () => {
      const session: MockSession = {
        id: 1,
        documentId: 'sess-doc-1',
        sessionId: 'sess_1',
        status: 'active',
        messageCount: 3,
      };
      const mockStrapi = buildMockStrapi(session);
      (globalThis as any).strapi = mockStrapi;

      const ctx = buildCtx({ sessionId: 'sess_1', message: '你好' });
      await chatController.sendMessage(ctx);

      expect(ctx.body).toMatchObject({ type: 'answer' });

      const updateCalls = mockStrapi.__dbUpdate.mock.calls;
      const messageCountUpdate = updateCalls.find(
        (call: any[]) => call[0]?.data && Object.prototype.hasOwnProperty.call(call[0].data, 'messageCount')
      );
      expect(messageCountUpdate).toBeDefined();
      expect(messageCountUpdate![0].data.messageCount).toBe(4);
      expect(messageCountUpdate![0].where).toEqual({ id: 1 });
    });
  });
});

describe('chat controller - submitFeedback session 校验', () => {
  let originalStrapi: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    originalStrapi = (globalThis as any).strapi;
  });

  afterEach(() => {
    if (originalStrapi === undefined) {
      delete (globalThis as any).strapi;
    } else {
      (globalThis as any).strapi = originalStrapi;
    }
  });

  test('session 不存在时返回 404', async () => {
    // buildMockStrapi(null) 让 sessionFindMany 返回空数组，模拟 session 不存在
    const mockStrapi = buildMockStrapi(null);
    (globalThis as any).strapi = mockStrapi;

    const ctx = buildCtx({ sessionId: 'nonexistent', question: '某个问题' });

    await expect(chatController.submitFeedback(ctx)).rejects.toMatchObject({
      status: 404,
    });

    // 应按 sessionId 查询 session
    expect(mockStrapi.__sessionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { sessionId: 'nonexistent' }, limit: 1 })
    );
  });
});

describe('chat controller - startSession locale 处理', () => {
  let originalStrapi: unknown;
  let originalLoad: typeof Module._load;

  beforeEach(() => {
    vi.clearAllMocks();
    originalStrapi = (globalThis as any).strapi;
    originalLoad = Module._load;
    Module._load = function (request: string, parent: NodeJS.Module | undefined, isMain: boolean) {
      if (parent?.filename?.includes('chat') && parent.filename.includes('controllers')) {
        if (request.includes('services/llm-service')) {
          return { detectIntent: mockDetectIntent };
        }
        if (request.includes('services/rag-service')) {
          return { retrieve: mockRetrieve, generateAnswer: mockGenerateAnswer, feedbackToFaq: vi.fn() };
        }
      }
      return originalLoad.call(this, request, parent, isMain);
    } as typeof Module._load;
  });

  afterEach(() => {
    Module._load = originalLoad;
    if (originalStrapi === undefined) {
      delete (globalThis as any).strapi;
    } else {
      (globalThis as any).strapi = originalStrapi;
    }
  });

  test('locale=en-US 时持久化到 session', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ documentId: 'doc1' });
    const mockStrapi = {
      documents: vi.fn().mockReturnValue({ create: mockCreate }),
    };
    (globalThis as any).strapi = mockStrapi;

    const ctx: any = {
      request: { body: { locale: 'en-US' } },
      body: null as any,
    };

    await chatController.startSession(ctx);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ locale: 'en-US' }),
      })
    );
    expect(ctx.body.sessionId).toBeDefined();
  });

  test('未提供 locale 时默认 zh-CN', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ documentId: 'doc1' });
    const mockStrapi = {
      documents: vi.fn().mockReturnValue({ create: mockCreate }),
    };
    (globalThis as any).strapi = mockStrapi;

    const ctx: any = {
      request: { body: {} },
      body: null as any,
    };

    await chatController.startSession(ctx);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ locale: 'zh-CN' }),
      })
    );
  });

  test('非法 locale 回退到 zh-CN', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ documentId: 'doc1' });
    const mockStrapi = {
      documents: vi.fn().mockReturnValue({ create: mockCreate }),
    };
    (globalThis as any).strapi = mockStrapi;

    const ctx: any = {
      request: { body: { locale: 'fr-FR' } },
      body: null as any,
    };

    await chatController.startSession(ctx);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ locale: 'zh-CN' }),
      })
    );
  });
});

describe('chat controller - sendMessage locale 覆盖', () => {
  let originalStrapi: unknown;
  let originalLoad: typeof Module._load;

  beforeEach(() => {
    vi.clearAllMocks();
    originalStrapi = (globalThis as any).strapi;
    originalLoad = Module._load;
    Module._load = function (request: string, parent: NodeJS.Module | undefined, isMain: boolean) {
      if (parent?.filename?.includes('chat') && parent.filename.includes('controllers')) {
        if (request.includes('services/llm-service')) {
          return { detectIntent: mockDetectIntent };
        }
        if (request.includes('services/rag-service')) {
          return { retrieve: mockRetrieve, generateAnswer: mockGenerateAnswer, feedbackToFaq: vi.fn() };
        }
      }
      return originalLoad.call(this, request, parent, isMain);
    } as typeof Module._load;
    mockDetectIntent.mockResolvedValue({ shouldTransfer: false });
    mockRetrieve.mockResolvedValue({
      docs: [{ id: 1, chunkText: 'doc', knowledgeBaseId: 10, similarity: 0.9 }],
      isRelevant: true,
      usedFallback: false,
    });
    mockGenerateAnswer.mockResolvedValue('mock answer');
  });

  afterEach(() => {
    Module._load = originalLoad;
    if (originalStrapi === undefined) {
      delete (globalThis as any).strapi;
    } else {
      (globalThis as any).strapi = originalStrapi;
    }
  });

  test('用 session.locale 覆盖入参 locale（防篡改）', async () => {
    // Session 有 locale=en-US；入参 body 有 locale=zh-CN（篡改尝试）
    const session: MockSession = {
      id: 1,
      documentId: 'sess-doc-1',
      sessionId: 'sess_1',
      status: 'active',
      messageCount: 0,
      locale: 'en-US',
    };
    const mockStrapi = buildMockStrapi(session);
    (globalThis as any).strapi = mockStrapi;

    const ctx = buildCtx({ sessionId: 'sess_1', message: 'hello' });
    // 在 ctx.request.body 中加 locale: 'zh-CN' 模拟篡改
    (ctx.request.body as any).locale = 'zh-CN';

    await chatController.sendMessage(ctx);

    // retrieve 应该用 session 的 en-US，不是 body 的 zh-CN
    expect(mockRetrieve).toHaveBeenCalledWith('hello', 5, 'en-US');
  });
});
