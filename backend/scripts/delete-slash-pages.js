#!/usr/bin/env node
/**
 * 删除 /-prefixed 冗余测试页面（与正式页面重复的遗留数据）
 * 通过 document service 删除，自动清理 components / draft+published / 双语版本
 *
 * 用法: NODE_ENV=production node scripts/delete-slash-pages.js [--dry-run]
 */
const path = require('path');
const { createStrapi } = require('@strapi/strapi');

const SLASH_DOC_IDS = [
  'pnoke28vln4bqqm5h3bzi8rd', // /
  'dm81i9yhsjse7belmaqzt734', // /about
  'dvjwom49ae236idr4ws1d885', // /contact
  'eszwie994qlfnkb6yfeoijhv', // /products
];

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const strapi = await createStrapi({ distDir: path.resolve(__dirname, '..', 'dist') }).load();
  console.log('[cleanup] Strapi 已启动');

  for (const documentId of SLASH_DOC_IDS) {
    // findOne 默认只查默认 locale，需逐 locale 检查存在性
    let found = false;
    for (const locale of ['zh-CN', 'en-US']) {
      try {
        const doc = await strapi.documents('api::page.page').findOne({ documentId, locale });
        if (doc) {
          found = true;
          console.log(`[cleanup] 删除 page: slug="${doc.slug}" (${locale}) documentId=${documentId}`);
          if (!DRY_RUN) {
            await strapi.documents('api::page.page').delete({ documentId, locale });
            console.log(`  ✓ 已删除 ${locale} 版本（draft+published）`);
          }
        }
      } catch (e) { /* 该 locale 不存在 */ }
    }
    if (!found) console.log(`[cleanup] ${documentId} 不存在，跳过`);
  }

  await Promise.race([strapi.destroy(), new Promise((r) => setTimeout(r, 8000))]);
  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
