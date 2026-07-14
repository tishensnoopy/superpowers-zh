/**
 * Migration script: backfill the `locale` column for existing knowledge_bases rows.
 *
 * Usage (from backend/):
 *   npx tsx scripts/migrate-knowledge-base-locale.ts
 *
 * The `locale` column (VARCHAR(10) NOT NULL DEFAULT 'zh-CN') is added via
 * Strapi Content-Type Builder before running this script. Existing rows
 * inserted before the column existed will have NULL locale despite the
 * DEFAULT clause — this script sets them all to 'zh-CN'.
 */
export async function migrateKnowledgeBaseLocale(strapi: any): Promise<{ updated: number }> {
  const result = await strapi.db.connection.raw(
    "UPDATE knowledge_bases SET locale = 'zh-CN' WHERE locale IS NULL",
    []
  );

  // PostgreSQL UPDATE without RETURNING returns { rowCount: N, rows: [] }.
  // SQLite returns { changes: N } — handle both for local dev compatibility.
  const updated = (result as any).rowCount ?? (result as any).changes ?? 0;

  console.log(`[migrate-knowledge-base-locale] Updated ${updated} rows to locale='zh-CN'`);
  return { updated };
}

// CLI entry point
async function main() {
  const { createStrapi } = await import('@strapi/strapi');
  const strapi = await createStrapi().load();
  try {
    await migrateKnowledgeBaseLocale(strapi);
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
