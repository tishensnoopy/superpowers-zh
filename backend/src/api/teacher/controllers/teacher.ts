import { factories } from '@strapi/strapi';

const UID = 'api::teacher.teacher';

export default factories.createCoreController(UID, ({ strapi }) => ({
  async find(ctx) {
    const { filters, sort, page, pageSize, locale } = ctx.query as any;

    const entityFilters: any = {};
    if (filters?.subject) {
      // Strapi v5: filters[subject][$eq]=xxx 解析为 { subject: { $eq: 'xxx' } }
      // 直接使用即可，不要二次包装
      const subjectValue = typeof filters.subject === 'object' ? filters.subject.$eq : filters.subject;
      if (subjectValue) entityFilters.subject = { $eq: subjectValue };
    }
    if (filters?.isFeatured !== undefined) {
      const featuredValue = typeof filters.isFeatured === 'object' ? filters.isFeatured.$eq : filters.isFeatured;
      if (featuredValue !== undefined) entityFilters.isFeatured = { $eq: featuredValue === 'true' };
    }

    const rawCampusSlug = filters?.campus?.slug;
    const campusSlug = (typeof rawCampusSlug === 'object' ? rawCampusSlug?.$eq : rawCampusSlug) || filters?.campusSlug;
    // 经 campus_teacher_links 中间表过滤：先查 active 关联指向 slug 校区的 teacher documentId
    // （Strapi v5 document service 对 relation 属性的 deep filter 支持不稳定，改用两步查询）
    let teacherDocumentIds: string[] | null = null;
    if (campusSlug) {
      const campus = await strapi.documents('api::campus.campus').findFirst({
        filters: { slug: { $eq: campusSlug } },
        ...(locale ? { locale } : {}),
      });
      if (!campus) {
        ctx.body = {
          data: [],
          meta: {
            pagination: {
              page: parseInt(page as string, 10) || 1,
              pageSize: parseInt(pageSize as string, 10) || 25,
              pageCount: 0,
              total: 0,
            },
          },
        };
        return;
      }
      const links = await strapi
        .documents('api::campus-teacher-link.campus-teacher-link')
        .findMany({
          filters: { campus: campus.id, status: 'active' },
          populate: { teacher: true },
        });
      teacherDocumentIds = (links as any[])
        .map((l) => l?.teacher?.documentId)
        .filter((id): id is string => typeof id === 'string');
      if (teacherDocumentIds.length === 0) {
        ctx.body = {
          data: [],
          meta: {
            pagination: {
              page: parseInt(page as string, 10) || 1,
              pageSize: parseInt(pageSize as string, 10) || 25,
              pageCount: 0,
              total: 0,
            },
          },
        };
        return;
      }
      entityFilters.documentId = { $in: teacherDocumentIds };
    }

    const sortArr = sort ? (Array.isArray(sort) ? sort : [sort]) : [{ sortOrder: 'asc' }];

    const limit = parseInt(pageSize as string, 10) || 25;
    const start = ((parseInt(page as string, 10) || 1) - 1) * limit;

    const [teachers, total] = await Promise.all([
      strapi.documents(UID).findMany({
        filters: entityFilters,
        sort: sortArr as any,
        limit,
        start,
        populate: {
          campus_links: {
            filters: { status: 'active' },
            populate: { campus: true },
          },
          avatar: true,
          seo: true,
        },
        status: 'published',
        ...(locale ? { locale } : {}),
      }),
      strapi.documents(UID).count({
        filters: entityFilters,
        status: 'published',
        ...(locale ? { locale } : {}),
      }),
    ]);

    const data = teachers || [];

    ctx.body = {
      data,
      meta: {
        pagination: {
          page: parseInt(page as string, 10) || 1,
          pageSize: limit,
          pageCount: Math.ceil(total / limit),
          total,
        },
      },
    };
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const { locale } = ctx.query as any;
    const teacher = await strapi.documents(UID).findOne({
      documentId: id,
      populate: {
        campus_links: {
          filters: { status: 'active' },
          populate: { campus: true },
        },
        avatar: true,
        seo: true,
      },
      status: 'published',
      ...(locale ? { locale } : {}),
    });

    if (!teacher) {
      ctx.notFound('Teacher not found');
      return;
    }

    ctx.body = { data: teacher, meta: {} };
  },
}));
