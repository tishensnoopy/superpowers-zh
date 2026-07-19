import { describe, it, expect, vi } from 'vitest';
import { ensureKbSchema, KB_SOURCE_URL_UNIQUE_INDEX_SQL } from '../kb-schema';

describe('kb-schema.ensureKbSchema', () => {
  it('按序执行：CREATE EXTENSION → CREATE TABLE → 两个 CREATE INDEX', async () => {
    const raw = vi.fn().mockResolvedValue({});
    const strapi: any = { db: { connection: { raw } } };

    await ensureKbSchema(strapi);

    const sqls = raw.mock.calls.map((c) => String(c[0]));
    expect(sqls.length).toBe(4);
    expect(sqls[0]).toContain('CREATE EXTENSION IF NOT EXISTS vector');
    expect(sqls[1]).toContain('CREATE TABLE IF NOT EXISTS knowledge_embeddings');
    expect(sqls[1]).toContain('knowledge_base_id BIGINT NOT NULL');
    expect(sqls[1]).toContain('embedding vector');
    expect(sqls[2]).toContain('idx_knowledge_embeddings_kb_id');
    expect(sqls[3]).toBe(KB_SOURCE_URL_UNIQUE_INDEX_SQL);
  });

  it('CREATE EXTENSION 失败（非 superuser）只告警不中断，后续 DDL 照常执行', async () => {
    const raw = vi.fn()
      .mockRejectedValueOnce(new Error('permission denied'))
      .mockResolvedValue({});
    const strapi: any = { db: { connection: { raw } } };

    await expect(ensureKbSchema(strapi)).resolves.toBeUndefined();
    expect(raw).toHaveBeenCalledTimes(4);
  });

  it('source_url 唯一索引是部分索引（WHERE source_url IS NOT NULL，放行手工文档）', () => {
    expect(KB_SOURCE_URL_UNIQUE_INDEX_SQL).toContain('UNIQUE INDEX IF NOT EXISTS');
    expect(KB_SOURCE_URL_UNIQUE_INDEX_SQL).toContain('source_url');
    expect(KB_SOURCE_URL_UNIQUE_INDEX_SQL).toContain('WHERE source_url IS NOT NULL');
  });

  it('CREATE TABLE 失败必须抛错中断（fail-fast，不得静默吞掉 schema 错误）', async () => {
    const raw = vi.fn()
      .mockResolvedValueOnce({}) // EXTENSION 成功
      .mockRejectedValueOnce(new Error('syntax error')); // TABLE 失败
    const strapi: any = { db: { connection: { raw } } };

    await expect(ensureKbSchema(strapi)).rejects.toThrow('syntax error');
  });

  it('source_url 有历史重复值时抛出带去重指引的诊断错误', async () => {
    const raw = vi.fn()
      .mockResolvedValueOnce({}) // EXTENSION
      .mockResolvedValueOnce({}) // TABLE
      .mockResolvedValueOnce({}) // kb_id index
      .mockRejectedValueOnce(
        new Error('could not create unique index "knowledge_bases_source_url_unique"')
      ); // unique index 失败
    const strapi: any = { db: { connection: { raw } } };

    try {
      await ensureKbSchema(strapi);
      expect.unreachable('should have thrown');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).toMatch(/历史重复值/);
      expect(msg).toMatch(/GROUP BY source_url/);
    }
  });
});
