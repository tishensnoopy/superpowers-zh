import { factories } from '@strapi/strapi';

// 校区路由：仅开放 find / findOne，关闭鉴权以供前端公开访问
export default factories.createCoreRouter('api::campus.campus', {
  only: ['find', 'findOne'],
  config: {
    find: {
      auth: false,
    },
    findOne: {
      auth: false,
    },
  },
});
