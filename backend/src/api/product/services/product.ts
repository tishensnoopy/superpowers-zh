import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::product.product', ({ strapi }) => ({
  async initializeDefaults() {
    console.log('[ProductService] initializeDefaults() called');
    try {
      const existing = await strapi.db.query('api::product.product').findMany();
      console.log('[ProductService] initializeDefaults() found existing records:', existing.length);

      if (existing.length === 0) {
        console.log('[ProductService] initializeDefaults() creating default products');
        const categories = await strapi.db.query('api::product-category.product-category').findMany();
        const specs = await strapi.db.query('api::product-spec.product-spec').findMany();

        const defaults = [
          {
            name: 'Product A',
            slug: 'product-a',
            description: 'This is product A description',
            shortDescription: 'Product A short description',
            price: 199.99,
            originalPrice: 299.99,
            sku: 'SKU-A001',
            stock: 100,
            isInStock: true,
            isFeatured: true,
            categories: categories.slice(0, 1).map(c => c.id),
            specs: specs.slice(0, 2).map(s => s.id),
            specValues: { dimensions: '100x200x300', weight: '5.5', material: 'Metal', color: 'Red' },
          },
          {
            name: 'Product B',
            slug: 'product-b',
            description: 'This is product B description',
            shortDescription: 'Product B short description',
            price: 299.99,
            originalPrice: 399.99,
            sku: 'SKU-B001',
            stock: 50,
            isInStock: true,
            isFeatured: true,
            categories: categories.slice(0, 1).map(c => c.id),
            specs: specs.slice(0, 2).map(s => s.id),
            specValues: { dimensions: '150x250x350', weight: '8.0', material: 'Plastic', color: 'Blue' },
          },
          {
            name: 'Product C',
            slug: 'product-c',
            description: 'This is product C description',
            shortDescription: 'Product C short description',
            price: 399.99,
            originalPrice: 499.99,
            sku: 'SKU-C001',
            stock: 30,
            isInStock: true,
            isFeatured: false,
            categories: categories.slice(1, 2).map(c => c.id),
            specs: specs.slice(0, 2).map(s => s.id),
            specValues: { dimensions: '200x300x400', weight: '12.0', material: 'Wood', color: 'Green' },
          },
        ];
        console.log('[ProductService] initializeDefaults() defaults:', JSON.stringify(defaults));

        const created = await Promise.all(
          defaults.map((item, index) => {
            return this.create({ data: item });
          })
        );
        console.log('[ProductService] initializeDefaults() created successfully, count:', created.length);
        return created;
      } else {
        console.log('[ProductService] initializeDefaults() skipping - already exists');
        return existing;
      }
    } catch (err) {
      console.error('[ProductService] initializeDefaults() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async searchProducts(query: string, categoryId?: number) {
    console.log('[ProductService] searchProducts() called, query:', query, 'categoryId:', categoryId);
    try {
      let whereClause: any = { isInStock: true };
      if (query) {
        whereClause.$or = [
          { name: { $containsi: query } },
          { description: { $containsi: query } },
          { sku: { $containsi: query } },
        ];
      }
      if (categoryId) {
        whereClause.categories = { id: categoryId };
      }

      const products = await strapi.db.query('api::product.product').findMany({
        where: whereClause,
        populate: {
          categories: '*',
          images: '*',
          thumbnail: '*',
        },
      });
      console.log('[ProductService] searchProducts() completed, count:', products.length);
      return products;
    } catch (err) {
      console.error('[ProductService] searchProducts() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
}));
