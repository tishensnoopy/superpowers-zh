/**
 * KB 注入隔离兜底（决策 D7）。
 *
 * 主路径：provision-new-customer.sh 一键开通在 dump 时排除 knowledge_bases，
 * 新实例 KB 从空开始，由镜像同步自动派生，母站内容零泄漏。
 * 本脚本是兜底路径：手工复制数据库/意外带入母站 KB 时，交付前清空重来。
 *
 * 用法（backend 容器内）：
 *   npx tsx scripts/reset-knowledge-base.ts              # 清空 KB + embeddings
 *   npx tsx scripts/reset-knowledge-base.ts --rebuild    # 清空 + 重建为 published 镜像
 *
 * 幂等：空表上执行不报错。依赖注入设计（同 resync-knowledge-base.ts），函数体可单测。
 */

interface ResetOptions {
  rebuild?: boolean;
  syncWebsiteContent?: (strapi: any) => Promise<{ synced: number; updated: number; removed: number; errors: string[] }>;
}

export async function resetKnowledgeBase(
  strapi: any,
  options: ResetOptions = {}
): Promise<{ cleared: boolean; synced: number; updated: number; removed: number; errors: string[] }> {
  if (options.rebuild && !options.syncWebsiteContent) {
    throw new Error('--rebuild 模式必须注入 syncWebsiteContent（CLI main 会自动注入；测试/调用方需显式传入）');
  }

  const db = strapi.db.connection;

  console.log('[reset-kb] Clearing knowledge_bases + knowledge_embeddings...');
  await db.raw('DELETE FROM knowledge_bases');
  await db.raw('DELETE FROM knowledge_embeddings');
  console.log('[reset-kb] Cleared.');

  if (!options.rebuild) {
    return { cleared: true, synced: 0, updated: 0, removed: 0, errors: [] };
  }

  console.log('[reset-kb] Rebuilding from published content...');
  const { synced, updated, removed, errors } = await options.syncWebsiteContent!(strapi);
  console.log(`[reset-kb] Rebuild: ${synced} new, ${updated} updated, ${removed} removed, ${errors.length} errors`);
  if (errors.length > 0) console.error('[reset-kb] Sync errors:', errors);
  return { cleared: true, synced, updated, removed, errors };
}

// CLI 入口
async function main() {
  const rebuild = process.argv.includes('--rebuild');
  const { createStrapi } = await import('@strapi/strapi');
  const strapi = await createStrapi().load();

  try {
    const syncWebsiteContent = rebuild
      ? (await import('../src/services/knowledge-sync-service')).syncWebsiteContent
      : undefined;
    const result = await resetKnowledgeBase(strapi, { rebuild, syncWebsiteContent });
    console.log('[reset-kb] Result:', result);
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
