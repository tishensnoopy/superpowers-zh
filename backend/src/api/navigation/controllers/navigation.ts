import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::navigation.navigation', ({ strapi }) => ({
  async find(ctx) {
    console.log('[Navigation] find() called');
    try {
      ctx.query = {
        ...ctx.query,
        populate: ['children'],
      };
      const result = await super.find(ctx);
      console.log('[Navigation] find() completed, count:', result.data?.length);
      return result;
    } catch (err) {
      console.error('[Navigation] find() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async findOne(ctx) {
    console.log('[Navigation] findOne() called, id:', ctx.params.id);
    try {
      const result = await super.findOne(ctx);
      console.log('[Navigation] findOne() completed');
      return result;
    } catch (err) {
      console.error('[Navigation] findOne() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async getNavigationTree(ctx) {
    console.log('[Navigation] getNavigationTree() called');
    try {
      const items = await strapi.db.query('api::navigation.navigation').findMany({
        where: { parent: null },
        orderBy: { position: 'asc' },
        populate: {
          children: {
            orderBy: { position: 'asc' },
          },
        },
      });

      console.log('[Navigation] getNavigationTree() completed, root items:', items.length);
      return { data: items, meta: {} };
    } catch (err) {
      console.error('[Navigation] getNavigationTree() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async create(ctx) {
    console.log('[Navigation] create() called');
    try {
      const result = await super.create(ctx);
      console.log('[Navigation] create() completed successfully, id:', result.data?.id);
      return result;
    } catch (err) {
      console.error('[Navigation] create() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async update(ctx) {
    console.log('[Navigation] update() called, id:', ctx.params.id);
    try {
      const result = await super.update(ctx);
      console.log('[Navigation] update() completed successfully');
      return result;
    } catch (err) {
      console.error('[Navigation] update() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async delete(ctx) {
    console.log('[Navigation] delete() called, id:', ctx.params.id);
    try {
      const result = await super.delete(ctx);
      console.log('[Navigation] delete() completed successfully');
      return result;
    } catch (err) {
      console.error('[Navigation] delete() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
}));
