export default {
  routes: [
    {
      method: 'GET',
      path: '/product-specs',
      handler: 'api::product-spec.product-spec.find',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/product-specs/:id',
      handler: 'api::product-spec.product-spec.findOne',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/product-specs',
      handler: 'api::product-spec.product-spec.create',
      config: {
        auth: { enabled: true },
      },
    },
    {
      method: 'PUT',
      path: '/product-specs/:id',
      handler: 'api::product-spec.product-spec.update',
      config: {
        auth: { enabled: true },
      },
    },
    {
      method: 'DELETE',
      path: '/product-specs/:id',
      handler: 'api::product-spec.product-spec.delete',
      config: {
        auth: { enabled: true },
      },
    },
  ],
};
