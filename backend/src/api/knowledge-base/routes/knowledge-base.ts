export default {
  routes: [
    {
      method: 'GET',
      path: '/knowledge-bases',
      handler: 'api::knowledge-base.knowledge-base.find',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/knowledge-bases/:id',
      handler: 'api::knowledge-base.knowledge-base.findOne',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/knowledge-bases/search',
      handler: 'api::knowledge-base.knowledge-base.search',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/knowledge-bases',
      handler: 'api::knowledge-base.knowledge-base.create',
      config: {
        auth: { enabled: true },
      },
    },
    {
      method: 'PUT',
      path: '/knowledge-bases/:id',
      handler: 'api::knowledge-base.knowledge-base.update',
      config: {
        auth: { enabled: true },
      },
    },
    {
      method: 'DELETE',
      path: '/knowledge-bases/:id',
      handler: 'api::knowledge-base.knowledge-base.delete',
      config: {
        auth: { enabled: true },
      },
    },
    {
      method: 'POST',
      path: '/knowledge-bases/sync-all',
      handler: 'api::knowledge-base.knowledge-base.syncAll',
      config: {
        auth: { enabled: true },
      },
    },
  ],
};
