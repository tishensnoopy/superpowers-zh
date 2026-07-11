export default ({ env }) => ({
  'users-permissions': {
    enabled: true,
    config: {
      jwt: {
        secret: env('JWT_SECRET'),
      },
    },
  },
  i18n: {
    enabled: true,
    config: {
      defaultLocale: 'zh-CN',
      locales: ['zh-CN', 'en-US'],
      displayDefaultLocale: true,
    },
  },
  upload: {
    enabled: true,
    config: {
      provider: 'local',
      providerOptions: {
        basePath: '/uploads',
        sizeLimit: 25 * 1024 * 1024,
      },
      image: {
        resize: {
          enabled: true,
          sizes: {
            thumbnail: {
              width: 200,
              height: 200,
              crop: 'center',
            },
            small: {
              width: 500,
              height: 500,
              crop: 'center',
            },
            medium: {
              width: 1024,
              height: 1024,
              crop: 'center',
            },
            large: {
              width: 1920,
              height: 1080,
              crop: 'center',
            },
          },
        },
      },
    },
  },
});
