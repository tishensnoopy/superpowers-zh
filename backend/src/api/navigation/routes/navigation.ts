export default {
  routes: [
    {
      method: 'GET',
      path: '/navigation',
      handler: 'api::navigation.navigation.find',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/navigation/tree',
      handler: 'api::navigation.navigation.getNavigationTree',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/navigation/:id',
      handler: 'api::navigation.navigation.findOne',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/navigation',
      handler: 'api::navigation.navigation.create',
      config: {
        auth: false,
      },
    },
    {
      method: 'PUT',
      path: '/navigation/:id',
      handler: 'api::navigation.navigation.update',
      config: {
        auth: false,
      },
    },
    {
      method: 'DELETE',
      path: '/navigation/:id',
      handler: 'api::navigation.navigation.delete',
      config: {
        auth: false,
      },
    },
  ],
};
