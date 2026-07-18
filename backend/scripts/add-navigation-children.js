#!/usr/bin/env node
/**
 * 为导航添加二级菜单（课程体系子项）
 * 支持双语（zh-CN / en-US）
 *
 * 用法: NODE_ENV=production node scripts/add-navigation-children.js [--dry-run]
 */
const path = require('path');
const { createStrapi } = require('@strapi/strapi');

const CHILDREN = [
  {
    zh: { name: '幼小衔接全能班', url: '/courses/yousen-youxiao-xianjie' },
    en: { name: 'Preschool-Primary Transition', url: '/courses/yousen-youxiao-xianjie' },
  },
  {
    zh: { name: '课后托管班', url: '/courses/yousen-kehao-tuoguan' },
    en: { name: 'After-School Care', url: '/courses/yousen-kehao-tuoguan' },
  },
  {
    zh: { name: '全日制托班', url: '/courses/yousen-tuoban' },
    en: { name: 'Full-Time Daycare', url: '/courses/yousen-tuoban' },
  },
];

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const strapi = await createStrapi({ distDir: path.resolve(__dirname, '..', 'dist') }).load();
  console.log('[nav-children] Strapi 已启动');

  for (const [i, child] of CHILDREN.entries()) {
    const position = i + 1;

    for (const locale of ['zh-CN', 'en-US']) {
      const data = locale === 'zh-CN' ? child.zh : child.en;

      // 检查是否已存在同名导航项
      const existing = await strapi.documents('api::navigation.navigation').findMany({
        locale,
        filters: { name: data.name },
        limit: 1,
      });
      if (existing && existing.length > 0) {
        console.log(`[nav-children] ${locale} "${data.name}" 已存在（documentId=${existing[0].documentId}），跳过`);
        continue;
      }

      // 查找父级（课程体系 / Courses）
      const parentName = locale === 'zh-CN' ? '课程体系' : 'Courses';
      const parents = await strapi.documents('api::navigation.navigation').findMany({
        locale,
        filters: { name: parentName },
        limit: 1,
      });
      if (!parents || parents.length === 0) {
        console.log(`[nav-children] 父级 "${parentName}" 不存在（${locale}），跳过`);
        continue;
      }
      const parentDoc = parents[0];

      console.log(`[nav-children] 创建 ${locale} 子项: "${data.name}" → parent="${parentName}" position=${position}`);
      if (!DRY_RUN) {
        await strapi.documents('api::navigation.navigation').create({
          data: {
            name: data.name,
            url: data.url,
            position,
            isActive: true,
            isExternal: false,
            parent: { documentId: parentDoc.documentId },
          },
          locale,
          status: 'published',
        });
        console.log(`  ✓ 已创建`);
      }
    }
  }

  await Promise.race([strapi.destroy(), new Promise((r) => setTimeout(r, 8000))]);
  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
