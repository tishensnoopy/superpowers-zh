import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// mock count：根据 where 参数返回不同值，模拟按状态/日期分组的计数
const mockCount = vi.fn();

function buildMockStrapi() {
  return {
    db: {
      query: vi.fn((uid: string) => {
        // 所有 uid 共用同一个 mockCount，测试中按 where 区分返回值
        return { count: mockCount };
      }),
    },
  };
}

function buildCtx() {
  return {
    body: undefined as unknown,
  };
}

import statsController from '../stats';

describe('stats controller', () => {
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

  describe('appointments', () => {
    test('返回 total + byStatus(4 个状态) + dailyTrend(7 天)', async () => {
      // mockCount 调用序列：
      //   1 次 total (where={})
      //   4 次 byStatus (pending/confirmed/completed/cancelled)
      //   7 次 dailyTrend
      // 共 12 次
      const counts = [
        100, // total
        10, // pending
        20, // confirmed
        50, // completed
        20, // cancelled
        1, 2, 3, 4, 5, 6, 7, // dailyTrend 7 天
      ];
      counts.forEach((c) => mockCount.mockResolvedValueOnce(c));

      const ctx: any = buildCtx();
      await statsController.appointments(ctx);

      expect(ctx.body.data.total).toBe(100);
      expect(ctx.body.data.byStatus).toEqual({
        pending: 10,
        confirmed: 20,
        completed: 50,
        cancelled: 20,
      });
      expect(ctx.body.data.dailyTrend).toHaveLength(7);
      // dailyTrend 每项包含 date 和 count
      expect(ctx.body.data.dailyTrend[0]).toHaveProperty('date');
      expect(ctx.body.data.dailyTrend[0]).toHaveProperty('count');
      // 7 天计数按时间升序（最早一天在前）
      expect(ctx.body.data.dailyTrend.map((d: any) => d.count)).toEqual([1, 2, 3, 4, 5, 6, 7]);

      // 共调用 12 次 count
      expect(mockCount).toHaveBeenCalledTimes(12);
      // 第一次为 total（无 where 过滤）
      expect(mockCount.mock.calls[0][0]).toEqual({});
      // byStatus 调用带 where:{status}
      expect(mockCount.mock.calls[1][0]).toEqual({ where: { status: 'pending' } });
    });

    test('dailyTrend 日期为 YYYY-MM-DD 且升序', async () => {
      for (let i = 0; i < 12; i++) mockCount.mockResolvedValueOnce(0);

      const ctx: any = buildCtx();
      await statsController.appointments(ctx);

      const dates = ctx.body.data.dailyTrend.map((d: any) => d.date);
      // 日期升序（字符串比较等价于日期升序，因 ISO YYYY-MM-DD）
      const sorted = [...dates].sort();
      expect(dates).toEqual(sorted);
      // 格式 YYYY-MM-DD
      expect(dates[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('feedbacks', () => {
    test('返回 total + byStatus(3 个状态)', async () => {
      const counts = [
        50, // total
        15, // pending
        25, // replied
        10, // closed
      ];
      counts.forEach((c) => mockCount.mockResolvedValueOnce(c));

      const ctx: any = buildCtx();
      await statsController.feedbacks(ctx);

      expect(ctx.body.data.total).toBe(50);
      expect(ctx.body.data.byStatus).toEqual({
        pending: 15,
        replied: 25,
        closed: 10,
      });
      // 1 total + 3 byStatus = 4 次
      expect(mockCount).toHaveBeenCalledTimes(4);
    });
  });

  describe('overview', () => {
    test('返回 6 个内容类型的计数', async () => {
      // appointment/feedback/product/news-article/teacher/knowledge-base
      const counts = [100, 50, 30, 20, 10, 40];
      counts.forEach((c) => mockCount.mockResolvedValueOnce(c));

      const ctx: any = buildCtx();
      await statsController.overview(ctx);

      expect(ctx.body.data).toEqual({
        appointment: 100,
        feedback: 50,
        product: 30,
        'news-article': 20,
        teacher: 10,
        'knowledge-base': 40,
      });
      expect(mockCount).toHaveBeenCalledTimes(6);
    });
  });
});
