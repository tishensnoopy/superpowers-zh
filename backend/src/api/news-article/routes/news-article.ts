// 新闻路由：find / findOne / findBySlug 公开只读，create / update / delete 需鉴权（client-admin 可管理）
// 必须注册全量 action 路由（且 controller 用 createCoreController 具备全部 action），
// 否则 users-permissions 插件 syncPermissions 会把对应权限行当作无效 action 在 bootstrap 时删除
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
    {
      method: 'POST',
      path: '/news-articles',
      handler: 'api::news-article.news-article.create',
    },
    {
      method: 'PUT',
      path: '/news-articles/:id',
      handler: 'api::news-article.news-article.update',
    },
    {
      method: 'DELETE',
      path: '/news-articles/:id',
      handler: 'api::news-article.news-article.delete',
    },
  ],
};
