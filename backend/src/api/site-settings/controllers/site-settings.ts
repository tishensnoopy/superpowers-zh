import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::site-settings.site-settings', ({ strapi }) => ({
  async find(ctx) {
    console.log('[SiteSettings] find() called - getting global site settings');
    try {
      ctx.query = {
        ...ctx.query,
        populate: ['logo', 'favicon', 'seo'],
      };
      const result = await super.find(ctx);
      console.log('[SiteSettings] find() completed successfully');
      return result;
    } catch (err) {
      console.error('[SiteSettings] find() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async create(ctx) {
    console.log('[SiteSettings] create() called - creating new site settings');
    console.log('[SiteSettings] create() data:', JSON.stringify(ctx.request.body));
    try {
      const result = await super.create(ctx);
      console.log('[SiteSettings] create() completed successfully, id:', result.data?.id);
      return result;
    } catch (err) {
      console.error('[SiteSettings] create() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async update(ctx) {
    console.log('[SiteSettings] update() called - updating site settings, id:', ctx.params.id);
    console.log('[SiteSettings] update() data:', JSON.stringify(ctx.request.body));
    try {
      const result = await super.update(ctx);
      console.log('[SiteSettings] update() completed successfully');
      return result;
    } catch (err) {
      console.error('[SiteSettings] update() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async delete(ctx) {
    console.log('[SiteSettings] delete() called - deleting site settings, id:', ctx.params.id);
    try {
      const result = await super.delete(ctx);
      console.log('[SiteSettings] delete() completed successfully');
      return result;
    } catch (err) {
      console.error('[SiteSettings] delete() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
}));
