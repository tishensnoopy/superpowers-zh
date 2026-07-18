import { factories } from '@strapi/strapi';

// 校区路由：find / findOne 公开只读，create / update / delete 需鉴权（client-admin 可管理）
// 必须开放全量 action，否则 users-permissions 插件 syncPermissions 会把
// 对应权限行当作无效 action 在每次 bootstrap 时删除
export default factories.createCoreRouter('api::campus.campus', {
  only: ['find', 'findOne', 'create', 'update', 'delete'],
  config: {
    find: {
      auth: false,
    },
    findOne: {
      auth: false,
    },
  },
});
