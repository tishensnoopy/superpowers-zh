import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::page.page', ({ strapi }) => ({
  async initializeDefaults() {
    console.log('[PageService] initializeDefaults() called');
    try {
      const existing = await strapi.db.query('api::page.page').findMany();
      console.log('[PageService] initializeDefaults() found existing records:', existing.length);

      if (existing.length === 0) {
        console.log('[PageService] initializeDefaults() creating default pages');
        const defaults = [
          {
            title: 'Home',
            slug: '/',
            isHomepage: true,
            layout: 'full-width',
            showNavigation: true,
            showFooter: true,
            sections: [],
          },
          {
            title: 'Products',
            slug: '/products',
            isHomepage: false,
            layout: 'full-width',
            showNavigation: true,
            showFooter: true,
            sections: [],
          },
          {
            title: 'About',
            slug: '/about',
            isHomepage: false,
            layout: 'full-width',
            showNavigation: true,
            showFooter: true,
            sections: [],
          },
          {
            title: 'Contact',
            slug: '/contact',
            isHomepage: false,
            layout: 'full-width',
            showNavigation: true,
            showFooter: true,
            sections: [],
          },
        ];
        console.log('[PageService] initializeDefaults() defaults:', JSON.stringify(defaults));

        const created = await Promise.all(
          defaults.map((item, index) => {
            return this.create({ data: item });
          })
        );
        console.log('[PageService] initializeDefaults() created successfully, count:', created.length);
        return created;
      } else {
        console.log('[PageService] initializeDefaults() skipping - already exists');
        return existing;
      }
    } catch (err) {
      console.error('[PageService] initializeDefaults() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async getPageTree() {
    console.log('[PageService] getPageTree() called');
    try {
      const pages = await strapi.db.query('api::page.page').findMany({
        where: { parent: null },
        orderBy: { createdAt: 'asc' },
        populate: {
          children: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      console.log('[PageService] getPageTree() completed, root pages:', pages.length);
      return pages;
    } catch (err) {
      console.error('[PageService] getPageTree() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
}));
