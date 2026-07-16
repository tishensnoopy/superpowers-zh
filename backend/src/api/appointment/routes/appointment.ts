/**
 * Appointment 路由（自定义路由 + core 路由混合模式）。
 *
 * 原先使用 factories.createCoreRouter，为追加 /appointments/export 自定义路由，
 * 改为 plain routes 对象，手动声明 create/find/findOne + export。
 *
 * 路由顺序：export 必须在 :documentId 之前，避免 "export" 被当作 documentId 匹配。
 *
 * 权限分层：
 *   - create：访客公开提交（auth: false）
 *   - find/findOne/export：client-admin 可访问（Strapi v5 默认 auth=true，policy 强制角色）
 *     注意：Strapi v5 路由校验器拒绝 auth: true 字面量，故受保护路由使用 auth: { enabled: true }。
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/appointments',
      handler: 'appointment.create',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/appointments',
      handler: 'appointment.find',
      config: {
        policies: ['is-client-admin'],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/appointments/export',
      handler: 'appointment.export',
      config: {
        auth: { enabled: true },
        policies: ['is-client-admin'],
      },
    },
    {
      method: 'GET',
      path: '/appointments/:documentId',
      handler: 'appointment.findOne',
      config: {
        policies: ['is-client-admin'],
        middlewares: [],
      },
    },
  ],
};
