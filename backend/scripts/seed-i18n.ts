/**
 * Seed en-US locale entries for existing content.
 *
 * Creates en-US placeholder versions of all zh-CN products, news, campuses,
 * teachers so the i18n E2E tests have content to verify against.
 *
 * Usage (from backend/):
 *   npx tsx scripts/seed-i18n.ts
 */

const EN_PLACEHOLDERS = {
  product: (zh: any) => ({
    title: `${zh.title} (EN)`,
    description: `English description for ${zh.title}. ${zh.description || ''}`,
    locale: 'en-US',
  }),
  news: (zh: any) => ({
    title: `${zh.title} (EN)`,
    content: `English content for ${zh.title}.`,
    locale: 'en-US',
  }),
  campus: (zh: any) => ({
    name: `${zh.name} (EN)`,
    description: `English description for ${zh.name}.`,
    locale: 'en-US',
  }),
  teacher: (zh: any) => ({
    name: zh.name,
    bio: `English bio for ${zh.name}.`,
    locale: 'en-US',
  }),
};

async function seedI18n(strapi: any) {
  const stats = { products: 0, news: 0, campuses: 0, teachers: 0 };

  // Products
  const products = await strapi.documents('api::product.product').findMany({
    locale: 'zh-CN',
    limit: 100,
  });
  for (const p of products) {
    await strapi.documents('api::product.product').create({
      data: EN_PLACEHOLDERS.product(p),
      locale: 'en-US',
    });
    stats.products++;
  }

  // News
  const news = await strapi.documents('api::news-article.news-article').findMany({
    locale: 'zh-CN',
    limit: 100,
  });
  for (const n of news) {
    await strapi.documents('api::news-article.news-article').create({
      data: EN_PLACEHOLDERS.news(n),
      locale: 'en-US',
    });
    stats.news++;
  }

  // Campuses
  const campuses = await strapi.documents('api::campus.campus').findMany({
    locale: 'zh-CN',
    limit: 100,
  });
  for (const c of campuses) {
    await strapi.documents('api::campus.campus').create({
      data: EN_PLACEHOLDERS.campus(c),
      locale: 'en-US',
    });
    stats.campuses++;
  }

  // Teachers
  const teachers = await strapi.documents('api::teacher.teacher').findMany({
    locale: 'zh-CN',
    limit: 100,
  });
  for (const t of teachers) {
    await strapi.documents('api::teacher.teacher').create({
      data: EN_PLACEHOLDERS.teacher(t),
      locale: 'en-US',
    });
    stats.teachers++;
  }

  console.log('[seed-i18n] Done:', stats);
  return stats;
}

async function main() {
  const { createStrapi } = await import('@strapi/strapi');
  const strapi = await createStrapi().load();
  try {
    await seedI18n(strapi);
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

export { seedI18n };
