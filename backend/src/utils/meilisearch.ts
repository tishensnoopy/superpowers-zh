const MEILI_HOST = process.env.MEILI_HOST || '';
const MEILI_MASTER_KEY = process.env.MEILI_MASTER_KEY || '';

let client: any = null;
let isAvailable = false;

export function isMeiliAvailable(): boolean {
  return isAvailable && !!MEILI_HOST && !!MEILI_MASTER_KEY;
}

async function getMeilisearchClass(): Promise<any> {
  // @ts-ignore - meilisearch is ESM, use dynamic require
  const { Meilisearch } = await import('meilisearch');
  return Meilisearch;
}

async function checkConnection(): Promise<boolean> {
  if (!MEILI_HOST || !MEILI_MASTER_KEY) {
    console.log('[MeiliSearch] Disabled - MEILI_HOST or MEILI_MASTER_KEY not set');
    return false;
  }

  try {
    const Meilisearch = await getMeilisearchClass();
    const testClient = new Meilisearch({
      host: MEILI_HOST,
      apiKey: MEILI_MASTER_KEY,
    });
    await testClient.health();
    isAvailable = true;
    console.log('[MeiliSearch] Connection successful');
    return true;
  } catch (err) {
    console.warn('[MeiliSearch] Connection failed:', err instanceof Error ? err.message : err);
    isAvailable = false;
    return false;
  }
}

export async function getMeiliClient(): Promise<any> {
  if (!MEILI_HOST || !MEILI_MASTER_KEY) {
    return null;
  }

  if (!isAvailable) {
    await checkConnection();
  }

  if (!isAvailable) {
    return null;
  }

  if (!client) {
    const Meilisearch = await getMeilisearchClass();
    client = new Meilisearch({
      host: MEILI_HOST,
      apiKey: MEILI_MASTER_KEY,
    });
  }

  return client;
}

export async function getProductsIndex(): Promise<any> {
  const client = await getMeiliClient();
  if (!client) {
    return null;
  }

  const index = client.index('products');

  try {
    const exists = await index.exists();
    if (!exists) {
      console.log('[MeiliSearch] Creating products index...');
      await client.createIndex('products');
    }

    await configureProductsIndex(index);
    return index;
  } catch (err) {
    console.warn('[MeiliSearch] Failed to get products index:', err instanceof Error ? err.message : err);
    return null;
  }
}

async function configureProductsIndex(index: any) {
  try {
    const settings = await index.getSettings();

    // 已有索引也需要补应用新设置（如后来新增的 locale 过滤字段），
    // 因此除了空设置外，检测到 filterableAttributes 缺少 locale 时也重新配置。
    const needsConfigure =
      settings.searchableAttributes?.length === 0 ||
      !settings.searchableAttributes ||
      !settings.filterableAttributes?.includes('locale');

    if (needsConfigure) {
      console.log('[MeiliSearch] Configuring products index settings...');

      await index.updateSettings({
        searchableAttributes: [
          'name',
          'description',
          'shortDescription',
          'sku',
          'categories',
        ],
        filterableAttributes: [
          'categories',
          'categorySlugs',
          'price',
          'isFeatured',
          'isInStock',
          'locale',
        ],
        sortableAttributes: [
          'name',
          'price',
          'originalPrice',
          'createdAt',
          'isFeatured',
        ],
        rankingRules: [
          'words',
          'typo',
          'proximity',
          'attribute',
          'sort',
          'exactness',
        ],
        distinctAttribute: 'slug',
        stopWords: ['的', '是', '在', '和', '有', '我', '他', '她', '它', '了', '就', '都'],
      });
      console.log('[MeiliSearch] Products index settings configured');
    }
  } catch (err) {
    console.warn('[MeiliSearch] Failed to configure products index:', err instanceof Error ? err.message : err);
  }
}

export interface ProductDocument {
  id: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  price?: number;
  originalPrice?: number;
  sku: string;
  categories: string[];
  categorySlugs: string[];
  isFeatured: boolean;
  isInStock: boolean;
  createdAt: string;
  locale?: string;
}

export async function addProductToIndex(product: ProductDocument): Promise<void> {
  const index = await getProductsIndex();
  if (!index) {
    console.log('[MeiliSearch] Skipping addProductToIndex - service not available');
    return;
  }

  try {
    await index.addDocuments([product]);
    console.log('[MeiliSearch] Added product:', product.name);
  } catch (err) {
    console.warn('[MeiliSearch] Failed to add product:', err instanceof Error ? err.message : err);
  }
}

