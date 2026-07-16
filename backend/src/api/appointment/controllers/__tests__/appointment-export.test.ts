import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

const mockFindMany = vi.fn();

function buildMockStrapi() {
  return {
    documents: vi.fn((uid: string) => {
      if (uid === 'api::appointment.appointment') {
        return { findMany: mockFindMany };
      }
      throw new Error(`unexpected documents uid: ${uid}`);
    }),
  };
}

function buildCtx() {
  const headers: Record<string, string> = {};
  return {
    set(key: string, value: string) {
      headers[key] = value;
    },
    header(key: string, value: string) {
      headers[key] = value;
    },
    get headers() {
      return headers;
    },
    body: undefined as unknown,
  };
}

import appointmentController from '../appointment';

describe('appointment controller - export CSV 导出', () => {
  let originalStrapi: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    originalStrapi = (globalThis as any).strapi;
    (globalThis as any).strapi = buildMockStrapi();
  });

  afterEach(() => {
    if (originalStrapi === undefined) {
      delete (globalThis as any).strapi;
    } else {
      (globalThis as any).strapi = originalStrapi;
    }
  });

  test('返回 CSV 格式（Content-Type / Content-Disposition 正确）', async () => {
    mockFindMany.mockResolvedValue([
      {
        documentId: 'appt-1',
        parentName: '张三',
        childName: '张小明',
        phone: '13800138000',
        campus: 'chaoyang',
        course: '拼音班',
        preferredDate: '2026-01-01',
        status: 'pending',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const ctx: any = buildCtx();
    await appointmentController.export(ctx);

    // Content-Type
    expect(ctx.headers['Content-Type']).toBe('text/csv; charset=utf-8');
    // Content-Disposition 带 attachment 和 .csv 文件名
    expect(ctx.headers['Content-Disposition']).toMatch(/^attachment; filename="appointments_\d+\.csv"$/);

    // body 为字符串，首行为表头
    expect(typeof ctx.body).toBe('string');
    const lines = (ctx.body as string).split('\n');
    expect(lines[0]).toBe(
      'documentId,parentName,childName,phone,campus,course,preferredDate,status,createdAt'
    );
    // 第二行为数据，包含 documentId 与转义后的家长名
    expect(lines[1]).toContain('appt-1');
    expect(lines[1]).toContain('"张三"');
    expect(lines[1]).toContain('13800138000');
    expect(lines[1]).toContain('chaoyang');
    expect(lines[1]).toContain('pending');
  });

  test('数据行中双引号被转义为两个双引号', async () => {
    mockFindMany.mockResolvedValue([
      {
        documentId: 'appt-2',
        parentName: '含"引号"的家长',
        childName: '孩子',
        phone: '13900000000',
        campus: 'haidian',
        course: '课程"名"',
        preferredDate: '',
        status: 'confirmed',
        createdAt: '2026-02-02T00:00:00.000Z',
      },
    ]);

    const ctx: any = buildCtx();
    await appointmentController.export(ctx);

    const lines = (ctx.body as string).split('\n');
    expect(lines[1]).toContain('"含""引号""的家长"');
    expect(lines[1]).toContain('"课程""名"""');
  });

  test('空结果集只返回表头行', async () => {
    mockFindMany.mockResolvedValue([]);

    const ctx: any = buildCtx();
    await appointmentController.export(ctx);

    const lines = (ctx.body as string).split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(
      'documentId,parentName,childName,phone,campus,course,preferredDate,status,createdAt'
    );
  });

  test('findMany 调用参数含 limit=1000 与按 createdAt desc 排序', async () => {
    mockFindMany.mockResolvedValue([]);

    const ctx: any = buildCtx();
    await appointmentController.export(ctx);

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    const arg = mockFindMany.mock.calls[0][0];
    expect(arg.limit).toBe(1000);
    expect(arg.sort).toBe('createdAt:desc');
  });
});
