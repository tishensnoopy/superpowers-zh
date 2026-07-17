import { factories } from '@strapi/strapi';
import { addProductToIndex, updateProductInIndex, deleteProductFromIndex, ProductDocument } from '../../../utils/meilisearch';

export default factories.createCoreService('api::product.product', ({ strapi }) => ({
  async search(params: any) {
    console.log('[ProductService] search() called, params:', params);
    try {
      const query = params?.query || '';
      const page = params?.page || 1;
      const pageSize = params?.pageSize || 10;

      const products = await strapi.db.query('api::product.product').findMany({
        where: {
          publishedAt: { $notNull: true },
          $or: [
            { name: { $containsi: query } },
            { description: { $containsi: query } },
            { slug: { $containsi: query } },
          ],
        },
        populate: ['categories', 'images'],
        offset: (page - 1) * pageSize,
        limit: pageSize,
      });

      const total = await strapi.db.query('api::product.product').count({
        where: {
          publishedAt: { $notNull: true },
          $or: [
            { name: { $containsi: query } },
            { description: { $containsi: query } },
            { slug: { $containsi: query } },
          ],
        },
      });

      console.log('[ProductService] search() completed, found:', products.length);
      return { data: products, meta: { total, page, pageSize } };
    } catch (err) {
      console.error('[ProductService] search() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async sync() {
    console.log('[ProductService] sync() called');
    try {
      const products = await strapi.db.query('api::product.product').findMany({
        where: { publishedAt: { $notNull: true } },
        populate: ['categories'],
      });

      console.log('[ProductService] sync() found:', products.length, 'published products');

      for (const product of products) {
        try {
          const doc = await this.buildProductDocument(product);
          await addProductToIndex(doc);
        } catch (error) {
          console.error('[ProductService] sync() error syncing product:', product.id, error);
        }
      }

      console.log('[ProductService] sync() completed successfully');
      return { success: true, count: products.length };
    } catch (err) {
      console.error('[ProductService] sync() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async compare(params: any) {
    console.log('[ProductService] compare() called, params:', params);
    try {
      const ids = params?.ids || [];
      if (!Array.isArray(ids) || ids.length === 0) {
        return { data: [] };
      }

      const products = await strapi.db.query('api::product.product').findMany({
        where: { id: { $in: ids }, publishedAt: { $notNull: true } },
        populate: ['categories', 'images', 'specs'],
      });

      console.log('[ProductService] compare() completed, found:', products.length);
      return { data: products };
    } catch (err) {
      console.error('[ProductService] compare() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async featured() {
    console.log('[ProductService] featured() called');
    try {
      const products = await strapi.db.query('api::product.product').findMany({
        where: { publishedAt: { $notNull: true }, isFeatured: true },
        populate: ['categories', 'images'],
        orderBy: { position: 'asc' },
      });

      console.log('[ProductService] featured() completed, found:', products.length);
      return { data: products };
    } catch (err) {
      console.error('[ProductService] featured() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async withCategory(params: any) {
    console.log('[ProductService] withCategory() called, params:', params);
    try {
      const categorySlug = params?.categorySlug || '';
      const page = params?.page || 1;
      const pageSize = params?.pageSize || 10;

      const category = await strapi.db.query('api::product-category.product-category').findOne({
        where: { slug: categorySlug, isActive: true },
      });

      if (!category) {
        console.warn('[ProductService] withCategory() category not found:', categorySlug);
        return { data: [], meta: { total: 0 } };
      }

      const products = await strapi.db.query('api::product.product').findMany({
        where: {
          publishedAt: { $notNull: true },
          categories: { id: category.id },
        },
        populate: ['categories', 'images'],
        offset: (page - 1) * pageSize,
        limit: pageSize,
      });

      const total = await strapi.db.query('api::product.product').count({
        where: {
          publishedAt: { $notNull: true },
          categories: { id: category.id },
        },
      });

      console.log('[ProductService] withCategory() completed, found:', products.length);
      return { data: products, meta: { total, page, pageSize, category } };
    } catch (err) {
      console.error('[ProductService] withCategory() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async buildProductDocument(product: any): Promise<ProductDocument> {
    let categories = [];

    if (product.categories) {
      categories = product.categories;
    } else {
      const fullProduct = await strapi.db.query('api::product.product').findOne({
        where: { id: product.id },
        populate: ['categories'],
      });
      categories = fullProduct?.categories || [];
    }

    return {
      id: product.id.toString(),
      name: product.name,
      slug: product.slug,
      description: product.description || '',
      shortDescription: product.shortDescription || '',
      price: product.price,
      originalPrice: product.originalPrice,
      sku: product.sku,
      categories: categories?.map((c: any) => c.name) || [],
      categorySlugs: categories?.map((c: any) => c.slug) || [],
      isFeatured: product.isFeatured || false,
      isInStock: product.isInStock || false,
      createdAt: product.createdAt?.toISOString() || '',
    };
  },

  async syncProductAfterCreate(product: any): Promise<void> {
    console.log('[Product Sync Service] Syncing after create:', product.id);
    try {
      const doc = await this.buildProductDocument(product);
      await addProductToIndex(doc);
      console.log('[Product Sync Service] Successfully synced product:', product.name);
    } catch (error) {
      console.error('[Product Sync Service] Error syncing product:', error);
    }
  },

  async syncProductAfterUpdate(product: any): Promise<void> {
    console.log('[Product Sync Service] Syncing after update:', product.id);
    try {
      const doc = await this.buildProductDocument(product);
      await updateProductInIndex(doc);
      console.log('[Product Sync Service] Successfully updated product:', product.name);
    } catch (error) {
      console.error('[Product Sync Service] Error updating product:', error);
    }
  },

  async syncProductAfterDelete(productId: number): Promise<void> {
    console.log('[Product Sync Service] Syncing after delete:', productId);
    try {
      await deleteProductFromIndex(productId.toString());
      console.log('[Product Sync Service] Successfully deleted product:', productId);
    } catch (error) {
      console.error('[Product Sync Service] Error deleting product:', error);
    }
  },

  /**
   * Bootstrap 时确保 products 表有默认占位数据。仅在表为空时创建，
   * 避免首次启动时 Content Manager 显示空列表。已存在数据时跳过。
   * 关联到 product-category.initializeDefaults() 创建的默认分类。
   */
  async initializeDefaults() {
    console.log('[ProductService] initializeDefaults() called');
    try {
      const existing = await strapi.db.query('api::product.product').findMany();
      console.log('[ProductService] initializeDefaults() found existing records:', existing.length);

      if (existing.length > 0) {
        console.log('[ProductService] initializeDefaults() skipping - already exists');
        return existing;
      }

      console.log('[ProductService] initializeDefaults() creating default products');
      const categoryA = await strapi.db.query('api::product-category.product-category').findOne({
        where: { slug: 'category-a' },
      });

      const defaults = [
        {
          name: 'Product Sample A',
          slug: 'product-sample-a',
          description: 'Default sample product A. Replace with real data via Strapi Admin.',
          shortDescription: 'Sample product A',
          price: 0,
          isFeatured: false,
          isInStock: true,
          categories: categoryA ? [categoryA.id] : [],
        },
      ];

      const created = await Promise.all(
        defaults.map((item) => this.create({ data: item }))
      );
      console.log('[ProductService] initializeDefaults() created successfully, count:', created.length);
      return created;
    } catch (err) {
      console.error('[ProductService] initializeDefaults() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
}));
