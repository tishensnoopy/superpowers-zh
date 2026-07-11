export default {
  routes: [
    {
      method: 'GET',
      path: '/faq-items',
      handler: 'api::faq-item.faq-item.find',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/faq-items/:id',
      handler: 'api::faq-item.faq-item.findOne',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/faq-items/category/:category',
      handler: 'api::faq-item.faq-item.findByCategory',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/faq-items/search',
      handler: 'api::faq-item.faq-item.search',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/faq-items',
      handler: 'api::faq-item.faq-item.create',
      config: {
        auth: { enabled: true },
      },
    },
    {
      method: 'PUT',
      path: '/faq-items/:id',
      handler: 'api::faq-item.faq-item.update',
      config: {
        auth: { enabled: true },
      },
    },
    {
      method: 'DELETE',
      path: '/faq-items/:id',
      handler: 'api::faq-item.faq-item.delete',
      config: {
        auth: { enabled: true },
      },
    },
    {
      method: 'POST',
      path: '/faq-items/:id/feedback',
      handler: 'api::faq-item.faq-item.submitFeedback',
      config: {
        auth: false,
      },
    },
  ],
};
