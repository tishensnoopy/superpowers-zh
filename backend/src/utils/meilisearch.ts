import { MeiliSearch, Index } from 'meilisearch';

const MEILI_HOST = process.env.MEILI_HOST || 'http://localhost:7700';
const MEILI_MASTER_KEY = process.env.MEILI_MASTER_KEY || '';

let client: MeiliSearch | null = null;

export function getMeiliClient(): MeiliSearch {
  if (!client) {
    client = new MeiliSearch({
      host: MEILI_HOST,
      apiKey: MEILI_MASTER_KEY,
    });
  }
  return client;
}

export async function getProductsIndex(): Promise<Index> {
  const client = getMeiliClient();
  const index = client.index('products');
  
  const exists = await index.exists();
  if (!exists) {
    console.log('[MeiliSearch] Creating products index...');
    await client.createIndex('products');
  }
  
  await configureProductsIndex(index);
  
  return index;
}

async function configureProductsIndex(index: Index) {
  const settings = await index.getSettings();
  
  if (settings.searchableAttributes?.length === 0 || !settings.searchableAttributes) {
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
}

export async function addProductToIndex(product: ProductDocument): Promise<void> {
  const index = await getProductsIndex();
  await index.addDocuments([product]);
  console.log('[MeiliSearch] Added product:', product.name);
}

export async function updateProductInIndex(product: ProductDocument): Promise<void> {
  const index = await getProductsIndex();
  await index.updateDocuments([product]);
  console.log('[MeiliSearch] Updated product:', product.name);
}

export async function deleteProductFromIndex(id: string): Promise<void> {
  const index = await getProductsIndex();
  await index.deleteDocument(id);
  console.log('[MeiliSearch] Deleted product:', id);
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
  },
  sort?: string[],
  limit: number = 20,
  offset: number = 0
) {
  const index = await getProductsIndex();
  
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
}

export async function getProductCategories(): Promise<string[]> {
  const index = await getProductsIndex();
  const facets = await index.getFacets({
    filters: ['categories'],
  });
  return facets.categories || [];
}

export async function syncAllProducts(products: ProductDocument[]): Promise<void> {
  const index = await getProductsIndex();
  
  await index.deleteAllDocuments();
  console.log('[MeiliSearch] Deleted all existing documents');
  
  if (products.length > 0) {
    await index.addDocuments(products);
    console.log('[MeiliSearch] Synced', products.length, 'products');
  }
}
