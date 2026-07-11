import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::footer.footer', ({ strapi }) => ({
  async initializeDefaults() {
    console.log('[FooterService] initializeDefaults() called');
    try {
      const existing = await strapi.db.query('api::footer.footer').findMany();
      console.log('[FooterService] initializeDefaults() found existing records:', existing.length);

      if (existing.length === 0) {
        console.log('[FooterService] initializeDefaults() creating default footer');
        const defaults = {
          copyright: `© ${new Date().getFullYear()} Enterprise Website. All rights reserved.`,
          aboutText: '',
          socialLinks: [],
          quickLinks: [],
        };
        console.log('[FooterService] initializeDefaults() defaults:', JSON.stringify(defaults));

        const created = await this.create({ data: defaults });
        console.log('[FooterService] initializeDefaults() created successfully, id:', created.id);
        return created;
      } else {
        console.log('[FooterService] initializeDefaults() skipping - already exists');
        return existing[0];
      }
    } catch (err) {
      console.error('[FooterService] initializeDefaults() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
}));
