import { factories } from '@strapi/strapi';
import { searchProducts, syncAllProducts, ProductDocument, isMeiliAvailable } from '../../../utils/meilisearch';

async function searchProductsViaDb(
  strapi: any,
  params: {
    query: string;
    categorySlugs?: string[];
    isFeatured?: boolean;
    isInStock?: boolean;
    priceMin?: number;
    priceMax?: number;
    sort?: string[];
    limit: number;
    offset: number;
    locale?: string;
  }
) {
  const where: any = { publishedAt: { $notNull: true } };

  if (params.locale) {
    where.locale = params.locale;
  }

  if (params.query) {
    where.$or = [
      { name: { $containsi: params.query } },
      { shortDescription: { $containsi: params.query } },
    ];
  }

  if (params.categorySlugs?.length) {
    where.categories = { slug: { $in: params.categorySlugs } };
  }
  if (params.isFeatured !== undefined) {
    where.isFeatured = params.isFeatured;
  }
  if (params.isInStock !== undefined) {
    where.isInStock = params.isInStock;
  }
  if (params.priceMin !== undefined) {
    where.price = { $gte: params.priceMin };
  }
  if (params.priceMax !== undefined) {
    where.price = where.price
      ? { ...where.price, $lte: params.priceMax }
      : { $lte: params.priceMax };
  }

  let orderBy: any = { createdAt: 'desc' };
  if (params.sort?.length) {
    const firstSort = params.sort[0];
    const [field, direction] = firstSort.split(':');
    if (field && direction) {
      orderBy = { [field]: direction.toLowerCase() };
    }
  }

  const products = await strapi.db.query('api::product.product').findMany({
    where,
    orderBy,
    limit: params.limit,
    offset: params.offset,
    populate: ['categories'],
  });

  const total = await strapi.db.query('api::product.product').count({ where });

  const hits = products.map((p: any) => ({
    id: p.id.toString(),
    documentId: p.documentId,
    name: p.name,
    slug: p.slug,
    description: p.description || '',
    shortDescription: p.shortDescription || '',
    price: p.price,
    originalPrice: p.originalPrice,
    sku: p.sku || '',
    categories: p.categories?.map((c: any) => c.name) || [],
    categorySlugs: p.categories?.map((c: any) => c.slug) || [],
    isFeatured: p.isFeatured || false,
    isInStock: p.isInStock || false,
    createdAt: p.createdAt?.toISOString?.() || '',
  }));

  return {
    hits,
    total,
    page: Math.floor(params.offset / params.limit) + 1,
    pageSize: params.limit,
    pageCount: Math.ceil(total / params.limit),
  };
}

const PRODUCT_POPULATE = {
  thumbnail: true,
  categories: true,
  specs: true,
  objectives: true,
  outline: true,
  testimonials: true,
  seo: true,
  campus_links: {
    filters: { status: 'active' },
    populate: { campus: true },
  },
  teacher_links: {
    filters: { status: 'active' },
    populate: {
      teacher: { populate: { avatar: true } },
    },
  },
} as const;

const PRODUCT_POPULATE_DETAIL = {
  ...PRODUCT_POPULATE,
  images: true,
} as const;

export default factories.createCoreController('api::product.product', ({ strapi }) => ({
  async find(ctx) {
    const { locale } = ctx.query as any;
    const products = await strapi.documents('api::product.product').findMany({
      populate: PRODUCT_POPULATE,
      status: 'published',
      ...(locale ? { locale } : {}),
    });

    const data = products || [];
    ctx.body = {
      data,
      meta: {
        pagination: {
          page: 1,
          pageSize: data.length,
          pageCount: 1,
          total: data.length,
        },
      },
    };
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const { locale } = ctx.query as any;
    const product = await strapi.documents('api::product.product').findOne({
      documentId: id,
      populate: PRODUCT_POPULATE_DETAIL,
      status: 'published',
      ...(locale ? { locale } : {}),
    });

    if (!product) {
      ctx.notFound('Product not found');
      return;
    }
    ctx.body = { data: product, meta: {} };
  },

  async search(ctx) {
    const { query, categories, categorySlugs, priceMin, priceMax, isFeatured, isInStock, sort, limit, page, locale } = ctx.query;

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
      locale,
      meiliAvailable: isMeiliAvailable(),
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
    if (locale) {
      filters.locale = locale as string;
    }

    const sortArray = sort ? (Array.isArray(sort) ? sort : [sort]) : undefined;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    try {
      let results;

      if (isMeiliAvailable()) {
        results = await searchProducts(
          query as string || '',
          filters,
          sortArray,
          limitNum,
          offset
        );
      } else {
        console.log('[Product Search] MeiliSearch unavailable, falling back to DB query');
        results = await searchProductsViaDb(strapi, {
          query: (query as string) || '',
          categorySlugs: filters.categorySlugs,
          isFeatured: filters.isFeatured,
          isInStock: filters.isInStock,
          priceMin: filters.priceMin,
          priceMax: filters.priceMax,
          sort: sortArray,
          limit: limitNum,
          offset,
          locale: filters.locale,
        });
      }

      console.log('[Product Search] Results:', {
        query,
        total: results.total,
        page: results.page,
        pageCount: results.pageCount,
        source: isMeiliAvailable() ? 'meilisearch' : 'database',
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
        locale: product.locale,
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
    const { categorySlug, limit, page, locale } = ctx.query as any;

    console.log('[Products by Category] Request:', { categorySlug, limit, page, locale });

    if (!categorySlug) {
      ctx.status = 400;
      ctx.body = { error: '请提供分类路径' };
      return;
    }

    try {
      const category = await strapi.db.query('api::product-category.product-category').findOne({
        where: { slug: categorySlug, ...(locale ? { locale } : {}) },
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
          ...(locale ? { locale } : {}),
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
          ...(locale ? { locale } : {}),
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
    const { locale } = ctx.query as any;

    console.log('[Product findBySlug] Request:', { slug, locale });

    if (!slug) {
      ctx.status = 400;
      ctx.body = { error: '请提供课程 slug' };
      return;
    }

    try {
      // db.query 不过滤 locale 时双语同 slug 会恒返回默认语言，必须显式按 locale 过滤
      const product = await strapi.db.query('api::product.product').findOne({
        where: { slug, publishedAt: { $notNull: true }, ...(locale ? { locale } : {}) },
        populate: ['thumbnail', 'images', 'categories', 'objectives', 'outline', 'testimonials', 'seo'],
      });
      
      if (!product) {
        ctx.status = 404;
        ctx.body = { error: '课程不存在' };
        return;
      }
      
      console.log('[Product findBySlug] Found:', product.name);

      ctx.body = {
        data: product,
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
