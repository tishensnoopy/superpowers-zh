#!/usr/bin/env node
/**
 * 把所有 Strapi Admin 用户的界面语言设置为 zh-Hans（R4）。
 *
 * Strapi v5 的 Admin UI 语言按每个用户的 Profile 生效（prefered_language
 * 字段），默认跟随浏览器/英文。客户管理员不懂英文时，「后端中文不全」
 * 的感知主要来自这里。数据库重置后执行本脚本一次即可。
 *
 * 用法:
 *   NODE_ENV=production node scripts/set-admin-locale.js [locale]
 *   默认 locale = zh-Hans
 */
const path = require('path');
const { createStrapi } = require('@strapi/strapi');

async function main() {
  const targetLocale = process.argv[2] || 'zh-Hans';
  const strapi = await createStrapi({ distDir: path.resolve(__dirname, '..', 'dist') }).load();

  const result = await strapi.db.connection('admin_users')
    .update({ prefered_language: targetLocale, updated_at: new Date() });

  console.log(`[set-admin-locale] 已将 ${result} 个 admin 用户的界面语言设置为 ${targetLocale}`);

  await strapi.destroy();
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
