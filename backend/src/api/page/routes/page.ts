export default {
  routes: [
    {
      method: 'GET',
      path: '/pages',
      handler: 'api::page.page.find',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/pages/:id',
      handler: 'api::page.page.findOne',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/pages/slug/:slug',
      handler: 'api::page.page.findBySlug',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/pages/homepage',
      handler: 'api::page.page.getHomepage',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/pages',
      handler: 'api::page.page.create',
      config: {
        auth: true,
      },
    },
    {
      method: 'PUT',
      path: '/pages/:id',
      handler: 'api::page.page.update',
      config: {
        auth: true,
      },
    },
    {
      method: 'DELETE',
      path: '/pages/:id',
      handler: 'api::page.page.delete',
      config: {
        auth: true,
      },
    },
  ],
};
