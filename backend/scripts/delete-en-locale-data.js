#!/usr/bin/env node
/**
 * 一次性清理脚本：删除 Strapi 首次启动时 bootstrap 用默认 locale=en 创建的
 * 残留默认数据（page 4 个 + navigation 4 个）。
 *
 * 背景：后端在空库首次启动时，i18n 默认 locale 是 en，navigation/page 服务的
 * initializeDefaults() 创建了英文演示数据（Home/Products/About/Contact、
 * / /about /products /contact）。这些数据与 seed 的 zh-CN 数据无关，属于脏数据。
 *
 * 用 document service 删除（自动清理组件关联），只删 locale='en' 的版本。
 *
 * 用法: NODE_ENV=production node scripts/delete-en-locale-data.js
 */
const path = require('path');
const { createStrapi } = require('@strapi/strapi');

const TARGETS = [
  'api::page.page',
  'api::navigation.navigation',
  'api::faq-item.faq-item',
  'api::site-settings.site-settings',
];

async function main() {
  const strapi = await createStrapi({ distDir: path.resolve(__dirname, '..', 'dist') }).load();
  try {
    for (const uid of TARGETS) {
      const entries = await strapi.db.query(uid).findMany({ where: { locale: 'en' } });
      if (entries.length === 0) {
        console.log(`[cleanup] ${uid}: 无 locale=en 数据`);
        continue;
      }
      // 按 documentId 去重（draft+published 共享 documentId）
      const docIds = [...new Set(entries.map((e) => e.documentId))];
      for (const documentId of docIds) {
        await strapi.documents(uid).delete({ documentId, locale: 'en' });
        console.log(`[cleanup] 已删除 ${uid} documentId=${documentId} (locale=en)`);
      }
    }
  } finally {
    await strapi.destroy();
  }
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
