export default {
  routes: [
    {
      method: 'GET',
      path: '/product-categories',
      handler: 'api::product-category.product-category.find',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/product-categories/tree',
      handler: 'api::product-category.product-category.getCategoryTree',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/product-categories/:id',
      handler: 'api::product-category.product-category.findOne',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/product-categories',
      handler: 'api::product-category.product-category.create',
      config: {
        auth: true,
      },
    },
    {
      method: 'PUT',
      path: '/product-categories/:id',
      handler: 'api::product-category.product-category.update',
      config: {
        auth: true,
      },
    },
    {
      method: 'DELETE',
      path: '/product-categories/:id',
      handler: 'api::product-category.product-category.delete',
      config: {
        auth: true,
      },
    },
  ],
};
