import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

const mockFindMany = vi.fn();
const mockFindOne = vi.fn();
const mockCount = vi.fn();

function buildMockStrapi() {
  return {
    documents: vi.fn((uid: string) => {
      if (uid === 'api::appointment.appointment') {
        return { findMany: mockFindMany, findOne: mockFindOne };
      }
      throw new Error(`unexpected documents uid: ${uid}`);
    }),
    db: {
      query: vi.fn((uid: string) => {
        if (uid === 'api::appointment.appointment') {
          return { count: mockCount };
        }
        throw new Error(`unexpected db.query uid: ${uid}`);
      }),
    },
  };
}

function buildCtx(query: Record<string, any> = {}) {
  return {
    request: { body: {} },
    query,
    body: undefined as unknown,
    throw(status: number, msg: string) {
      const err: any = new Error(msg);
      err.status = status;
      throw err;
    },
    state: { user: { role: { type: 'authenticated' } } } as any,
  };
}

import appointmentController from '../appointment';

describe('appointment controller - find（client-admin 可访问）', () => {
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

  test('find 返回预约列表', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;
    mockFindMany.mockResolvedValue([
      { id: 1, documentId: 'appt-1', parentName: '张三', status: 'pending' },
      { id: 2, documentId: 'appt-2', parentName: '李四', status: 'confirmed' },
    ]);
    mockCount.mockResolvedValue(2);
    const ctx: any = buildCtx({ page: '1', pageSize: '10' });
    await appointmentController.find(ctx);
    expect(ctx.body.data).toHaveLength(2);
  });

  test('find 支持状态筛选', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;
    mockFindMany.mockResolvedValue([{ id: 1, documentId: 'appt-1', status: 'pending' }]);
    mockCount.mockResolvedValue(1);
    const ctx: any = buildCtx({ 'filters[status]': 'pending' });
    await appointmentController.find(ctx);
    expect(mockFindMany).toHaveBeenCalled();
  });

  test('findOne 返回单个预约详情', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;
    mockFindOne.mockResolvedValue({
      id: 1, documentId: 'appt-1', parentName: '张三', childName: '张小明',
      phone: '13800138000', campus: 'chaoyang', status: 'pending',
    });
    const ctx: any = buildCtx({});
    ctx.params = { documentId: 'appt-1' };
    await appointmentController.findOne(ctx);
    expect(ctx.body.data.documentId).toBe('appt-1');
  });
});
