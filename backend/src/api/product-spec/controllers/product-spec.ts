import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::product-spec.product-spec', ({ strapi }) => ({
  async find(ctx) {
    console.log('[ProductSpec] find() called');
    try {
      const result = await super.find(ctx);
      console.log('[ProductSpec] find() completed, count:', result.data?.length);
      return result;
    } catch (err) {
      console.error('[ProductSpec] find() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async findOne(ctx) {
    console.log('[ProductSpec] findOne() called, id:', ctx.params.id);
    try {
      const result = await super.findOne(ctx);
      console.log('[ProductSpec] findOne() completed');
      return result;
    } catch (err) {
      console.error('[ProductSpec] findOne() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async create(ctx) {
    console.log('[ProductSpec] create() called');
    console.log('[ProductSpec] create() data:', JSON.stringify(ctx.request.body));
    try {
      const result = await super.create(ctx);
      console.log('[ProductSpec] create() completed successfully, id:', result.data?.id);
      return result;
    } catch (err) {
      console.error('[ProductSpec] create() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async update(ctx) {
    console.log('[ProductSpec] update() called, id:', ctx.params.id);
    console.log('[ProductSpec] update() data:', JSON.stringify(ctx.request.body));
    try {
      const result = await super.update(ctx);
      console.log('[ProductSpec] update() completed successfully');
      return result;
    } catch (err) {
      console.error('[ProductSpec] update() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async delete(ctx) {
    console.log('[ProductSpec] delete() called, id:', ctx.params.id);
    try {
      const result = await super.delete(ctx);
      console.log('[ProductSpec] delete() completed successfully');
      return result;
    } catch (err) {
      console.error('[ProductSpec] delete() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
}));
