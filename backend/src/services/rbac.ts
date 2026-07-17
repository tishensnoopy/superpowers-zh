/**
 * RBAC 初始化服务（bootstrap 时执行，幂等）
 *
 * 负责两件事：
 *   1. Public 角色：补齐内容读取 + 公开表单/Chat 提交权限（多数公开路由已 auth:false，此处为兜底）
 *   2. client-admin 角色：确保角色存在，并配置客户管理员的 API 权限
 *
 * 硬约束：
 *   - appointment / feedback 对 client-admin 不开放 delete（提交数据不可删除）
 *   - ai-config / vector-config / wechat / translation 不授予 client-admin（超管专属）
 *
 * Strapi v5 users-permissions 权限模型：
 *   up_permissions(action 字符串) ←→ up_permissions_role_lnk(role_id, permission_id)
 *   正确写法：create({ data: { action, role: roleId } })，不可 populate 'action'（它是字符串非关联）
 */

const CONTENT_READ_TYPES = [
  'page',
  'navigation',
  'footer',
  'product',
  'product-category',
  'product-spec',
  'faq-item',
  'campus',
  'news-article',
  'teacher',
  'knowledge-base',
];

const PUBLIC_ACTIONS: string[] = [
  // 内容读取
  ...CONTENT_READ_TYPES.flatMap((t) => [`api::${t}.${t}.find`, `api::${t}.${t}.findOne`]),
  'api::site-settings.site-settings.find',
  // 公开表单提交
  'api::appointment.appointment.create',
  'api::feedback.feedback.create',
  // Chat 5 个公开端点
  'api::chat.chat.startSession',
  'api::chat.chat.sendMessage',
  'api::chat.chat.transferToHuman',
  'api::chat.chat.getHistory',
  'api::chat.chat.submitFeedback',
];

// client-admin 可全量管理的内容类型（含 delete）
const CLIENT_ADMIN_FULL_TYPES = [
  'site-settings',
  'navigation',
  'footer',
  'page',
  'product',
  'product-category',
  'product-spec',
  'faq-item',
  'knowledge-base',
  'campus',
  'news-article',
  'teacher',
  'chat-message',
  'chat-session',
];

const CLIENT_ADMIN_ACTIONS: string[] = [
  ...CLIENT_ADMIN_FULL_TYPES.flatMap((t) => [
    `api::${t}.${t}.find`,
    `api::${t}.${t}.findOne`,
    `api::${t}.${t}.create`,
    `api::${t}.${t}.update`,
    `api::${t}.${t}.delete`,
  ]),
  // 提交数据：可查可导出可改状态，不可删除（硬约束）
  'api::appointment.appointment.find',
  'api::appointment.appointment.findOne',
  'api::appointment.appointment.export',
  'api::feedback.feedback.find',
  'api::feedback.feedback.findOne',
  'api::feedback.feedback.update',
  // 统计
  'api::stats.stats.appointments',
  'api::stats.stats.feedbacks',
  'api::stats.stats.overview',
];

export default ({ strapi }: { strapi: any }) => {
  async function ensurePermission(roleId: number, action: string): Promise<boolean> {
    const existing = await strapi.db.query('plugin::users-permissions.permission').findOne({
      where: { action, role: roleId },
    });
    if (existing) return false;
    await strapi.db.query('plugin::users-permissions.permission').create({
      data: { action, role: roleId },
    });
    return true;
  }

  async function ensurePermissions(roleId: number, actions: string[], label: string) {
    let created = 0;
    for (const action of actions) {
      try {
        if (await ensurePermission(roleId, action)) created++;
      } catch (err) {
        console.warn(`[RBAC] failed to grant ${action} to ${label}:`, err instanceof Error ? err.message : err);
      }
    }
    console.log(`[RBAC] ${label}: ${created} permissions created, ${actions.length - created} already existed`);
  }

  async function initializeRoles() {
    console.log('[RBAC] initializeRoles() called');
    try {
      // 1. Public 角色兜底权限
      const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'public' },
      });
      if (publicRole) {
        await ensurePermissions(publicRole.id, PUBLIC_ACTIONS, 'public');
      } else {
        console.warn('[RBAC] public role not found, skipping public permissions');
      }

      // 2. client-admin 角色（不存在则创建）
      let clientAdmin = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { name: 'client-admin' },
      });
      if (!clientAdmin) {
        clientAdmin = await strapi.db.query('plugin::users-permissions.role').create({
          data: {
            name: 'client-admin',
            description: 'Client administrator - can manage all content types except user management',
            type: 'client-admin',
          },
        });
        console.log('[RBAC] created client-admin role, id:', clientAdmin.id);
      }

      // 3. client-admin 权限（幂等补齐）
      await ensurePermissions(clientAdmin.id, CLIENT_ADMIN_ACTIONS, 'client-admin');

      console.log('[RBAC] initializeRoles() completed');
    } catch (err) {
      console.error('[RBAC] initializeRoles() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  }

  return {
    initializeRoles,
  };
};
