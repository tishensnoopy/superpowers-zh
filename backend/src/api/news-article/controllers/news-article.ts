import type { Core } from '@strapi/strapi';

const UID = 'api::news-article.news-article';

function wrapMedia(media: any) {
  if (!media) return { data: null };
  const { id, documentId, ...attributes } = media;
  return { data: { id, documentId, attributes } };
}

function transformArticle(article: any) {
  if (!article) return null;
  const { id, documentId, coverImage, ...rest } = article;
  const attributes: any = { ...rest };
  if (coverImage !== undefined) {
    attributes.coverImage = wrapMedia(coverImage);
  }
  return { id, documentId, attributes };
}

export default {
  async find(ctx) {
    const { category, sort, page, pageSize } = ctx.query as any;

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
      }),
      strapi.documents(UID).count({
        filters: entityFilters,
        status: 'published',
      }),
    ]);

    const data = (articles || []).map(transformArticle);

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
    const article = await strapi.documents(UID).findOne({
      documentId: id,
      populate: { coverImage: true },
      status: 'published',
    });

    if (!article) {
      ctx.notFound('News article not found');
      return;
    }

    ctx.body = { data: transformArticle(article), meta: {} };
  },

  async findBySlug(ctx) {
    const { slug } = ctx.params;

    const articles = await strapi.documents(UID).findMany({
      filters: { slug: { $eq: slug } },
      populate: { coverImage: true, seo: true },
      status: 'published',
      limit: 1,
    });

    const article = articles?.[0];
    if (!article) {
      ctx.notFound('News article not found');
      return;
    }

    ctx.body = { data: transformArticle(article), meta: {} };
  },
} satisfies Core.Controller;
