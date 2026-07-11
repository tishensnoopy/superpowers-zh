import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::product-category.product-category', ({ strapi }) => ({
  async getCategoryTree() {
    console.log('[ProductCategoryService] getCategoryTree() called');
    try {
      const categories = await strapi.db.query('api::product-category.product-category').findMany({
        where: { parent: null, isActive: true },
        orderBy: { position: 'asc' },
        populate: {
          children: {
            where: { isActive: true },
            orderBy: { position: 'asc' },
          },
        },
      });
      console.log('[ProductCategoryService] getCategoryTree() completed, root categories:', categories.length);
      return categories;
    } catch (err) {
      console.error('[ProductCategoryService] getCategoryTree() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async initializeDefaults() {
    console.log('[ProductCategoryService] initializeDefaults() called');
    try {
      const existing = await strapi.db.query('api::product-category.product-category').findMany();
      console.log('[ProductCategoryService] initializeDefaults() found existing records:', existing.length);

      if (existing.length === 0) {
        console.log('[ProductCategoryService] initializeDefaults() creating default categories');
        const defaults = [
          { name: 'Category A', slug: 'category-a', position: 0, isActive: true },
          { name: 'Category B', slug: 'category-b', position: 1, isActive: true },
          { name: 'Category C', slug: 'category-c', position: 2, isActive: true },
        ];
        console.log('[ProductCategoryService] initializeDefaults() defaults:', JSON.stringify(defaults));

        const created = await Promise.all(
          defaults.map((item, index) => {
            return this.create({ data: item });
          })
        );
        console.log('[ProductCategoryService] initializeDefaults() created successfully, count:', created.length);
        return created;
      } else {
        console.log('[ProductCategoryService] initializeDefaults() skipping - already exists');
        return existing;
      }
    } catch (err) {
      console.error('[ProductCategoryService] initializeDefaults() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
}));
