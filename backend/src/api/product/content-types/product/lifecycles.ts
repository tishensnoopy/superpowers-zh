export default {
  async afterCreate(event: any) {
    const { result } = event;
    console.log('[Product Lifecycle] afterCreate triggered:', result.id);
    const strapi = (global as any).strapi;
    if (strapi) {
      const productService = strapi.service('api::product.product');
      await productService.syncProductAfterCreate(result);
    }
  },
  
  async afterUpdate(event: any) {
    const { result } = event;
    console.log('[Product Lifecycle] afterUpdate triggered:', result.id);
    const strapi = (global as any).strapi;
    if (strapi) {
      const productService = strapi.service('api::product.product');
      await productService.syncProductAfterUpdate(result);
    }
  },
  
  async afterDelete(event: any) {
    const { result } = event;
    console.log('[Product Lifecycle] afterDelete triggered:', result.id);
    const strapi = (global as any).strapi;
    if (strapi) {
      const productService = strapi.service('api::product.product');
      await productService.syncProductAfterDelete(result.id);
    }
  },
};
