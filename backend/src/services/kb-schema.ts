/**
 * knowledge_embeddings（pgvector 裸表）与 knowledge_bases.source_url 唯一索引的
 * DDL 单一事实来源。bootstrap 自检（bootstrap-health）与向量化 worker
 * （document-processor.ensureSchema）共用，禁止各自另写 DDL。
 */

export const KB_SOURCE_URL_UNIQUE_INDEX_SQL =
  'CREATE UNIQUE INDEX IF NOT EXISTS knowledge_bases_source_url_unique ON knowledge_bases (source_url) WHERE source_url IS NOT NULL';

export async function ensureKbSchema(strapi: any): Promise<void> {
  const db = strapi.db.connection;

  try {
    await db.raw('CREATE EXTENSION IF NOT EXISTS vector');
  } catch (err) {
    // 扩展可能已存在或需要 superuser；建表/插入会暴露更明确的错误
    console.warn(
      '[kb-schema] CREATE EXTENSION vector skipped:',
      err instanceof Error ? err.message : err
    );
  }

  await db.raw(`
    CREATE TABLE IF NOT EXISTS knowledge_embeddings (
      id BIGSERIAL PRIMARY KEY,
      knowledge_base_id BIGINT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      embedding vector,
      source_type VARCHAR(50) DEFAULT 'document',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.raw(
    'CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_kb_id ON knowledge_embeddings (knowledge_base_id)'
  );

  // content-sync 防重复（NULL 放行：manual/pdf 等手工文档无 sourceUrl）
  try {
    await db.raw(KB_SOURCE_URL_UNIQUE_INDEX_SQL);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('could not create unique index') || msg.includes('duplicate key')) {
      // 历史脏数据挡住了唯一索引：给出可操作的诊断，而不是让 worker 裸 PG 报错瘫痪
      throw new Error(
        `[kb-schema] knowledge_bases.source_url 存在历史重复值，唯一索引创建失败。` +
          `请先执行去重预检：SELECT source_url, COUNT(*) FROM knowledge_bases WHERE source_url IS NOT NULL GROUP BY source_url HAVING COUNT(*) > 1; ` +
          `去重后重启即可自动重试。原始错误: ${msg}`
      );
    }
    throw err;
  }

  console.log('[kb-schema] knowledge_embeddings + source_url index ensured');
}