export async function updateProductInIndex(product: ProductDocument): Promise<void> {
  const index = await getProductsIndex();
  if (!index) {
    console.log('[MeiliSearch] Skipping updateProductInIndex - service not available');
    return;
  }

  try {
    await index.updateDocuments([product]);
    console.log('[MeiliSearch] Updated product:', product.name);
  } catch (err) {
    console.warn('[MeiliSearch] Failed to update product:', err instanceof Error ? err.message : err);
  }
}

export async function deleteProductFromIndex(id: string): Promise<void> {
  const index = await getProductsIndex();
  if (!index) {
    console.log('[MeiliSearch] Skipping deleteProductFromIndex - service not available');
    return;
  }

  try {
    await index.deleteDocument(id);
    console.log('[MeiliSearch] Deleted product:', id);
  } catch (err) {
    console.warn('[MeiliSearch] Failed to delete product:', err instanceof Error ? err.message : err);
  }
}

export async function searchProducts(
  query: string,
  filters?: {
    categories?: string[];
    categorySlugs?: string[];
    priceMin?: number;
    priceMax?: number;
    isFeatured?: boolean;
    isInStock?: boolean;
    locale?: string;
  },
  sort?: string[],
  limit: number = 20,
  offset: number = 0
) {
  const index = await getProductsIndex();
  if (!index) {
    console.log('[MeiliSearch] Skipping searchProducts - service not available');
    return {
      hits: [],
      total: 0,
      page: 1,
      pageSize: limit,
      pageCount: 0,
    };
  }

  try {
    const filterStrings: string[] = [];
    if (filters) {
      if (filters.categories?.length) {
        filterStrings.push(`categories IN [${filters.categories.map(c => `"${c}"`).join(',')}]`);
      }
      if (filters.categorySlugs?.length) {
        filterStrings.push(`categorySlugs IN [${filters.categorySlugs.map(c => `"${c}"`).join(',')}]`);
      }
      if (filters.priceMin !== undefined) {
        filterStrings.push(`price >= ${filters.priceMin}`);
      }
      if (filters.priceMax !== undefined) {
        filterStrings.push(`price <= ${filters.priceMax}`);
      }
      if (filters.isFeatured !== undefined) {
        filterStrings.push(`isFeatured = ${filters.isFeatured}`);
      }
      if (filters.isInStock !== undefined) {
        filterStrings.push(`isInStock = ${filters.isInStock}`);
      }
      if (filters.locale) {
        filterStrings.push(`locale = "${filters.locale}"`);
      }
    }

    const result = await index.search(query, {
      filter: filterStrings.length ? filterStrings.join(' AND ') : undefined,
      sort: sort || undefined,
      limit,
      offset,
      attributesToHighlight: ['name', 'description'],
    });

    return {
      hits: result.hits,
      total: result.totalHits,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      pageCount: Math.ceil(result.totalHits / limit),
    };
  } catch (err) {
    console.warn('[MeiliSearch] Search failed:', err instanceof Error ? err.message : err);
    return {
      hits: [],
      total: 0,
      page: 1,
      pageSize: limit,
      pageCount: 0,
    };
  }
}

export async function getProductCategories(): Promise<string[]> {
  const index = await getProductsIndex();
  if (!index) {
    return [];
  }

  try {
    const stats = await index.getStats();
    return [];
  } catch (err) {
    console.warn('[MeiliSearch] Failed to get categories:', err instanceof Error ? err.message : err);
    return [];
  }
}

export async function syncAllProducts(products: ProductDocument[]): Promise<void> {
  const index = await getProductsIndex();
  if (!index) {
    console.log('[MeiliSearch] Skipping syncAllProducts - service not available');
    return;
  }

  try {
    await index.deleteAllDocuments();
    console.log('[MeiliSearch] Deleted all existing documents');

    if (products.length > 0) {
      await index.addDocuments(products);
      console.log('[MeiliSearch] Synced', products.length, 'products');
    }
  } catch (err) {
    console.warn('[MeiliSearch] Sync failed:', err instanceof Error ? err.message : err);
  }
}
