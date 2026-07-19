/**
 * 服务器 KB 清理重建（一次性修复脚本，幂等）。
 *
 * 背景：KB 中混入 ① 硬编码英文模板种子 ② 无来源孤儿文档 ③ 异常重试产生的重复文档，
 * 且历史同步未过滤草稿。本脚本把 KB 恢复为"后台 published 内容的精确镜像"：
 *   1. 删除全部 content-sync 文档（稍后由镜像同步重建）
 *   2. 删除硬编码英文模板种子（3 个固定标题）
 *   3. 给 knowledge_bases.source_url 建唯一部分索引（防重复，NULL 放行手工文档）
 *   4. 跑 syncWebsiteContent 镜像同步（published-only）
 *   5. 清空 knowledge_embeddings（向量全量重建，避免新旧混杂）
 *   6. 全部 pending 文档入队重向量化（100ms 限速）
 *
 * 用法（backend 容器内）：npx tsx scripts/rebuild-kb-from-published.ts
 * 依赖注入设计（同 resync-knowledge-base.ts），函数体可单测。
 */

interface RebuildOptions {
  syncWebsiteContent: (strapi: any) => Promise<{ synced: number; updated: number; removed: number; errors: string[] }>;
  queueAdd: (queueName: string, data: any) => Promise<{ id: string }>;
  sleep?: (ms: number) => Promise<void>;
}

const SEED_TITLES = ['Introduction to Our Company', 'Product FAQ', 'Technical Documentation'];

export async function rebuildKbFromPublished(
  strapi: any,
  options: RebuildOptions
): Promise<{ deleted: number; synced: number; updated: number; removed: number; errors: string[]; queued: number }> {
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const db = strapi.db.connection;

  // 步骤 1：删除全部 content-sync 文档（镜像同步会重建它们）
  console.log('[rebuild-kb] Step 1: deleting all content-sync documents...');
  const syncDocs = await strapi.db
    .query('api::knowledge-base.knowledge-base')
    .findMany({ where: { sourceType: 'content-sync' }, limit: 10000 });
  for (const doc of syncDocs) {
    await strapi.documents('api::knowledge-base.knowledge-base').delete({ documentId: doc.documentId });
  }
  console.log(`[rebuild-kb] Deleted ${syncDocs.length} content-sync documents`);

  // 步骤 2：删除硬编码英文模板种子
  console.log('[rebuild-kb] Step 2: deleting hardcoded seed documents...');
  const seedDocs = await strapi.db
    .query('api::knowledge-base.knowledge-base')
    .findMany({ where: { title: { $in: SEED_TITLES } }, limit: 100 });
  for (const doc of seedDocs) {
    await strapi.documents('api::knowledge-base.knowledge-base').delete({ documentId: doc.documentId });
  }
  console.log(`[rebuild-kb] Deleted ${seedDocs.length} seed documents`);

  // 步骤 3：source_url 唯一部分索引（NULL 放行：manual/pdf 等手工文档无 sourceUrl）
  console.log('[rebuild-kb] Step 3: creating unique index on source_url...');
  await db.raw(
    'CREATE UNIQUE INDEX IF NOT EXISTS knowledge_bases_source_url_unique ON knowledge_bases (source_url) WHERE source_url IS NOT NULL'
  );

  // 步骤 4：镜像同步（published-only，含孤儿回收）
  console.log('[rebuild-kb] Step 4: mirror syncing website content...');
  const { synced, updated, removed, errors } = await options.syncWebsiteContent(strapi);
  console.log(`[rebuild-kb] Sync: ${synced} new, ${updated} updated, ${removed} removed, ${errors.length} errors`);
  if (errors.length > 0) console.error('[rebuild-kb] Sync errors:', errors);

  // 步骤 5：清空 embeddings（向量全量重建）
  console.log('[rebuild-kb] Step 5: wiping knowledge_embeddings...');
  await db.raw('DELETE FROM knowledge_embeddings');

  // 步骤 6：全部 pending 文档入队重向量化（限速 100ms）
  console.log('[rebuild-kb] Step 6: queueing pending documents for vectorization...');
  const pending = await strapi.db
    .query('api::knowledge-base.knowledge-base')
    .findMany({ where: { status: 'pending' }, limit: 10000 });
  let queued = 0;
  for (const record of pending) {
    await options.queueAdd('document-processing', { knowledgeBaseId: record.id, type: 'revectorize' });
    queued++;
    await sleep(100);
  }
  console.log(`[rebuild-kb] Done: queued ${queued} documents`);

  return { deleted: syncDocs.length + seedDocs.length, synced, updated, removed, errors, queued };
}

// CLI 入口
async function main() {
  const { createStrapi } = await import('@strapi/strapi');
  const strapi = await createStrapi().load();

  const { syncWebsiteContent } = await import('../src/services/knowledge-sync-service');
  const { documentQueue } = await import('../src/queues/document-processor');

  try {
    const result = await rebuildKbFromPublished(strapi, {
      syncWebsiteContent,
      queueAdd: async (queueName: string, data: any) => documentQueue.add('process', data),
    });
    console.log('[rebuild-kb] Result:', result);
  } finally {
    await strapi.destroy();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
