import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::campus-product-link.campus-product-link', {
  only: ['find', 'findOne', 'create', 'update', 'delete'],
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});
