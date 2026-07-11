import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::site-settings.site-settings', ({ strapi }) => ({
  async initializeDefaults() {
    console.log('[SiteSettingsService] initializeDefaults() called');
    try {
      const existing = await strapi.db.query('api::site-settings.site-settings').findMany();
      console.log('[SiteSettingsService] initializeDefaults() found existing records:', existing.length);

      if (existing.length === 0) {
        console.log('[SiteSettingsService] initializeDefaults() creating default site settings');
        const defaults = {
          name: 'Enterprise Website',
          slogan: 'Your trusted business partner',
          phone: '',
          email: '',
          address: '',
          wechat: '',
        };
        console.log('[SiteSettingsService] initializeDefaults() defaults:', JSON.stringify(defaults));

        const created = await this.create({ data: defaults });
        console.log('[SiteSettingsService] initializeDefaults() created successfully, id:', created.id);
        return created;
      } else {
        console.log('[SiteSettingsService] initializeDefaults() skipping - already exists');
        return existing[0];
      }
    } catch (err) {
      console.error('[SiteSettingsService] initializeDefaults() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
}));
