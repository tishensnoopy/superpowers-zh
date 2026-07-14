import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock controller import will be available after implementation
let translationController: any;
let originalApiKey: string | undefined;

beforeEach(async () => {
  vi.resetModules();
  // Controller checks process.env.DASHSCOPE_API_KEY before calling the
  // translation service. Set it so tests that mock the service can reach
  // the service call path.
  originalApiKey = process.env.DASHSCOPE_API_KEY;
  process.env.DASHSCOPE_API_KEY = 'test-key';
  translationController = (await import('../translation')).default;
});

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.DASHSCOPE_API_KEY;
  } else {
    process.env.DASHSCOPE_API_KEY = originalApiKey;
  }
});

describe('POST /api/translation/assist', () => {
  function buildCtx(body: any, isAdmin = true): any {
    return {
      request: { body },
      body: null as any,
      // In real Koa, ctx.throw throws and middleware catches it. In unit tests
      // we just record the call — the controller's `return;` after ctx.throw
      // handles control flow. This lets us assert ctx.throw was called.
      throw: vi.fn(),
      state: { user: isAdmin ? { roles: [{ name: 'strapi-super-admin' }] } : null },
    };
  }

  it('returns 400 when contentType is not in whitelist', async () => {
    const ctx = buildCtx({
      sourceLocale: 'zh-CN',
      targetLocale: 'en-US',
      contentType: 'malicious-type',
      documentId: 'doc1',
      fields: ['name'],
    });
    await translationController.assist(ctx);
    expect(ctx.throw).toHaveBeenCalledWith(400, expect.stringContaining('INVALID_PARAMS'));
  });

  it('returns 400 when fields is empty', async () => {
    const ctx = buildCtx({
      sourceLocale: 'zh-CN',
      targetLocale: 'en-US',
      contentType: 'products',
      documentId: 'doc1',
      fields: [],
    });
    await translationController.assist(ctx);
    expect(ctx.throw).toHaveBeenCalledWith(400, expect.stringContaining('INVALID_PARAMS'));
  });

  it('returns 400 when documentId missing', async () => {
    const ctx = buildCtx({
      sourceLocale: 'zh-CN',
      targetLocale: 'en-US',
      contentType: 'products',
      fields: ['name'],
    });
    await translationController.assist(ctx);
    expect(ctx.throw).toHaveBeenCalledWith(400, expect.stringContaining('INVALID_PARAMS'));
  });

  it('returns 403 when non-admin user', async () => {
    const ctx = buildCtx(
      {
        sourceLocale: 'zh-CN',
        targetLocale: 'en-US',
        contentType: 'products',
        documentId: 'doc1',
        fields: ['name'],
      },
      false
    );
    await translationController.assist(ctx);
    expect(ctx.throw).toHaveBeenCalledWith(403, expect.stringContaining('FORBIDDEN'));
  });

  it('returns 404 when documentId not found in zh-CN', async () => {
    vi.doMock('../../services/translation', () => ({
      translateDocument: vi.fn().mockResolvedValue(null),
    }));
    vi.stubGlobal('strapi', {
      documents: vi.fn().mockReturnValue({
        findOne: vi.fn().mockResolvedValue(null),
      }),
    });

    const ctx = buildCtx({
      sourceLocale: 'zh-CN',
      targetLocale: 'en-US',
      contentType: 'products',
      documentId: 'nonexistent',
      fields: ['name'],
    });
    await translationController.assist(ctx);
    expect(ctx.throw).toHaveBeenCalledWith(404, expect.stringContaining('SOURCE_NOT_FOUND'));
  });

  it('returns translation draft on success', async () => {
    vi.doMock('../../services/translation', () => ({
      translateDocument: vi.fn().mockResolvedValue({
        name: 'English Name',
        description: 'English description',
      }),
    }));
    vi.stubGlobal('strapi', {
      documents: vi.fn().mockReturnValue({
        findOne: vi.fn().mockResolvedValue({ documentId: 'doc1', name: '中文名' }),
      }),
    });

    const ctx = buildCtx({
      sourceLocale: 'zh-CN',
      targetLocale: 'en-US',
      contentType: 'products',
      documentId: 'doc1',
      fields: ['name', 'description'],
    });
    await translationController.assist(ctx);
    expect(ctx.body).toEqual({
      translations: { name: 'English Name', description: 'English description' },
    });
  });

  it('returns 502 when DashScope fails', async () => {
    vi.doMock('../../services/translation', () => ({
      translateDocument: vi.fn().mockRejectedValue(new Error('DashScope timeout')),
    }));
    vi.stubGlobal('strapi', {
      documents: vi.fn().mockReturnValue({
        findOne: vi.fn().mockResolvedValue({ documentId: 'doc1', name: '中文名' }),
      }),
    });

    const ctx = buildCtx({
      sourceLocale: 'zh-CN',
      targetLocale: 'en-US',
      contentType: 'products',
      documentId: 'doc1',
      fields: ['name'],
    });
    await translationController.assist(ctx);
    expect(ctx.throw).toHaveBeenCalledWith(502, expect.stringContaining('AI_PROVIDER_ERROR'));
  });

  it('returns 502 when AI returns JSON missing fields', async () => {
    vi.doMock('../../services/translation', () => ({
      translateDocument: vi.fn().mockResolvedValue({ name: 'English' }), // missing description
    }));
    vi.stubGlobal('strapi', {
      documents: vi.fn().mockReturnValue({
        findOne: vi.fn().mockResolvedValue({ documentId: 'doc1', name: '中文名' }),
      }),
    });

    const ctx = buildCtx({
      sourceLocale: 'zh-CN',
      targetLocale: 'en-US',
      contentType: 'products',
      documentId: 'doc1',
      fields: ['name', 'description'],
    });
    await translationController.assist(ctx);
    expect(ctx.throw).toHaveBeenCalledWith(502, expect.stringContaining('AI_RESPONSE_INCOMPLETE'));
  });
});
