export default {
  routes: [
    {
      method: 'GET',
      path: '/stats/appointments',
      handler: 'stats.appointments',
      config: {
        auth: { enabled: true },
        policies: ['is-client-admin'],
      },
    },
    {
      method: 'GET',
      path: '/stats/feedbacks',
      handler: 'stats.feedbacks',
      config: {
        auth: { enabled: true },
        policies: ['is-client-admin'],
      },
    },
    {
      method: 'GET',
      path: '/stats/overview',
      handler: 'stats.overview',
      config: {
        auth: { enabled: true },
        policies: ['is-client-admin'],
      },
    },
  ],
};
