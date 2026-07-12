import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::teacher.teacher', {
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
