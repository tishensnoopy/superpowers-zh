import { factories } from '@strapi/strapi';

/**
 * campus-teacher-link 控制器
 *
 * 自定义 find/findOne，用 strapi.documents() 直接 populate campus + teacher
 * 关系（绕过 content API sanitize，使公开路由能返回关系数据）。
 */
export default factories.createCoreController(
  'api::campus-teacher-link.campus-teacher-link',
  ({ strapi }) => ({
    async find(ctx) {
      const { locale } = ctx.query as any;

      const links = await strapi
        .documents('api::campus-teacher-link.campus-teacher-link')
        .findMany({
          populate: {
            campus: true,
            teacher: { populate: { avatar: true } },
          },
          sort: { sortOrder: 'asc' },
          ...(locale ? { locale } : {}),
        });

      const data = links || [];
      ctx.body = {
        data,
        meta: {
          pagination: {
            page: 1,
            pageSize: data.length,
            pageCount: 1,
            total: data.length,
          },
        },
      };
    },

    async findOne(ctx) {
      const { id } = ctx.params;
      const { locale } = ctx.query as any;

      const link = await strapi
        .documents('api::campus-teacher-link.campus-teacher-link')
        .findOne({
          documentId: id,
          populate: {
            campus: true,
            teacher: { populate: { avatar: true } },
          },
          ...(locale ? { locale } : {}),
        });

      if (!link) {
        ctx.notFound('Campus-teacher link not found');
        return;
      }

      ctx.body = { data: link, meta: {} };
    },
  })
);
