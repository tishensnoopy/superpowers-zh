#!/usr/bin/env node
/**
 * 为导航"校区环境"添加二级菜单（6个校区子项）
 * 支持双语（zh-CN / en-US）
 *
 * 关键约束：en-US 子项必须创建为 zh-CN 子项同一 documentId 的本地化版本
 * （通过 documents.update({ documentId, locale: 'en-US' })），
 * 否则 getNavigationTree 按 documentId 合并 locale 时匹配不到英文，回退显示中文。
 *
 * 幂等 + 自愈：
 *   - zh 缺失 → 创建
 *   - en 本地化缺失 → 若存在同名独立英文文档（历史 bug 产物）先删除，再建本地化
 *   - en 本地化已存在 → 跳过
 *
 * 用法: node scripts/add-campus-nav-children.js [--dry-run]
 */
const path = require('path');
const { createStrapi } = require('@strapi/strapi');

const CHILDREN = [
  {
    zh: { name: '百步亭校区', url: '/campuses/yousen-baibuting' },
    en: { name: 'Bai Buting Campus', url: '/campuses/yousen-baibuting' },
    position: 1,
  },
  {
    zh: { name: '三阳路校区', url: '/campuses/yousen-sanyanglu' },
    en: { name: 'Sanyang Road Campus', url: '/campuses/yousen-sanyanglu' },
    position: 2,
  },
  {
    zh: { name: '动物园校区', url: '/campuses/yousen-dongwuyuan' },
    en: { name: 'Zhongyuan Zoo Campus', url: '/campuses/yousen-dongwuyuan' },
    position: 3,
  },
  {
    zh: { name: '钟家村校区', url: '/campuses/yousen-zhongjiacun' },
    en: { name: 'Zhongjiacun Campus', url: '/campuses/yousen-zhongjiacun' },
    position: 4,
  },
  {
    zh: { name: '四新校区', url: '/campuses/yousen-sixin' },
    en: { name: 'Sixin Campus', url: '/campuses/yousen-sixin' },
    position: 5,
  },
  {
    zh: { name: '沌口校区', url: '/campuses/yousen-zhuankou' },
    en: { name: 'Zhuankou Campus', url: '/campuses/yousen-zhuankou' },
    position: 6,
  },
];

const DRY_RUN = process.argv.includes('--dry-run');

async function findByName(strapi, name, locale) {
  const rows = await strapi.documents('api::navigation.navigation').findMany({
    locale,
    filters: { name },
    limit: 1,
  });
  return rows && rows.length > 0 ? rows[0] : null;
}

async function main() {
  const strapi = await createStrapi({ distDir: path.resolve(__dirname, '..', 'dist') }).load();
  console.log('[campus-nav-children] Strapi 已启动');

  // 父级 zh / en 共享同一 documentId（顶层导航是正确创建的本地化版本）
  const zhParent = await findByName(strapi, '校区环境', 'zh-CN');
  if (!zhParent) {
    console.error('[campus-nav-children] 父级 "校区环境" 不存在，终止');
    process.exit(1);
  }
  const parentDocumentId = zhParent.documentId;
  console.log(`[campus-nav-children] 父级 documentId=${parentDocumentId}`);

  for (const child of CHILDREN) {
    // ── 1. zh-CN 主版本 ─────────────────────────────────────────────
    let zhDoc = await findByName(strapi, child.zh.name, 'zh-CN');
    if (zhDoc) {
      console.log(`[campus-nav-children] zh-CN "${child.zh.name}" 已存在（documentId=${zhDoc.documentId}）`);
    } else {
      console.log(`[campus-nav-children] 创建 zh-CN 子项: "${child.zh.name}" position=${child.position}`);
      if (!DRY_RUN) {
        zhDoc = await strapi.documents('api::navigation.navigation').create({
          data: {
            name: child.zh.name,
            url: child.zh.url,
            position: child.position,
            isActive: true,
            isExternal: false,
            parent: { documentId: parentDocumentId },
          },
          locale: 'zh-CN',
          status: 'published',
        });
        console.log(`  ✓ 已创建 documentId=${zhDoc.documentId}`);
      }
    }

    if (DRY_RUN) continue;

    // ── 2. en-US 本地化版本（必须共享 zh 的 documentId）─────────────
    // 2a. 已存在正确本地化？（同 documentId 的 en-US 版本）
    const enLoc = await strapi
      .documents('api::navigation.navigation')
      .findOne({ documentId: zhDoc.documentId, locale: 'en-US' });
    if (enLoc) {
      console.log(`[campus-nav-children] en-US 本地化已存在（"${enLoc.name}"），跳过`);
      continue;
    }

    // 2b. 清理历史 bug 产物：同名但 documentId 不同的独立英文文档
    const stray = await findByName(strapi, child.en.name, 'en-US');
    if (stray && stray.documentId !== zhDoc.documentId) {
      console.log(`[campus-nav-children] 删除独立英文文档 "${child.en.name}"（documentId=${stray.documentId}，documentId 不匹配）`);
      await strapi.documents('api::navigation.navigation').delete({ documentId: stray.documentId });
    }

    // 2c. 以 zh documentId 创建 en-US 本地化
    console.log(`[campus-nav-children] 创建 en-US 本地化: "${child.en.name}" → documentId=${zhDoc.documentId}`);
    await strapi.documents('api::navigation.navigation').update({
      documentId: zhDoc.documentId,
      locale: 'en-US',
      data: {
        name: child.en.name,
        url: child.en.url,
        position: child.position,
        isActive: true,
        isExternal: false,
        parent: { documentId: parentDocumentId },
      },
      status: 'published',
    });
    console.log('  ✓ 已创建本地化');
  }

  await Promise.race([strapi.destroy(), new Promise((r) => setTimeout(r, 8000))]);
  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
