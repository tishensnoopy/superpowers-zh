import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::teacher-product-link.teacher-product-link', {
  only: ['find', 'findOne', 'create', 'update', 'delete'],
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});
