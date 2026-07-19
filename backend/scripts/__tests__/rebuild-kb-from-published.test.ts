import { describe, it, expect, vi } from 'vitest';
import { rebuildKbFromPublished } from '../rebuild-kb-from-published';

describe('rebuild-kb-from-published 服务器清理重建', () => {
  function makeStrapi() {
    const raw = vi.fn().mockResolvedValue({});
    const deleteKb = vi.fn().mockResolvedValue({});
    const findManyKb = vi.fn()
      // 第 1 次调用：content-sync 全量（待删）
      .mockResolvedValueOnce([{ id: 1, documentId: 'kb-sync-1' }, { id: 2, documentId: 'kb-sync-2' }])
      // 第 2 次调用：英文模板种子（待删）
      .mockResolvedValueOnce([{ id: 9, documentId: 'kb-seed-1' }])
      // 第 3 次调用：重建后全部 pending（待向量化）
      .mockResolvedValueOnce([{ id: 101 }, { id: 102 }, { id: 103 }]);
    const strapi: any = {
      db: {
        connection: { raw },
        query: vi.fn(() => ({ findMany: findManyKb })),
      },
      documents: vi.fn(() => ({ delete: deleteKb })),
    };
    return { strapi, raw, deleteKb, findManyKb };
  }

  it('执行顺序：删 content-sync+种子 → 建唯一索引 → 镜像同步 → 清空 embeddings → 全量重向量化', async () => {
    const { strapi, raw, deleteKb } = makeStrapi();
    const syncWebsiteContent = vi.fn().mockResolvedValue({ synced: 60, updated: 0, removed: 0, errors: [] });
    const queueAdd = vi.fn().mockResolvedValue({ id: 'job-1' });

    const result = await rebuildKbFromPublished(strapi, {
      syncWebsiteContent,
      queueAdd,
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    // 删了 2 条 content-sync + 1 条种子
    expect(deleteKb).toHaveBeenCalledTimes(3);
    // 建了唯一索引（部分索引，允许 NULL）
    const indexSql = raw.mock.calls.map((c) => String(c[0])).find((s) => s.includes('UNIQUE INDEX'));
    expect(indexSql).toBeTruthy();
    expect(indexSql).toContain('source_url');
    expect(indexSql).toContain('IF NOT EXISTS');
    // 镜像同步被调用
    expect(syncWebsiteContent).toHaveBeenCalledWith(strapi);
    // 清空了 embeddings
    const deleteEmb = raw.mock.calls.map((c) => String(c[0])).find((s) => /DELETE FROM knowledge_embeddings/i.test(s));
    expect(deleteEmb).toBeTruthy();
    // 3 条 pending 全部入队
    expect(queueAdd).toHaveBeenCalledTimes(3);
    expect(queueAdd).toHaveBeenCalledWith('document-processing', { knowledgeBaseId: 101, type: 'revectorize' });
    // embeddings 清空后全部文档被置回 pending（含 ready 的手工文档）
    const updateSql = raw.mock.calls.map((c) => String(c[0])).find((s) => /UPDATE knowledge_bases SET status/i.test(s));
    expect(updateSql).toBeTruthy();
    expect(result).toEqual({ deleted: 3, synced: 60, updated: 0, removed: 0, errors: [], queued: 3 });
  });

  it('同步报错不阻断向量化入队', async () => {
    const { strapi } = makeStrapi();
    const syncWebsiteContent = vi.fn().mockResolvedValue({ synced: 0, updated: 0, removed: 0, errors: ['课程[zh-CN]: boom'] });
    const queueAdd = vi.fn().mockResolvedValue({ id: 'job-1' });

    const result = await rebuildKbFromPublished(strapi, {
      syncWebsiteContent,
      queueAdd,
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    expect(result.errors).toEqual(['课程[zh-CN]: boom']);
    expect(queueAdd).toHaveBeenCalledTimes(3);
  });

  it('embeddings 清空后全部文档（含 ready 手工文档）置回 pending 并入队', async () => {
    const { strapi, raw } = makeStrapi();
    const syncWebsiteContent = vi.fn().mockResolvedValue({ synced: 2, updated: 0, removed: 0, errors: [] });
    const queueAdd = vi.fn().mockResolvedValue({ id: 'job-1' });

    await rebuildKbFromPublished(strapi, {
      syncWebsiteContent,
      queueAdd,
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    const updateSql = raw.mock.calls.map((c) => String(c[0])).find((s) => /UPDATE knowledge_bases SET status/i.test(s));
    expect(updateSql).toBeTruthy();
    expect(queueAdd).toHaveBeenCalledTimes(3);
  });

  it('source_url 有重复值时预检抛错，不执行任何删除', async () => {
    const { strapi, raw, deleteKb } = makeStrapi();
    raw.mockReset();
    raw.mockResolvedValueOnce({ rows: [{ source_url: 'strapi://x', cnt: 2 }] });

    await expect(
      rebuildKbFromPublished(strapi, {
        syncWebsiteContent: vi.fn(),
        queueAdd: vi.fn(),
        sleep: vi.fn(),
      })
    ).rejects.toThrow(/重复值/);
    expect(deleteKb).not.toHaveBeenCalled();
  });
});
