import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

const mockCreate = vi.fn();
const mockFindMany = vi.fn();
const mockFindOne = vi.fn();
const mockUpdate = vi.fn();
const mockCount = vi.fn();

function buildMockStrapi() {
  return {
    documents: vi.fn((uid: string) => {
      if (uid === 'api::feedback.feedback') {
        return {
          create: mockCreate,
          findMany: mockFindMany,
          findOne: mockFindOne,
          update: mockUpdate,
        };
      }
      throw new Error(`unexpected documents uid: ${uid}`);
    }),
    db: {
      query: vi.fn((uid: string) => {
        if (uid === 'api::feedback.feedback') {
          return { count: mockCount };
        }
        throw new Error(`unexpected db.query uid: ${uid}`);
      }),
    },
  };
}

function buildCtx(body: any = {}, query: Record<string, any> = {}) {
  return {
    request: {
      body,
      headers: { 'user-agent': 'Mozilla/5.0 (Test Browser)' },
      ip: '127.0.0.1',
      client: { ip: '127.0.0.1' },
    },
    query,
    params: {} as any,
    body: undefined as unknown,
    badRequest(msg: string) {
      const err: any = new Error(msg);
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    },
    notFound(msg: string) {
      const err: any = new Error(msg);
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    },
    throw(status: number, msg: string) {
      const err: any = new Error(msg);
      err.status = status;
      throw err;
    },
  };
}

import feedbackController from '../feedback';

