import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::product.product', ({ strapi }) => ({
  async find(ctx) {
    console.log('[Product] find() called');
    try {
      ctx.query = {
        ...ctx.query,
        populate: {
          categories: '*',
          specs: '*',
          images: '*',
          thumbnail: '*',
          seo: '*',
        },
      };
      const result = await super.find(ctx);
      console.log('[Product] find() completed, count:', result.data?.length);
      return result;
    } catch (err) {
      console.error('[Product] find() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async findOne(ctx) {
    console.log('[Product] findOne() called, id:', ctx.params.id);
    try {
      ctx.query = {
        ...ctx.query,
        populate: {
          categories: '*',
          specs: '*',
          images: '*',
          thumbnail: '*',
          seo: '*',
        },
      };
      const result = await super.findOne(ctx);
      console.log('[Product] findOne() completed');
      return result;
    } catch (err) {
      console.error('[Product] findOne() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async findBySlug(ctx) {
    console.log('[Product] findBySlug() called, slug:', ctx.params.slug);
    try {
      const product = await strapi.db.query('api::product.product').findOne({
        where: { slug: ctx.params.slug },
        populate: {
          categories: '*',
          specs: '*',
          images: '*',
          thumbnail: '*',
          seo: '*',
        },
      });
      if (!product) {
        console.warn('[Product] findBySlug() product not found:', ctx.params.slug);
        return ctx.notFound('Product not found');
      }
      console.log('[Product] findBySlug() completed, id:', product.id);
      return { data: product, meta: {} };
    } catch (err) {
      console.error('[Product] findBySlug() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async findFeatured(ctx) {
    console.log('[Product] findFeatured() called');
    try {
      const products = await strapi.db.query('api::product.product').findMany({
        where: { isFeatured: true, isInStock: true },
        populate: {
          categories: '*',
          images: '*',
          thumbnail: '*',
        },
      });
      console.log('[Product] findFeatured() completed, count:', products.length);
      return { data: products, meta: {} };
    } catch (err) {
      console.error('[Product] findFeatured() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async findByCategory(ctx) {
    console.log('[Product] findByCategory() called, categoryId:', ctx.params.categoryId);
    try {
      const products = await strapi.db.query('api::product.product').findMany({
        where: { categories: { id: ctx.params.categoryId } },
        populate: {
          categories: '*',
          images: '*',
          thumbnail: '*',
        },
      });
      console.log('[Product] findByCategory() completed, count:', products.length);
      return { data: products, meta: {} };
    } catch (err) {
      console.error('[Product] findByCategory() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async create(ctx) {
    console.log('[Product] create() called');
    console.log('[Product] create() data:', JSON.stringify(ctx.request.body));
    try {
      const result = await super.create(ctx);
      console.log('[Product] create() completed successfully, id:', result.data?.id);
      return result;
    } catch (err) {
      console.error('[Product] create() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async update(ctx) {
    console.log('[Product] update() called, id:', ctx.params.id);
    console.log('[Product] update() data:', JSON.stringify(ctx.request.body));
    try {
      const result = await super.update(ctx);
      console.log('[Product] update() completed successfully');
      return result;
    } catch (err) {
      console.error('[Product] update() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async delete(ctx) {
    console.log('[Product] delete() called, id:', ctx.params.id);
    try {
      const result = await super.delete(ctx);
      console.log('[Product] delete() completed successfully');
      return result;
    } catch (err) {
      console.error('[Product] delete() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
}));
