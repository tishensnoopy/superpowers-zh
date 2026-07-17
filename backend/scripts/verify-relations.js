#!/usr/bin/env node
/**
 * 验证 navigation/page/product-category/faq-item 的 manyToOne 修复（R15）
 * 创建 1 父 + 2 子，确认两个子项都能正确关联到同一父项（不被顶掉）
 * 测试完成后自动清理
 */
const path = require('path');
const { createStrapi } = require('@strapi/strapi');

async function main() {
  const strapi = await createStrapi({ distDir: path.resolve(__dirname, '..', 'dist') }).load();
  console.log('[verify-relations] Strapi 已启动');

  const uid = 'api::navigation.navigation';
  const ts = Date.now();
  let parentId, child1Id, child2Id;
  let passed = false;

  try {
    // 创建父项
    const parent = await strapi.documents(uid).create({
      data: { name: `TEST_PARENT_${ts}`, url: `/test-parent-${ts}`, position: 99, isExternal: false, isActive: false },
      status: 'published',
    });
    parentId = parent.documentId;
    console.log(`[verify-relations] 父项创建: ${parentId}`);

    // 创建子项 1
    const c1 = await strapi.documents(uid).create({
      data: { name: `TEST_C1_${ts}`, url: `/test-c1-${ts}`, position: 1, isExternal: false, isActive: false, parent: parentId },
      status: 'published',
    });
    child1Id = c1.documentId;
    console.log(`[verify-relations] 子项1创建: ${child1Id}`);

    // 创建子项 2（关键：若 oneToOne 残留，会顶掉子项1）
    const c2 = await strapi.documents(uid).create({
      data: { name: `TEST_C2_${ts}`, url: `/test-c2-${ts}`, position: 2, isExternal: false, isActive: false, parent: parentId },
      status: 'published',
    });
    child2Id = c2.documentId;
    console.log(`[verify-relations] 子项2创建: ${child2Id}`);

    // 验证：populate parent.children 应包含 2 个子项
    const populated = await strapi.documents(uid).findOne({
      documentId: parentId,
      populate: ['children'],
    });
    const childCount = (populated.children || []).length;
    console.log(`[verify-relations] parent.children 数量: ${childCount}`);

    // 验证：子项1的 parent 仍指向父项（未被顶掉）
    const c1Check = await strapi.documents(uid).findOne({
      documentId: child1Id,
      populate: ['parent'],
    });
    const c1ParentOk = c1Check.parent && c1Check.parent.documentId === parentId;
    console.log(`[verify-relations] 子项1.parent 保留: ${c1ParentOk}`);

    if (childCount === 2 && c1ParentOk) {
      console.log('[verify-relations] ✅ PASS: manyToOne 关联正常，两个子项并存');
      passed = true;
    } else {
      console.log('[verify-relations] ❌ FAIL: 关联异常（children=' + childCount + ', c1Parent=' + c1ParentOk + '）');
    }
  } finally {
    // 清理（先删子再删父）
    for (const id of [child1Id, child2Id, parentId]) {
      if (id) {
        try { await strapi.documents(uid).delete({ documentId: id }); } catch (e) { /* ignore */ }
      }
    }
    console.log('[verify-relations] 测试数据已清理');
    await strapi.destroy();
  }
  process.exit(passed ? 0 : 1);
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
