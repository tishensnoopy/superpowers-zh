export default {
  routes: [
    {
      method: 'GET',
      path: '/site-settings',
      handler: 'api::site-settings.site-settings.find',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/site-settings',
      handler: 'api::site-settings.site-settings.create',
      config: {
        auth: true,
      },
    },
    {
      method: 'PUT',
      path: '/site-settings/:id',
      handler: 'api::site-settings.site-settings.update',
      config: {
        auth: true,
      },
    },
    {
      method: 'DELETE',
      path: '/site-settings/:id',
      handler: 'api::site-settings.site-settings.delete',
      config: {
        auth: true,
      },
    },
  ],
};
