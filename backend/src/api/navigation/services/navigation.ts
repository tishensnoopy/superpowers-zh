import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::navigation.navigation', ({ strapi }) => ({
  async getNavigationTree() {
    console.log('[NavigationService] getNavigationTree() called');
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
      console.log('[NavigationService] getNavigationTree() completed, root items:', items.length);
      return items;
    } catch (err) {
      console.error('[NavigationService] getNavigationTree() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async initializeDefaults() {
    console.log('[NavigationService] initializeDefaults() called');
    try {
      const existing = await strapi.db.query('api::navigation.navigation').findMany();
      console.log('[NavigationService] initializeDefaults() found existing records:', existing.length);

      if (existing.length === 0) {
        console.log('[NavigationService] initializeDefaults() creating default navigation items');
        const defaults = [
          { name: 'Home', url: '/', position: 0, isActive: true, isExternal: false },
          { name: 'Products', url: '/products', position: 1, isActive: true, isExternal: false },
          { name: 'About', url: '/about', position: 2, isActive: true, isExternal: false },
          { name: 'Contact', url: '/contact', position: 3, isActive: true, isExternal: false },
        ];
        console.log('[NavigationService] initializeDefaults() defaults:', JSON.stringify(defaults));

        const created = await Promise.all(
          defaults.map((item, index) => {
            return this.create({ data: item });
          })
        );
        console.log('[NavigationService] initializeDefaults() created successfully, count:', created.length);
        return created;
      } else {
        console.log('[NavigationService] initializeDefaults() skipping - already exists');
        return existing;
      }
    } catch (err) {
      console.error('[NavigationService] initializeDefaults() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
}));
