/**
 * Seed en-US locale entries for existing content.
 *
 * Creates en-US placeholder versions of all zh-CN products, news, campuses,
 * teachers, FAQ items, and pages so the i18n E2E tests have content to verify against.
 *
 * Idempotent: skips entries that already have an en-US version (linked by documentId).
 *
 * Usage (from backend/):
 *   npx tsx scripts/seed-i18n.ts
 */

type StrapiDocuments = {
  findMany(opts: any): Promise<any[]>;
  create(opts: any): Promise<any>;
};

type StrapiLike = {
  documents(uid: string): StrapiDocuments;
  destroy(): Promise<void>;
};

const EN_PLACEHOLDERS = {
  product: (zh: any) => ({
    title: `${zh.title} (EN)`,
    description: `English description for ${zh.title}. ${zh.description || ''}`,
  }),
  news: (zh: any) => ({
    title: `${zh.title} (EN)`,
    content: `English content for ${zh.title}.`,
  }),
  campus: (zh: any) => ({
    name: `${zh.name} (EN)`,
    description: `English description for ${zh.name}.`,
  }),
  teacher: (zh: any) => ({
    name: zh.name,
    bio: `English bio for ${zh.name}.`,
  }),
  faq: (zh: any) => ({
    question: `EN: ${zh.question}`,
    answer: `EN: ${zh.answer}`,
    category: zh.category,
    sortOrder: zh.sortOrder,
    isActive: zh.isActive,
  }),
  page: (zh: any) => ({
    title: `${zh.title} (EN)`,
    slug: zh.slug,
    isHomepage: zh.isHomepage,
    sections: zh.sections,
    layout: zh.layout,
    showNavigation: zh.showNavigation,
    showFooter: zh.showFooter,
  }),
};

/**
 * Check if an en-US version already exists for the given documentId.
 */
async function hasEnVersion(docs: StrapiDocuments, documentId: string): Promise<boolean> {
  const existing = await docs.findMany({
    locale: 'en-US',
    filters: { documentId },
    limit: 1,
  });
  return existing.length > 0;
}

/**
 * Create an en-US version linked to the zh-CN entry via documentId.
 * Skips if en-US version already exists (idempotent).
 */
async function seedEnForContentType(
  strapi: StrapiLike,
  uid: string,
  placeholderFn: (zh: any) => Record<string, any>
): Promise<number> {
  const docs = strapi.documents(uid);
  const zhEntries = await docs.findMany({ locale: 'zh-CN', limit: 500 });
  let created = 0;

  for (const zh of zhEntries) {
    // Idempotency: skip if en-US version already exists
    const enExists = await hasEnVersion(docs, zh.documentId);
    if (enExists) {
      continue;
    }

    try {
      await docs.create({
        data: placeholderFn(zh),
        documentId: zh.documentId,
        locale: 'en-US',
        status: 'published',
      });
      created++;
    } catch (err) {
      // Content type may not support i18n — skip gracefully
      console.warn(`[seed-i18n] Skipped ${uid} documentId=${zh.documentId}: ${(err as Error).message}`);
    }
  }

  return created;
}

async function seedI18n(strapi: StrapiLike) {
  const stats = {
    products: 0,
    news: 0,
    campuses: 0,
    teachers: 0,
    faqs: 0,
    pages: 0,
  };

  stats.products = await seedEnForContentType(strapi, 'api::product.product', EN_PLACEHOLDERS.product);
  stats.news = await seedEnForContentType(strapi, 'api::news-article.news-article', EN_PLACEHOLDERS.news);
  stats.campuses = await seedEnForContentType(strapi, 'api::campus.campus', EN_PLACEHOLDERS.campus);
  stats.teachers = await seedEnForContentType(strapi, 'api::teacher.teacher', EN_PLACEHOLDERS.teacher);
  stats.faqs = await seedEnForContentType(strapi, 'api::faq-item.faq-item', EN_PLACEHOLDERS.faq);
  stats.pages = await seedEnForContentType(strapi, 'api::page.page', EN_PLACEHOLDERS.page);

  console.log('[seed-i18n] Done:', stats);
  return stats;
}

async function main() {
  const { createStrapi } = await import('@strapi/strapi');
  const strapi = await createStrapi().load();
  try {
    await seedI18n(strapi as unknown as StrapiLike);
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

export { seedI18n, seedEnForContentType, hasEnVersion, EN_PLACEHOLDERS };
