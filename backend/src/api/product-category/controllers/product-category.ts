import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::product-category.product-category', ({ strapi }) => ({
  async find(ctx) {
    console.log('[ProductCategory] find() called');
    try {
      ctx.query = {
        ...ctx.query,
        populate: {
          children: '*',
          parent: '*',
          products: '*',
        },
      };
      const result = await super.find(ctx);
      console.log('[ProductCategory] find() completed, count:', result.data?.length);
      return result;
    } catch (err) {
      console.error('[ProductCategory] find() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async findOne(ctx) {
    console.log('[ProductCategory] findOne() called, id:', ctx.params.id);
    try {
      ctx.query = {
        ...ctx.query,
        populate: {
          children: '*',
          parent: '*',
          products: '*',
        },
      };
      const result = await super.findOne(ctx);
      console.log('[ProductCategory] findOne() completed');
      return result;
    } catch (err) {
      console.error('[ProductCategory] findOne() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async create(ctx) {
    console.log('[ProductCategory] create() called');
    console.log('[ProductCategory] create() data:', JSON.stringify(ctx.request.body));
    try {
      const result = await super.create(ctx);
      console.log('[ProductCategory] create() completed successfully, id:', result.data?.id);
      return result;
    } catch (err) {
      console.error('[ProductCategory] create() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async update(ctx) {
    console.log('[ProductCategory] update() called, id:', ctx.params.id);
    console.log('[ProductCategory] update() data:', JSON.stringify(ctx.request.body));
    try {
      const result = await super.update(ctx);
      console.log('[ProductCategory] update() completed successfully');
      return result;
    } catch (err) {
      console.error('[ProductCategory] update() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async delete(ctx) {
    console.log('[ProductCategory] delete() called, id:', ctx.params.id);
    try {
      const result = await super.delete(ctx);
      console.log('[ProductCategory] delete() completed successfully');
      return result;
    } catch (err) {
      console.error('[ProductCategory] delete() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
}));
