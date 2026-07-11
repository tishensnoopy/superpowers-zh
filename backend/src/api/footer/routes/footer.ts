export default {
  routes: [
    {
      method: 'GET',
      path: '/footer',
      handler: 'api::footer.footer.find',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/footer',
      handler: 'api::footer.footer.create',
      config: {
        auth: { enabled: true },
      },
    },
    {
      method: 'PUT',
      path: '/footer/:id',
      handler: 'api::footer.footer.update',
      config: {
        auth: { enabled: true },
      },
    },
    {
      method: 'DELETE',
      path: '/footer/:id',
      handler: 'api::footer.footer.delete',
      config: {
        auth: { enabled: true },
      },
    },
  ],
};
