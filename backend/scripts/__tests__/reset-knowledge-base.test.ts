import { describe, it, expect, vi } from 'vitest';
import { resetKnowledgeBase } from '../reset-knowledge-base';

describe('reset-knowledge-base KB 注入隔离兜底', () => {
  it('默认模式：清空 knowledge_bases + knowledge_embeddings（幂等，空表不报错）', async () => {
    const raw = vi.fn().mockResolvedValue({});
    const findMany = vi.fn().mockResolvedValue([]);
    const strapi: any = {
      db: { connection: { raw }, query: vi.fn(() => ({ findMany })) },
    };

    const result = await resetKnowledgeBase(strapi);

    const sqls = raw.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => /DELETE FROM knowledge_bases/i.test(s))).toBe(true);
    expect(sqls.some((s) => /DELETE FROM knowledge_embeddings/i.test(s))).toBe(true);
    expect(result).toEqual({ cleared: true, synced: 0, updated: 0, removed: 0, errors: [] });
  });

  it('--rebuild：清空后调 syncWebsiteContent 重建为 published 镜像', async () => {
    const raw = vi.fn().mockResolvedValue({});
    const strapi: any = { db: { connection: { raw }, query: vi.fn() } };
    const syncWebsiteContent = vi.fn().mockResolvedValue({ synced: 42, updated: 0, removed: 0, errors: [] });

    const result = await resetKnowledgeBase(strapi, { rebuild: true, syncWebsiteContent });

    expect(syncWebsiteContent).toHaveBeenCalledWith(strapi);
    expect(result).toEqual({ cleared: true, synced: 42, updated: 0, removed: 0, errors: [] });
  });

  it('缺 rebuild 依赖却传 --rebuild：抛错且不执行任何删除', async () => {
    const raw = vi.fn().mockResolvedValue({});
    const strapi: any = { db: { connection: { raw }, query: vi.fn() } };

    await expect(resetKnowledgeBase(strapi, { rebuild: true })).rejects.toThrow(/syncWebsiteContent/);
    expect(raw).not.toHaveBeenCalled();
  });
});
