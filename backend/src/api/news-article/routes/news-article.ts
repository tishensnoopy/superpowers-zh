export default {
  routes: [
    {
      method: 'GET',
      path: '/news-articles',
      handler: 'api::news-article.news-article.find',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/news-articles/slug/:slug',
      handler: 'api::news-article.news-article.findBySlug',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/news-articles/:id',
      handler: 'api::news-article.news-article.findOne',
      config: {
        auth: false,
      },
    },
  ],
};
