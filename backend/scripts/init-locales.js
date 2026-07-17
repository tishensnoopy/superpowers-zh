#!/usr/bin/env node
/**
 * 初始化 i18n locale 数据，使其与 config/plugins.ts 的 i18n 配置一致。
 *
 * Strapi v5 i18n 插件在空库启动时只创建内置默认 locale（en），不会读取
 * 项目 config 的 locales 列表。数据库重置后必须执行本脚本：
 *   1. 确保 zh-CN / en-US 两个 locale 存在
 *   2. 将默认 locale 设置为 zh-CN（core_store: plugin_i18n_default_locale）
 *
 * 用法:
 *   NODE_ENV=production node scripts/init-locales.js
 */
const path = require('path');
const { createStrapi } = require('@strapi/strapi');

const LOCALES = [
  { code: 'zh-CN', name: 'Chinese (zh-CN)' },
  { code: 'en-US', name: 'English (en-US)' },
];
const DEFAULT_LOCALE = 'zh-CN';

async function main() {
  const strapi = await createStrapi({ distDir: path.resolve(__dirname, '..', 'dist') }).load();
  const localesService = strapi.plugin('i18n').service('locales');

  for (const { code, name } of LOCALES) {
    const existing = await localesService.findByCode(code);
    if (existing) {
      console.log(`[init-locales] locale ${code} 已存在 (id=${existing.id})`);
    } else {
      await localesService.create({ code, name });
      console.log(`[init-locales] locale ${code} 已创建`);
    }
  }

  const currentDefault = await localesService.getDefaultLocale();
  if (currentDefault !== DEFAULT_LOCALE) {
    await localesService.setDefaultLocale({ code: DEFAULT_LOCALE });
    console.log(`[init-locales] 默认 locale: ${currentDefault} -> ${DEFAULT_LOCALE}`);
  } else {
    console.log(`[init-locales] 默认 locale 已是 ${DEFAULT_LOCALE}`);
  }

  const all = await localesService.find();
  console.log(`[init-locales] 当前 locales: ${all.map((l) => l.code).join(', ')}`);

  await strapi.destroy();
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
