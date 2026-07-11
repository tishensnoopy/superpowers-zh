import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::product.product', {
  only: ['find', 'findOne'],
  config: {
    find: {
      auth: false,
    },
    findOne: {
      auth: false,
    },
  },
});
