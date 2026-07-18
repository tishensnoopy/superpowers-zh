import type { Core } from '@strapi/strapi';

const UID = 'api::news-article.news-article';

export default {
  async find(ctx) {
    const { category, sort, page, pageSize, locale } = ctx.query as any;

    const entityFilters: any = {};
    if (category) {
      entityFilters.category = { $eq: category };
    }

    const sortArr = sort
      ? (Array.isArray(sort) ? sort : [sort])
      : [{ publishedAt: 'desc' }, { sortOrder: 'asc' }];

    const limit = parseInt(pageSize as string, 10) || 25;
    const start = ((parseInt(page as string, 10) || 1) - 1) * limit;

    const [articles, total] = await Promise.all([
      strapi.documents(UID).findMany({
        filters: entityFilters,
        sort: sortArr as any,
        limit,
        start,
        populate: { coverImage: true, seo: true },
        status: 'published',
        ...(locale ? { locale } : {}),
      }),
      strapi.documents(UID).count({
        filters: entityFilters,
        status: 'published',
        ...(locale ? { locale } : {}),
      }),
    ]);

    const data = articles || [];

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
    const article = await strapi.documents(UID).findOne({
      documentId: id,
      populate: { coverImage: true, seo: true },
      status: 'published',
      ...(locale ? { locale } : {}),
    });

    if (!article) {
      ctx.notFound('News article not found');
      return;
    }

    ctx.body = { data: article, meta: {} };
  },

  async findBySlug(ctx) {
    const { slug } = ctx.params;
    const { locale } = ctx.query as any;

    const articles = await strapi.documents(UID).findMany({
      filters: { slug: { $eq: slug } },
      populate: { coverImage: true, seo: true },
      status: 'published',
      limit: 1,
      ...(locale ? { locale } : {}),
    });

    const article = articles?.[0];
    if (!article) {
      ctx.notFound('News article not found');
      return;
    }

    ctx.body = { data: article, meta: {} };
  },
} satisfies Core.Controller;
