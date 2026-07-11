export default {
  routes: [
    {
      method: 'GET',
      path: '/api/products/search',
      handler: 'product.search',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/api/products/sync',
      handler: 'product.sync',
      config: {
        auth: {
          scope: ['api::product.product.sync'],
        },
      },
    },
    {
      method: 'GET',
      path: '/api/products/compare',
      handler: 'product.compare',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/api/products/featured',
      handler: 'product.featured',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/api/products/category/:categorySlug',
      handler: 'product.withCategory',
      config: {
        auth: false,
      },
    },
  ],
};
