import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::footer.footer', ({ strapi }) => ({
  async find(ctx) {
    console.log('[Footer] find() called - getting footer settings');
    try {
      const result = await super.find(ctx);
      console.log('[Footer] find() completed successfully');
      if (result.data && Array.isArray(result.data)) {
        result.data = result.data.map(item => {
          const { id, ...attributes } = item;
          return { id, attributes };
        });
      }
      return result;
    } catch (err) {
      console.error('[Footer] find() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async create(ctx) {
    console.log('[Footer] create() called - creating new footer');
    console.log('[Footer] create() data:', JSON.stringify(ctx.request.body));
    try {
      const result = await super.create(ctx);
      console.log('[Footer] create() completed successfully, id:', result.data?.id);
      return result;
    } catch (err) {
      console.error('[Footer] create() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async update(ctx) {
    console.log('[Footer] update() called - updating footer, id:', ctx.params.id);
    console.log('[Footer] update() data:', JSON.stringify(ctx.request.body));
    try {
      const result = await super.update(ctx);
      console.log('[Footer] update() completed successfully');
      return result;
    } catch (err) {
      console.error('[Footer] update() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async delete(ctx) {
    console.log('[Footer] delete() called - deleting footer, id:', ctx.params.id);
    try {
      const result = await super.delete(ctx);
      console.log('[Footer] delete() completed successfully');
      return result;
    } catch (err) {
      console.error('[Footer] delete() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
}));
