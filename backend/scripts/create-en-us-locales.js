#!/usr/bin/env node
/**
 * 批量为业务数据创建 en-US 本地化版本
 * 策略：遍历所有启用 i18n 的 content type，对有 zh-CN 但无 en-US 的文档创建 en-US 版本
 * 用法: NODE_ENV=production node scripts/create-en-us-locales.js
 */

const path = require('path');
const { createStrapi } = require('@strapi/strapi');

const CONTENT_TYPES = [
  { uid: 'api::page.page', lookupField: 'slug' },
  { uid: 'api::product.product', lookupField: 'slug' },
  { uid: 'api::product-category.product-category', lookupField: 'slug' },
  { uid: 'api::campus.campus', lookupField: 'slug' },
  { uid: 'api::teacher.teacher', lookupField: 'slug' },
  { uid: 'api::news-article.news-article', lookupField: 'slug' },
  { uid: 'api::faq-item.faq-item', lookupField: 'question' },
  { uid: 'api::navigation.navigation', lookupField: 'name' },
  { uid: 'api::footer.footer', lookupField: 'id' },
  { uid: 'api::site-settings.site-settings', lookupField: 'id' },
  { uid: 'api::knowledge-base.knowledge-base', lookupField: 'title' },
];

function log(msg) { console.log(`[i18n-en-US] ${msg}`); }
function ok(msg) { console.log(`  ✓ ${msg}`); }
function info(msg) { console.log(`  ⚠ ${msg}`); }

async function main() {
  log('=== 创建 en-US 本地化数据 ===');
  const distDir = path.resolve(__dirname, '..', 'dist');
  const strapi = await createStrapi({ distDir }).load();
  log('Strapi 已启动\n');

  let totalCreated = 0;
  let totalSkipped = 0;
  let totalError = 0;

  for (const { uid, lookupField } of CONTENT_TYPES) {
    log(`处理 ${uid}`);
    let zhDocs;
    try {
      const result = await strapi.documents(uid).findMany({
        locale: 'zh-CN',
        limit: 1000,
        status: 'published',
      });
      zhDocs = Array.isArray(result) ? result : (result ? [result] : []);
    } catch (e) {
      info(`查询 zh-CN 失败: ${e.message}`);
      totalError++;
      continue;
    }

    if (zhDocs.length === 0) {
      info('无 zh-CN 文档，跳过');
      continue;
    }

    for (const doc of zhDocs) {
      const lookupValue = doc[lookupField] || doc.id;
      let enDoc;
      try {
        enDoc = await strapi.documents(uid).findFirst({
          filters: { documentId: doc.documentId },
          locale: 'en-US',
        });
      } catch (e) { /* 可能不存在 */ }

      if (enDoc) {
        totalSkipped++;
        continue;
      }

      try {
        const { id, documentId, createdAt, updatedAt, publishedAt, createdBy, updatedBy, locale, published_at, created_at, updated_at, ...fields } = doc;
        await strapi.documents(uid).update({
          documentId: doc.documentId,
          data: fields,
          locale: 'en-US',
          status: 'published',
        });
        ok(`en-US 创建: ${lookupValue}`);
        totalCreated++;
      } catch (e) {
        info(`en-US 创建失败 (${lookupValue}): ${e.message}`);
        totalError++;
      }
    }
    log(`  ${uid} 完成\n`);
  }

  log('=== 总结 ===');
  log(`创建: ${totalCreated}`);
  log(`跳过(已有): ${totalSkipped}`);
  log(`错误: ${totalError}`);

  await strapi.destroy();
}

main().catch(e => {
  console.error('FATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
