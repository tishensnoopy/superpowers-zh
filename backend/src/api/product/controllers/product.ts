import { factories } from '@strapi/strapi';
import { searchProducts, syncAllProducts, ProductDocument } from '../../../utils/meilisearch';

export default factories.createCoreController('api::product.product', ({ strapi }) => ({
  async search(ctx) {
    const { query, categories, categorySlugs, priceMin, priceMax, isFeatured, isInStock, sort, limit, page } = ctx.query;
    
    console.log('[Product Search] Request received:', {
      query,
      categories,
      categorySlugs,
      priceMin,
      priceMax,
      isFeatured,
      isInStock,
      sort,
      limit,
      page,
    });
    
    const filters: Parameters<typeof searchProducts>[1] = {};
    
    if (categories) {
      filters.categories = Array.isArray(categories) ? categories : [categories];
    }
    if (categorySlugs) {
      filters.categorySlugs = Array.isArray(categorySlugs) ? categorySlugs : [categorySlugs];
    }
    if (priceMin !== undefined && priceMin !== '') {
      filters.priceMin = parseFloat(priceMin as string);
    }
    if (priceMax !== undefined && priceMax !== '') {
      filters.priceMax = parseFloat(priceMax as string);
    }
    if (isFeatured !== undefined && isFeatured !== '') {
      filters.isFeatured = isFeatured === 'true';
    }
    if (isInStock !== undefined && isInStock !== '') {
      filters.isInStock = isInStock === 'true';
    }
    
    const sortArray = sort ? (Array.isArray(sort) ? sort : [sort]) : undefined;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;
    
    try {
      const results = await searchProducts(
        query as string || '',
        filters,
        sortArray,
        limitNum,
        offset
      );
      
      console.log('[Product Search] Results:', {
        query,
        total: results.total,
        page: results.page,
        pageCount: results.pageCount,
      });
      
      ctx.body = {
        data: results.hits,
        meta: {
          total: results.total,
          page: results.page,
          pageSize: results.pageSize,
          pageCount: results.pageCount,
        },
      };
    } catch (error) {
      console.error('[Product Search] Error:', error);
      ctx.status = 500;
      ctx.body = {
        error: '搜索失败',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
  
  async sync(ctx) {
    console.log('[Product Sync] Starting sync...');
    
    try {
      const products = await strapi.db.query('api::product.product').findMany({
        where: { publishedAt: { $notNull: true } },
        populate: ['categories'],
      });
      
      const documents: ProductDocument[] = products.map(product => ({
        id: product.id.toString(),
        name: product.name,
        slug: product.slug,
        description: product.description || '',
        shortDescription: product.shortDescription || '',
        price: product.price,
        originalPrice: product.originalPrice,
        sku: product.sku,
        categories: product.categories?.map(c => c.name) || [],
        categorySlugs: product.categories?.map(c => c.slug) || [],
        isFeatured: product.isFeatured || false,
        isInStock: product.isInStock || false,
        createdAt: product.createdAt?.toISOString() || '',
      }));
      
      await syncAllProducts(documents);
      
      console.log('[Product Sync] Completed:', documents.length, 'products');
      
      ctx.body = {
        success: true,
        count: documents.length,
        message: `已同步 ${documents.length} 个产品`,
      };
    } catch (error) {
      console.error('[Product Sync] Error:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: '同步失败',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
  
  async compare(ctx) {
    const { ids } = ctx.query;
    
    console.log('[Product Compare] Request:', ids);
    
    if (!ids) {
      ctx.status = 400;
      ctx.body = { error: '请提供产品 ID' };
      return;
    }
    
    const idArray = Array.isArray(ids) ? ids : typeof ids === 'string' ? ids.split(',').map((s: string) => s.trim()) : [];
    
    try {
      const products = await strapi.db.query('api::product.product').findMany({
        where: {
          id: { $in: idArray.map(id => parseInt(id)) },
          publishedAt: { $notNull: true },
        },
        populate: ['categories', 'specs', 'images'],
      });
      
      console.log('[Product Compare] Found:', products.length, 'products');
      
      ctx.body = {
        data: products,
        meta: {
          count: products.length,
        },
      };
    } catch (error) {
      console.error('[Product Compare] Error:', error);
      ctx.status = 500;
      ctx.body = {
        error: '对比失败',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
  
  async featured(ctx) {
    const { limit } = ctx.query;
    
    console.log('[Featured Products] Request:', { limit });
    
    try {
      const products = await strapi.db.query('api::product.product').findMany({
        where: {
          isFeatured: true,
          publishedAt: { $notNull: true },
        },
        populate: ['thumbnail', 'categories'],
        limit: parseInt(limit as string) || 8,
        orderBy: { createdAt: 'desc' },
      });
      
      console.log('[Featured Products] Found:', products.length);
      
      ctx.body = {
        data: products,
        meta: {
          count: products.length,
        },
      };
    } catch (error) {
      console.error('[Featured Products] Error:', error);
      ctx.status = 500;
      ctx.body = {
        error: '获取特色产品失败',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
  
  async withCategory(ctx) {
    const { categorySlug, limit, page } = ctx.query;
    
    console.log('[Products by Category] Request:', { categorySlug, limit, page });
    
    if (!categorySlug) {
      ctx.status = 400;
      ctx.body = { error: '请提供分类路径' };
      return;
    }
    
    try {
      const category = await strapi.db.query('api::product-category.product-category').findOne({
        where: { slug: categorySlug },
      });
      
      if (!category) {
        ctx.status = 404;
        ctx.body = { error: '分类不存在' };
        return;
      }
      
      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 20;
      const offset = (pageNum - 1) * limitNum;
      
      const products = await strapi.db.query('api::product.product').findMany({
        where: {
          categories: { slug: categorySlug },
          publishedAt: { $notNull: true },
        },
        populate: ['thumbnail', 'categories'],
        limit: limitNum,
        offset,
        orderBy: { createdAt: 'desc' },
      });
      
      const total = await strapi.db.query('api::product.product').count({
        where: {
          categories: { slug: categorySlug },
          publishedAt: { $notNull: true },
        },
      });
      
      console.log('[Products by Category] Found:', products.length, 'total:', total);
      
      ctx.body = {
        data: products,
        meta: {
          total,
          page: pageNum,
          pageSize: limitNum,
          pageCount: Math.ceil(total / limitNum),
          category: {
            id: category.id,
            name: category.name,
            slug: category.slug,
          },
        },
      };
    } catch (error) {
      console.error('[Products by Category] Error:', error);
      ctx.status = 500;
      ctx.body = {
        error: '获取分类产品失败',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async findBySlug(ctx) {
    const { slug } = ctx.params;
    
    console.log('[Product findBySlug] Request:', { slug });
    
    if (!slug) {
      ctx.status = 400;
      ctx.body = { error: '请提供课程 slug' };
      return;
    }
    
    try {
      const product = await strapi.db.query('api::product.product').findOne({
        where: { slug, publishedAt: { $notNull: true } },
        populate: ['thumbnail', 'images', 'categories', 'objectives', 'outline', 'testimonials'],
      });
      
      if (!product) {
        ctx.status = 404;
        ctx.body = { error: '课程不存在' };
        return;
      }
      
      console.log('[Product findBySlug] Found:', product.name);

      const { id, documentId, ...attributes } = product;

      ctx.body = {
        data: {
          id,
          documentId,
          attributes,
        },
        meta: {},
      };
    } catch (error) {
      console.error('[Product findBySlug] Error:', error);
      ctx.status = 500;
      ctx.body = {
        error: '获取课程失败',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
}));
