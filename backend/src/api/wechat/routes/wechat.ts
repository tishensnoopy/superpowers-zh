/**
 * WeChat public routes — all auth: false because:
 * - /webhook is called by WeChat servers (validated via signature, not Strapi auth)
 * - /jssdk is called by the browser to get share signature config
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/wechat/webhook',
      handler: 'wechat.verify',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/wechat/webhook',
      handler: 'wechat.handleMessage',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/wechat/jssdk',
      handler: 'wechat.getJssdkConfig',
      config: { auth: false },
    },
  ],
};
