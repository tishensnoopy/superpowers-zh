import { factories } from '@strapi/strapi';

// 'socialLinks.qrImage' 点路径深取二维码图片；浅层 'socialLinks' 不返回组件内媒体。
export const FOOTER_POPULATE = ['socialLinks.qrImage', 'quickLinks'];

export default factories.createCoreController('api::footer.footer', ({ strapi }) => ({
  async find(ctx) {
    console.log('[Footer] find() called - getting footer settings');
    try {
      ctx.query = {
        ...ctx.query,
        populate: FOOTER_POPULATE,
      };
      const result = await super.find(ctx);
      console.log('[Footer] find() completed successfully');
      return result;
    } catch (err) {
      console.error('[Footer] find() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async create(ctx) {
    console.log('[Footer] create() called - creating new footer');
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
