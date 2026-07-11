import { strapi } from '@strapi/strapi';
import { addProductToIndex, updateProductInIndex, deleteProductFromIndex, ProductDocument } from '../../utils/meilisearch';

export async function syncProductAfterCreate(product: any): Promise<void> {
  console.log('[Product Sync Service] Syncing after create:', product.id);
  
  try {
    const doc = await buildProductDocument(product);
    await addProductToIndex(doc);
    console.log('[Product Sync Service] Successfully synced product:', product.name);
  } catch (error) {
    console.error('[Product Sync Service] Error syncing product:', error);
  }
}

export async function syncProductAfterUpdate(product: any): Promise<void> {
  console.log('[Product Sync Service] Syncing after update:', product.id);
  
  try {
    const doc = await buildProductDocument(product);
    await updateProductInIndex(doc);
    console.log('[Product Sync Service] Successfully updated product:', product.name);
  } catch (error) {
    console.error('[Product Sync Service] Error updating product:', error);
  }
}

export async function syncProductAfterDelete(productId: number): Promise<void> {
  console.log('[Product Sync Service] Syncing after delete:', productId);
  
  try {
    await deleteProductFromIndex(productId.toString());
    console.log('[Product Sync Service] Successfully deleted product:', productId);
  } catch (error) {
    console.error('[Product Sync Service] Error deleting product:', error);
  }
}

async function buildProductDocument(product: any): Promise<ProductDocument> {
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
}

export async function syncAllProducts(): Promise<void> {
  console.log('[Product Sync Service] Syncing all products...');
  
  try {
    const products = await strapi.db.query('api::product.product').findMany({
      where: { publishedAt: { $notNull: true } },
      populate: ['categories'],
    });
    
    console.log('[Product Sync Service] Found:', products.length, 'published products');
    
    for (const product of products) {
      try {
        const doc = await buildProductDocument(product);
        await addProductToIndex(doc);
      } catch (error) {
        console.error('[Product Sync Service] Error syncing product:', product.id, error);
      }
    }
    
    console.log('[Product Sync Service] All products synced successfully');
  } catch (error) {
    console.error('[Product Sync Service] Error syncing all products:', error);
    throw error;
  }
}
