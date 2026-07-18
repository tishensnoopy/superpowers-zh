import { describe, it, expect, vi } from 'vitest';
import index from '../index';
import { SYNCED_UIDS } from '../services/knowledge-sync-service';

describe('register() 生命周期订阅', () => {
  it('订阅的 UID 与 knowledge-sync-service.SYNCED_UIDS 完全一致（防 UID 漂移）', async () => {
    const subscribe = vi.fn();
    const strapi: any = { db: { lifecycles: { subscribe } } };

    await index.register({ strapi });

    expect(subscribe).toHaveBeenCalledTimes(SYNCED_UIDS.length);
    const models = subscribe.mock.calls.map((c) => c[0].models[0]).sort();
    expect(models).toEqual([...SYNCED_UIDS].sort());
    // 回归：历史上的 bug——注册了不存在的 api::course.course
    expect(models).toContain('api::product.product');
    expect(models).not.toContain('api::course.course');
  });

  it('每个订阅都挂 afterCreate/afterUpdate/afterDelete 三个钩子', async () => {
    const subscribe = vi.fn();
    const strapi: any = { db: { lifecycles: { subscribe } } };

    await index.register({ strapi });

    for (const call of subscribe.mock.calls) {
      const subscriber = call[0];
      expect(typeof subscriber.afterCreate).toBe('function');
      expect(typeof subscriber.afterUpdate).toBe('function');
      expect(typeof subscriber.afterDelete).toBe('function');
    }
  });

  it('生命周期钩子以 published 状态为准 reconcile（draft 事件不产生 KB 文档）', async () => {
    let captured: any = null;
    const subscribe = vi.fn((s: any) => {
      if (s.models[0] === 'api::product.product') captured = s;
    });
    const findOnePublished = vi.fn().mockResolvedValue(null); // 无 published 版本（草稿）
    const findOneKb = vi.fn().mockResolvedValue(null); // KB 中也没有
    const createKb = vi.fn();
    const strapi: any = {
      db: {
        lifecycles: { subscribe },
        query: vi.fn(() => ({ findOne: findOneKb })),
      },
      documents: vi.fn((uid: string) => {
        if (uid === 'api::knowledge-base.knowledge-base') return { create: createKb };
        return { findOne: findOnePublished };
      }),
      service: vi.fn(() => ({ deleteVectors: vi.fn() })),
    };

    await index.register({ strapi });
    expect(captured).not.toBeNull();

    // 模拟后台"保存草稿"触发 afterCreate
    await captured.afterCreate({ result: { documentId: 'p1', locale: 'zh-CN', name: '草稿课程' } });

    expect(findOnePublished).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: 'p1', status: 'published' })
    );
    expect(createKb).not.toHaveBeenCalled();
  });
});
