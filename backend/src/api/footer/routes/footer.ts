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
        auth: false,
      },
    },
    {
      method: 'PUT',
      path: '/footer/:id',
      handler: 'api::footer.footer.update',
      config: {
        auth: false,
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
