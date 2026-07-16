import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::appointment.appointment', {
  config: {
    create: {
      auth: false,
      policies: [],
      middlewares: [],
    },
    find: {
      // Strapi v5 default requires auth; policy enforces client-admin role.
      // Note: auth must be false or an object — `true` is rejected by Strapi v5 route validator.
      policies: ['is-client-admin'],
      middlewares: [],
    },
    findOne: {
      policies: ['is-client-admin'],
      middlewares: [],
    },
  },
  only: ['create', 'find', 'findOne'],
});
