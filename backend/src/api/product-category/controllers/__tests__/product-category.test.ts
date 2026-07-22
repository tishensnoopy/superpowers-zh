import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

const mockDbQueryFindMany = vi.fn();
const mockDocumentsDelete = vi.fn();
const mockDocumentsFindMany = vi.fn();
const mockDocumentsFindOne = vi.fn();
const mockDocumentsCreate = vi.fn();
const mockDocumentsUpdate = vi.fn();

function buildMockStrapi() {
  return {
    documents: vi.fn((uid: string) => {
      if (uid === 'api::product-category.product-category') {
        return {
          delete: mockDocumentsDelete,
          findMany: mockDocumentsFindMany,
          findOne: mockDocumentsFindOne,
          create: mockDocumentsCreate,
          update: mockDocumentsUpdate,
        };
      }
      throw new Error(`unexpected documents uid: ${uid}`);
    }),
    db: {
      query: vi.fn((uid: string) => {
        if (uid === 'api::product-category.product-category') {
          return { findMany: mockDbQueryFindMany };
        }
        throw new Error(`unexpected db.query uid: ${uid}`);
      }),
    },
    service: vi.fn(() => ({
      getCategoryTree: vi.fn(),
      reorder: vi.fn(),
      move: vi.fn(),
      hasDescendant: vi.fn(),
    })),
  };
}

function buildCtx(params: Record<string, any> = {}, body: any = {}) {
  return {
    params,
    query: {},
    request: { body },
    body: null as any,
    status: 200,
    throw(status: number, msg: string) {
      const err: any = new Error(msg);
      err.status = status;
      throw err;
    },
  };
}

import productCategoryController from '../product-category';

describe('product-category controller - delete（子分类检查）', () => {
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

  test('有子分类时返回 409', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;
    mockDbQueryFindMany.mockResolvedValueOnce([{ documentId: 'child-1' }]);

    const ctx: any = buildCtx({ id: 'parent-x' });
    await productCategoryController.delete(ctx);

    expect(ctx.status).toBe(409);
    expect(ctx.body.error.name).toBe('HasChildren');
    expect(mockDocumentsDelete).not.toHaveBeenCalled();
  });

  test('无子分类时正常删除', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;
    mockDbQueryFindMany.mockResolvedValueOnce([]);
    mockDocumentsDelete.mockResolvedValueOnce({ documentId: 'leaf-x', name: 'Leaf' });

    const ctx: any = buildCtx({ id: 'leaf-x' });
    await productCategoryController.delete(ctx);

    expect(ctx.status).toBe(200);
    expect(mockDocumentsDelete).toHaveBeenCalledWith({ documentId: 'leaf-x' });
  });
});

describe('product-category controller - slug 重复捕获', () => {
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

  test('create 时 slug 重复返回 400 DuplicateSlug', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;
    mockDocumentsCreate.mockRejectedValueOnce(
      Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' })
    );

    const ctx: any = buildCtx({}, { data: { name: 'Dup', slug: 'existing-slug' } });
    await productCategoryController.create(ctx);

    expect(ctx.status).toBe(400);
    expect(ctx.body.error.name).toBe('DuplicateSlug');
  });

  test('update 时 slug 重复返回 400 DuplicateSlug', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;
    mockDocumentsUpdate.mockRejectedValueOnce(
      Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' })
    );

    const ctx: any = buildCtx({ id: 'cat-1' }, { data: { slug: 'existing-slug' } });
    await productCategoryController.update(ctx);

    expect(ctx.status).toBe(400);
    expect(ctx.body.error.name).toBe('DuplicateSlug');
  });

  test('create 非 slug 错误时正常抛出', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;
    mockDocumentsCreate.mockRejectedValueOnce(new Error('Some other error'));

    const ctx: any = buildCtx({}, { data: { name: 'X' } });
    await expect(productCategoryController.create(ctx)).rejects.toThrow('Some other error');
  });
});
