import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::product-spec.product-spec', ({ strapi }) => ({
  async initializeDefaults() {
    console.log('[ProductSpecService] initializeDefaults() called');
    try {
      const existing = await strapi.db.query('api::product-spec.product-spec').findMany();
      console.log('[ProductSpecService] initializeDefaults() found existing records:', existing.length);

      if (existing.length === 0) {
        console.log('[ProductSpecService] initializeDefaults() creating default specs');
        const defaults = [
          { name: 'Dimensions', code: 'dimensions', unit: 'mm', type: 'text', isVisible: true, position: 0 },
          { name: 'Weight', code: 'weight', unit: 'kg', type: 'number', isVisible: true, position: 1 },
          { name: 'Material', code: 'material', unit: '', type: 'text', isVisible: true, position: 2 },
          { name: 'Color', code: 'color', unit: '', type: 'select', options: 'Red,Blue,Green,Black,White', isVisible: true, position: 3 },
        ];
        console.log('[ProductSpecService] initializeDefaults() defaults:', JSON.stringify(defaults));

        const created = await Promise.all(
          defaults.map((item, index) => {
            return this.create({ data: item });
          })
        );
        console.log('[ProductSpecService] initializeDefaults() created successfully, count:', created.length);
        return created;
      } else {
        console.log('[ProductSpecService] initializeDefaults() skipping - already exists');
        return existing;
      }
    } catch (err) {
      console.error('[ProductSpecService] initializeDefaults() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async getVisibleSpecs() {
    console.log('[ProductSpecService] getVisibleSpecs() called');
    try {
      const specs = await strapi.db.query('api::product-spec.product-spec').findMany({
        where: { isVisible: true },
        orderBy: { position: 'asc' },
      });
      console.log('[ProductSpecService] getVisibleSpecs() completed, count:', specs.length);
      return specs;
    } catch (err) {
      console.error('[ProductSpecService] getVisibleSpecs() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
}));
