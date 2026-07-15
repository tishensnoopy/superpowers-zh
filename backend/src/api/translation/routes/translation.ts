export default {
  routes: [
    {
      method: 'POST',
      path: '/translation/assist',
      handler: 'translation.assist',
      config: {
        // Strapi v5 default requires auth; controller also enforces admin-only via isAdmin().
        // Note: auth must be false or an object — `true` is rejected by Strapi v5 route validator.
        policies: [],
      },
    },
  ],
};
