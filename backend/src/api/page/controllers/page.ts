import type { Core } from '@strapi/strapi';

const UID = 'api::page.page';

const PAGE_POPULATE = {
  sections: {
    populate: '*',
  },
  seo: true,
} as const;

export default {
  async find(ctx) {
    const { filters } = ctx.query as any;

    const pages = await strapi.documents(UID).findMany({
      filters: filters || {},
      populate: PAGE_POPULATE,
      status: 'published',
    });

    const data = pages || [];
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
    const page = await strapi.documents(UID).findOne({
      documentId: id,
      populate: PAGE_POPULATE,
      status: 'published',
    });

    if (!page) {
      ctx.notFound('Page not found');
      return;
    }
    ctx.body = { data: page, meta: {} };
  },

  async findBySlug(ctx) {
    const { slug } = ctx.params;
    const pages = await strapi.documents(UID).findMany({
      filters: { slug: { $eq: slug } },
      populate: PAGE_POPULATE,
      status: 'published',
      limit: 1,
    });

    const page = pages?.[0];
    if (!page) {
      ctx.notFound('Page not found');
      return;
    }
    ctx.body = { data: page, meta: {} };
  },

  async getHomepage(ctx) {
    const pages = await strapi.documents(UID).findMany({
      filters: { isHomepage: { $eq: true } },
      populate: PAGE_POPULATE,
      status: 'published',
      limit: 1,
    });

    const page = pages?.[0];
    if (!page) {
      ctx.notFound('Homepage not found');
      return;
    }
    ctx.body = { data: page, meta: {} };
  },

  async create(ctx) {
    const page = await strapi.documents(UID).create({
      data: ctx.request.body,
      status: 'published',
    });
    ctx.body = { data: page, meta: {} };
  },

  async update(ctx) {
    const { id } = ctx.params;
    const page = await strapi.documents(UID).update({
      documentId: id,
      data: ctx.request.body,
      status: 'published',
    });
    ctx.body = { data: page, meta: {} };
  },

  async delete(ctx) {
    const { id } = ctx.params;
    await strapi.documents(UID).delete({
      documentId: id,
    });
    ctx.body = { data: null, meta: {} };
  },
} satisfies Core.Controller;
