export default ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  flags: {
    nps: env.bool('FLAG_NPS', false),
    promoteEE: env.bool('FLAG_PROMOTE_EE', false),
  },
  theme: {
    colors: {
      primary: {
        50: '#FFF3E5',
        100: '#FFE4C9',
        200: '#FFC99A',
        300: '#FFAD6B',
        400: '#FF8F3C',
        500: '#F5851F',
        600: '#E67515',
        700: '#C35D12',
        800: '#A04B15',
        900: '#843F14',
      },
      neutral: {
        50: '#FFFCF8',
        100: '#F8F5EF',
        200: '#F0EBE0',
        300: '#E4DBD0',
        400: '#D2C4B2',
        500: '#BAA693',
        600: '#A38B76',
        700: '#86715E',
        800: '#6D5C4D',
        900: '#5A4C40',
      },
    },
  },
  branding: {
    name: '企业官网母站管理后台',
    logo: null,
  },
});
