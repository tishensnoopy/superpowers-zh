#!/usr/bin/env node
/**
 * 权限修复脚本（幂等，可重复执行）
 * 用法: docker compose exec backend node scripts/fix-permissions.js
 *
 * 与 src/services/rbac.ts 保持同一套权限清单；用于不重建镜像时直接修复权限数据。
 * 根因：旧 rbac.ts 误把 action 当关联 populate（实际是字符串），且试图更新不存在的 role 列，
 *       导致 client-admin 0 权限、Public 仅剩 8 条插件默认权限。
 */

const path = require('path');
const { createStrapi } = require('@strapi/strapi');

const CONTENT_READ_TYPES = [
  'page', 'navigation', 'footer', 'product', 'product-category', 'product-spec',
  'faq-item', 'campus', 'news-article', 'teacher', 'knowledge-base',
];

const PUBLIC_ACTIONS = [
  ...CONTENT_READ_TYPES.flatMap((t) => [`api::${t}.${t}.find`, `api::${t}.${t}.findOne`]),
  'api::site-settings.site-settings.find',
  'api::appointment.appointment.create',
  'api::feedback.feedback.create',
  'api::chat.chat.startSession',
  'api::chat.chat.sendMessage',
  'api::chat.chat.transferToHuman',
  'api::chat.chat.getHistory',
  'api::chat.chat.submitFeedback',
];

const CLIENT_ADMIN_FULL_TYPES = [
  'site-settings', 'navigation', 'footer', 'page', 'product', 'product-category',
  'product-spec', 'faq-item', 'knowledge-base', 'campus', 'news-article', 'teacher',
  'chat-message', 'chat-session',
];

const CLIENT_ADMIN_ACTIONS = [
  ...CLIENT_ADMIN_FULL_TYPES.flatMap((t) => [
    `api::${t}.${t}.find`, `api::${t}.${t}.findOne`, `api::${t}.${t}.create`,
    `api::${t}.${t}.update`, `api::${t}.${t}.delete`,
  ]),
  'api::appointment.appointment.find',
  'api::appointment.appointment.findOne',
  'api::appointment.appointment.export',
  'api::feedback.feedback.find',
  'api::feedback.feedback.findOne',
  'api::feedback.feedback.update',
  'api::stats.stats.appointments',
  'api::stats.stats.feedbacks',
  'api::stats.stats.overview',
];

async function ensurePermission(strapi, roleId, action) {
  const existing = await strapi.db.query('plugin::users-permissions.permission').findOne({
    where: { action, role: roleId },
  });
  if (existing) return false;
  await strapi.db.query('plugin::users-permissions.permission').create({
    data: { action, role: roleId },
  });
  return true;
}

async function ensurePermissions(strapi, roleId, actions, label) {
  let created = 0;
  for (const action of actions) {
    try {
      if (await ensurePermission(strapi, roleId, action)) created++;
    } catch (err) {
      console.warn(`[fix-permissions] FAILED ${action} -> ${label}:`, err.message);
    }
  }
  console.log(`[fix-permissions] ${label}: ${created} created, ${actions.length - created} existed`);
}

async function main() {
  const strapi = await createStrapi({ distDir: path.resolve(__dirname, '..', 'dist') }).load();
  try {
    const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'public' } });
    if (!publicRole) throw new Error('public role not found');
    await ensurePermissions(strapi, publicRole.id, PUBLIC_ACTIONS, 'public');

    let clientAdmin = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { name: 'client-admin' } });
    if (!clientAdmin) {
      clientAdmin = await strapi.db.query('plugin::users-permissions.role').create({
        data: { name: 'client-admin', description: 'Client administrator', type: 'client-admin' },
      });
      console.log('[fix-permissions] created client-admin role, id:', clientAdmin.id);
    }
    await ensurePermissions(strapi, clientAdmin.id, CLIENT_ADMIN_ACTIONS, 'client-admin');

    // 汇总验证
    const counts = await strapi.db.connection('up_roles')
      .leftJoin('up_permissions_role_lnk', 'up_permissions_role_lnk.role_id', 'up_roles.id')
      .select('up_roles.name')
      .count('up_permissions_role_lnk.permission_id as perms')
      .groupBy('up_roles.name');
    console.log('[fix-permissions] final counts:', JSON.stringify(counts));
  } finally {
    await strapi.destroy();
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('[fix-permissions] fatal:', err);
  process.exit(1);
});
