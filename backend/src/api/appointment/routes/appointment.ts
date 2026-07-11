import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::appointment.appointment', {
  config: {
    create: {
      auth: false,
      policies: [],
      middlewares: [],
    },
  },
  only: ['create', 'find', 'findOne'],
});
