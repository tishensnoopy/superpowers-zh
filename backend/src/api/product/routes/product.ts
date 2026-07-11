export default {
  routes: [
    {
      method: 'GET',
      path: '/products',
      handler: 'api::product.product.find',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/products/:id',
      handler: 'api::product.product.findOne',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/products/slug/:slug',
      handler: 'api::product.product.findBySlug',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/products/featured',
      handler: 'api::product.product.findFeatured',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/products/category/:categoryId',
      handler: 'api::product.product.findByCategory',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/products',
      handler: 'api::product.product.create',
      config: {
        auth: true,
      },
    },
    {
      method: 'PUT',
      path: '/products/:id',
      handler: 'api::product.product.update',
      config: {
        auth: true,
      },
    },
    {
      method: 'DELETE',
      path: '/products/:id',
      handler: 'api::product.product.delete',
      config: {
        auth: true,
      },
    },
  ],
};