describe('feedback controller - create（访客公开提交）', () => {
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

  test('create 成功提交反馈，自动记录 IP 和 UserAgent', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;
    mockCreate.mockResolvedValue({
      id: 1, documentId: 'fb-1', name: '张三', email: 'zhang@example.com',
      message: '测试反馈', status: 'pending', ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Test Browser)',
    });

    const ctx: any = buildCtx({
      data: {
        name: '张三',
        email: 'zhang@example.com',
        message: '测试反馈',
      },
    });
    await feedbackController.create(ctx);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: '张三',
          email: 'zhang@example.com',
          message: '测试反馈',
          status: 'pending',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0 (Test Browser)',
        }),
      })
    );
    expect(ctx.body.data.documentId).toBe('fb-1');
  });

  test('create 缺少必填字段 name 时返回 400', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;

    const ctx: any = buildCtx({
      data: {
        email: 'zhang@example.com',
        message: '测试反馈',
      },
    });

    await expect(feedbackController.create(ctx)).rejects.toMatchObject({
      status: 400,
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('create 缺少必填字段 email 时返回 400', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;

    const ctx: any = buildCtx({
      data: {
        name: '张三',
        message: '测试反馈',
      },
    });

    await expect(feedbackController.create(ctx)).rejects.toMatchObject({
      status: 400,
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('create 缺少必填字段 message 时返回 400', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;

    const ctx: any = buildCtx({
      data: {
        name: '张三',
        email: 'zhang@example.com',
      },
    });

    await expect(feedbackController.create(ctx)).rejects.toMatchObject({
      status: 400,
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('create 邮箱格式错误时返回 400', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;

    const ctx: any = buildCtx({
      data: {
        name: '张三',
        email: 'not-an-email',
        message: '测试反馈',
      },
    });

    await expect(feedbackController.create(ctx)).rejects.toMatchObject({
      status: 400,
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('create name 超过 100 字符时返回 400', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;

    const ctx: any = buildCtx({
      data: {
        name: 'a'.repeat(101),
        email: 'zhang@example.com',
        message: '测试反馈',
      },
    });

    await expect(feedbackController.create(ctx)).rejects.toMatchObject({
      status: 400,
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('feedback controller - find（client-admin 分页查询）', () => {
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

  test('find 返回分页反馈列表', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;
    mockFindMany.mockResolvedValue([
      { id: 1, documentId: 'fb-1', name: '张三', status: 'pending' },
      { id: 2, documentId: 'fb-2', name: '李四', status: 'replied' },
    ]);
    mockCount.mockResolvedValue(2);

    const ctx: any = buildCtx({}, { page: '1', pageSize: '10' });
    await feedbackController.find(ctx);

    expect(ctx.body.data).toHaveLength(2);
    expect(ctx.body.meta.pagination).toMatchObject({
      page: 1,
      pageSize: 10,
      total: 2,
    });
  });

  test('find 支持状态筛选', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;
    mockFindMany.mockResolvedValue([
      { id: 1, documentId: 'fb-1', status: 'pending' },
    ]);
    mockCount.mockResolvedValue(1);

    const ctx: any = buildCtx({}, { 'filters[status]': 'pending' });
    await feedbackController.find(ctx);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          status: { $eq: 'pending' },
        }),
      })
    );
  });
});

describe('feedback controller - findOne（client-admin 详情）', () => {
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

  test('findOne 返回单个反馈详情', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;
    mockFindOne.mockResolvedValue({
      id: 1, documentId: 'fb-1', name: '张三', email: 'zhang@example.com',
      message: '测试反馈', status: 'pending',
    });

    const ctx: any = buildCtx();
    ctx.params = { documentId: 'fb-1' };
    await feedbackController.findOne(ctx);

    expect(ctx.body.data.documentId).toBe('fb-1');
  });

  test('findOne 不存在时返回 404', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;
    mockFindOne.mockResolvedValue(null);

    const ctx: any = buildCtx();
    ctx.params = { documentId: 'nonexistent' };

    await expect(feedbackController.findOne(ctx)).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('feedback controller - update（client-admin 更新状态/回复）', () => {
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

  test('update 成功更新 status 为 replied', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;
    mockFindOne.mockResolvedValue({
      id: 1, documentId: 'fb-1', status: 'pending',
    });
    mockUpdate.mockResolvedValue({
      id: 1, documentId: 'fb-1', status: 'replied', reply: '已处理',
    });

    const ctx: any = buildCtx({
      data: { status: 'replied', reply: '已处理' },
    });
    ctx.params = { documentId: 'fb-1' };
    await feedbackController.update(ctx);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'fb-1',
        data: expect.objectContaining({
          status: 'replied',
          reply: '已处理',
        }),
      })
    );
    expect(ctx.body.data.status).toBe('replied');
  });

  test('update 非法 status 值返回 400', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;
    mockFindOne.mockResolvedValue({
      id: 1, documentId: 'fb-1', status: 'pending',
    });

    const ctx: any = buildCtx({
      data: { status: 'invalid-status' },
    });
    ctx.params = { documentId: 'fb-1' };

    await expect(feedbackController.update(ctx)).rejects.toMatchObject({
      status: 400,
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('update 目标反馈不存在时返回 404', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;
    mockFindOne.mockResolvedValue(null);

    const ctx: any = buildCtx({
      data: { status: 'replied' },
    });
    ctx.params = { documentId: 'nonexistent' };

    await expect(feedbackController.update(ctx)).rejects.toMatchObject({
      status: 404,
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('update 不允许修改 name/email/message 等不可变字段（仅 status/reply）', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;
    mockFindOne.mockResolvedValue({
      id: 1, documentId: 'fb-1', status: 'pending', name: '原名', email: 'orig@example.com',
    });
    mockUpdate.mockResolvedValue({
      id: 1, documentId: 'fb-1', status: 'replied',
    });

    const ctx: any = buildCtx({
      data: {
        status: 'replied',
        name: '试图改名',
        email: 'hacker@evil.com',
        message: '试图改消息',
      },
    });
    ctx.params = { documentId: 'fb-1' };
    await feedbackController.update(ctx);

    // update 调用中应只包含 status 和 reply，不应包含 name/email/message
    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.data).toHaveProperty('status', 'replied');
    expect(updateCall.data).not.toHaveProperty('name');
    expect(updateCall.data).not.toHaveProperty('email');
    expect(updateCall.data).not.toHaveProperty('message');
  });
});
