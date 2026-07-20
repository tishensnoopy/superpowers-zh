import type { Core } from '@strapi/strapi';

const UID = 'api::page.page';

// seo 必须深取 ogImage：seo: true 不会返回组件内的媒体字段，
// 前端 OpenGraph 分享图依赖该字段（契约见 src/__tests__/api-populate.test.ts）。
export const PAGE_POPULATE = {
  sections: {
    populate: '*',
  },
  seo: {
    populate: {
      ogImage: true,
    },
  },
} as const;

export default {
  async find(ctx) {
    const { filters, locale, ...rest } = ctx.query as any;

    const pages = await strapi.documents(UID).findMany({
      filters: filters || {},
      populate: PAGE_POPULATE,
      status: 'published',
      ...(locale ? { locale } : {}),
      ...rest,
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
    const { locale } = ctx.query as any;
    const page = await strapi.documents(UID).findOne({
      documentId: id,
      populate: PAGE_POPULATE,
      status: 'published',
      ...(locale ? { locale } : {}),
    });

    if (!page) {
      ctx.notFound('Page not found');
      return;
    }
    ctx.body = { data: page, meta: {} };
  },

  async findBySlug(ctx) {
    const { slug } = ctx.params;
    const { locale } = ctx.query as any;
    const pages = await strapi.documents(UID).findMany({
      filters: { slug: { $eq: slug } },
      populate: PAGE_POPULATE,
      status: 'published',
      limit: 1,
      ...(locale ? { locale } : {}),
    });

    const page = pages?.[0];
    if (!page) {
      ctx.notFound('Page not found');
      return;
    }
    ctx.body = { data: page, meta: {} };
  },

  async getHomepage(ctx) {
    const { locale } = ctx.query as any;
    const pages = await strapi.documents(UID).findMany({
      filters: { isHomepage: { $eq: true } },
      populate: PAGE_POPULATE,
      status: 'published',
      limit: 1,
      ...(locale ? { locale } : {}),
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
