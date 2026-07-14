export default [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:', 'http:'],
          'img-src': ["'self'", 'data:', 'blob:', 'https://market-assets.strapi.io', 'http:', 'https:'],
          'media-src': ["'self'", 'data:', 'blob:'],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      enabled: true,
      headers: '*',
      origin: ['http://localhost:3000', 'http://localhost:1337', 'http://127.0.0.1:3000'],
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::bodyParser',
    config: {
      formLimit: '256mb',
      jsonLimit: '256mb',
      textLimit: '256mb',
    },
  },
  {
    name: 'strapi::rateLimit',
    config: {
      enabled: true,
      settings: {
        interval: { min: 1 },
        max: 10000,
      },
    },
  },
  'strapi::compression',
  'strapi::favicon',
  'strapi::public',
];
