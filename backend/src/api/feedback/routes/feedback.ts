import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::feedback.feedback', {
  config: {
    // 访客公开提交反馈，无需鉴权
    create: {
      auth: false,
      policies: [],
      middlewares: [],
    },
    // client-admin 可查看列表和详情；Strapi v5 默认要求 auth，policy 强制 client-admin 角色
    find: {
      policies: ['is-client-admin'],
      middlewares: [],
    },
    findOne: {
      policies: ['is-client-admin'],
      middlewares: [],
    },
    // client-admin 可更新状态/回复
    update: {
      policies: ['is-client-admin'],
      middlewares: [],
    },
  },
  // 硬约束：不含 delete，反馈数据不可删除
  only: ['create', 'find', 'findOne', 'update'],
});
