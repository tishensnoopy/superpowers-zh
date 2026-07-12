import type { Core } from '@strapi/strapi';

const UID = 'api::campus.campus';

export default {
  async find(ctx) {
    const { filters, sort } = ctx.query as any;

    const entityFilters: any = {};
    if (filters?.slug?.$eq) {
      entityFilters.slug = { $eq: filters.slug.$eq };
    }

    const sortArr = sort
      ? (Array.isArray(sort) ? sort : [sort])
      : [{ sortOrder: 'asc' }];

    const campuses = await strapi.documents(UID).findMany({
      filters: entityFilters,
      sort: sortArr as any,
      populate: {
        coverImage: true,
        gallery: true,
        teachers: {
          populate: { avatar: true },
        },
        seo: true,
      },
      status: 'published',
    });

    const data = campuses || [];

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
    const campus = await strapi.documents(UID).findOne({
      documentId: id,
      populate: {
        coverImage: true,
        gallery: true,
        teachers: {
          populate: { avatar: true },
        },
        seo: true,
      },
      status: 'published',
    });

    if (!campus) {
      ctx.notFound('Campus not found');
      return;
    }

    ctx.body = { data: campus, meta: {} };
  },
} satisfies Core.Controller;
