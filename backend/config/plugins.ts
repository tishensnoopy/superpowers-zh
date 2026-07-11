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
    },
  },
});
