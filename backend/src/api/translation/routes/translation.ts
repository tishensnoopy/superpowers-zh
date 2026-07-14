export default {
  routes: [
    {
      method: 'POST',
      path: '/translation/assist',
      handler: 'translation.assist',
      config: {
        auth: true,  // 需要认证
        policies: [],
      },
    },
  ],
};
