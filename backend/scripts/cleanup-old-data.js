#!/usr/bin/env node
/**
 * 一次性清理脚本：删除 Strapi 中的旧数据（seed 脚本运行前执行）
 * 用法: docker compose exec backend node scripts/cleanup-old-data.js
 *
 * 删除内容：
 *   - navigation: name 为英文的旧记录（Home/Products/About/Contact）
 *   - product-categories: slug 不以 yousen- 开头的旧记录
 *   - pages: slug=/ 的旧首页（保留 slug=homepage 的新首页）
 *   - faq-items: 所有旧记录（seed 会重建 8 条）
 */

const { createStrapi } = require('@strapi/strapi');

const log = (msg) => console.log(msg);
const ok = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.warn(`  ⚠ ${msg}`);
const info = (msg) => console.log(`  → ${msg}`);

async function cleanupNavigation(strapi) {
  log('\n=== 清理 Navigation 旧数据 ===');
  const uid = 'api::navigation.navigation';
  const oldNames = ['Home', 'Products', 'About', 'Contact', 'News', 'Campuses', 'Teachers'];
  const all = await strapi.documents(uid).findMany({ pagination: { limit: 100 } });
  for (const item of all) {
    if (oldNames.includes(item.name)) {
      await strapi.documents(uid).delete({ documentId: item.documentId });
      ok(`删除 (name=${item.name}, url=${item.url})`);
    } else {
      info(`保留 (name=${item.name}, url=${item.url})`);
    }
  }
}

async function cleanupCategories(strapi) {
  log('\n=== 清理 Product Categories 旧数据 ===');
  const uid = 'api::product-category.product-category';
  const all = await strapi.documents(uid).findMany({ pagination: { limit: 100 } });
  for (const cat of all) {
    if (!cat.slug || !cat.slug.startsWith('yousen-')) {
      await strapi.documents(uid).delete({ documentId: cat.documentId });
      ok(`删除 (name=${cat.name}, slug=${cat.slug})`);
    } else {
      info(`保留 (name=${cat.name}, slug=${cat.slug})`);
    }
  }
}

async function cleanupPages(strapi) {
  log('\n=== 清理 Pages 旧首页 ===');
  const uid = 'api::page.page';
  const all = await strapi.documents(uid).findMany({ pagination: { limit: 100 } });
  for (const page of all) {
    // 删除 slug=/ 的旧首页，保留 slug=homepage 的新首页
    if (page.slug === '/' || page.slug === '') {
      await strapi.documents(uid).delete({ documentId: page.documentId });
      ok(`删除旧首页 (slug=${page.slug}, id=${page.id})`);
    } else {
      info(`保留 (slug=${page.slug}, id=${page.id})`);
    }
  }
}

async function cleanupFaqs(strapi) {
  log('\n=== 清理 FAQ Items 旧数据 ===');
  const uid = 'api::faq-item.faq-item';
  const seedQuestions = [
    '幼小衔接有必要上吗？',
    '佑森的幼小衔接课程包括什么？',
    '课后托管和晚托有什么区别？',
    '佑森的班额是多少？',
    '孩子没有基础可以上吗？',
    '校区地址在哪里？',
    '怎么预约试听？',
    '退费政策是什么？',
  ];
  const all = await strapi.documents(uid).findMany({ pagination: { limit: 100 } });
  for (const faq of all) {
    if (!seedQuestions.includes(faq.question)) {
      await strapi.documents(uid).delete({ documentId: faq.documentId });
      ok(`删除 (Q=${faq.question?.substring(0, 20)}...)`);
    } else {
      info(`保留 (Q=${faq.question?.substring(0, 20)}...)`);
    }
  }
}

async function main() {
  log('=== Strapi 旧数据清理脚本 ===');
  const strapi = await createStrapi().load();
  log('Strapi 已启动\n');

  try {
    await cleanupNavigation(strapi);
    await cleanupCategories(strapi);
    await cleanupPages(strapi);
    await cleanupFaqs(strapi);
    log('\n=== 清理完成 ===');
  } catch (err) {
    console.error('\n❌ 错误:', err.message);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    await strapi.destroy();
  }
}

main();
