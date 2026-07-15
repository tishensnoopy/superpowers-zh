/**
 * Resync knowledge base: re-serialize all content-sync records and trigger
 * re-vectorization.
 *
 * This script is idempotent:
 * - syncWebsiteContent uses sourceUrl dedup → update existing records
 * - Re-running re-sets all content-sync records to 'pending' and re-queues them
 * - Worker 'revectorize' action deletes old embeddings before inserting new ones
 *
 * Usage (from backend/):
 *   npx tsx scripts/resync-knowledge-base.ts
 *
 * Requirements:
 * - Strapi instance running
 * - Redis available (for BullMQ queue)
 * - DashScope API available (for embedding generation)
 */

interface ResyncOptions {
  syncWebsiteContent: (strapi: any) => Promise<{ synced: number; updated: number; errors: string[] }>;
  queueAdd: (queueName: string, data: any) => Promise<{ id: string }>;
}

export async function resyncKnowledgeBase(
  strapi: any,
  options: ResyncOptions
): Promise<{ synced: number; updated: number; errors: string[]; queued: number }> {
  // Step 1: Re-sync all content types (updates existing records, creates new ones)
  console.log('[resync-knowledge-base] Step 1: Syncing website content...');
  const { synced, updated, errors } = await options.syncWebsiteContent(strapi);
  console.log(`[resync-knowledge-base] Sync: ${synced} new, ${updated} updated, ${errors.length} errors`);

  if (errors.length > 0) {
    console.error('[resync-knowledge-base] Sync errors:', errors);
  }

  // Step 2: Find all pending content-sync records and queue for re-vectorization
  console.log('[resync-knowledge-base] Step 2: Queueing pending records for re-vectorization...');
  const pendingRecords = await strapi.db
    .query('api::knowledge-base.knowledge-base')
    .findMany({
      where: { sourceType: 'content-sync', status: 'pending' },
    });

  console.log(`[resync-knowledge-base] Found ${pendingRecords.length} pending records`);

  let queued = 0;
  for (const record of pendingRecords) {
    await options.queueAdd('document-processing', {
      knowledgeBaseId: record.id,
      type: 'revectorize',
    });
    queued++;
    // Rate limit: 100ms between jobs to avoid API throttling
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`[resync-knowledge-base] Done: queued ${queued} records for re-vectorization`);
  return { synced, updated, errors, queued };
}

// CLI entry point
async function main() {
  const { createStrapi } = await import('@strapi/strapi');
  const strapi = await createStrapi().load();

  // Dynamic import to avoid circular dependencies during CLI load
  const { syncWebsiteContent } = await import('../src/services/knowledge-sync-service');
  const { documentQueue } = await import('../src/queues/document-processor');

  const options: ResyncOptions = {
    syncWebsiteContent,
    queueAdd: async (queueName: string, data: any) => {
      return documentQueue.add('process', data);
    },
  };

  try {
    const result = await resyncKnowledgeBase(strapi, options);
    console.log('[resync-knowledge-base] Result:', result);
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
