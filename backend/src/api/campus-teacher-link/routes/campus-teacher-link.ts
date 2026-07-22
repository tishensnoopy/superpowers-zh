import { factories } from '@strapi/strapi';

// 校区教师关联路由：CRUD 全量开放（管理后台用），find/findOne 公开只读
export default factories.createCoreRouter('api::campus-teacher-link.campus-teacher-link', {
  only: ['find', 'findOne', 'create', 'update', 'delete'],
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});
