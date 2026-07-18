import { factories } from '@strapi/strapi';

const UID = 'api::teacher.teacher';

export default factories.createCoreController(UID, ({ strapi }) => ({
  async find(ctx) {
    const { filters, sort, page, pageSize, locale } = ctx.query as any;

    const entityFilters: any = {};
    if (filters?.subject) {
      entityFilters.subject = { $eq: filters.subject };
    }
    if (filters?.isFeatured !== undefined) {
      entityFilters.isFeatured = { $eq: filters.isFeatured === 'true' };
    }

    const campusSlug = filters?.campus?.slug?.$eq || filters?.campusSlug;
    if (campusSlug) {
      entityFilters.campus = { slug: { $eq: campusSlug } };
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
        populate: { campus: true, avatar: true, seo: true },
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
      populate: { campus: true, avatar: true, seo: true },
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
