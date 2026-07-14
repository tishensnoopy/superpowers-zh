/**
 * Knowledge Base 路由权限设计：
 *
 * 公开访问（auth: false）：
 *   - GET /knowledge-bases — 列表查询（访客可浏览已就绪文档）
 *   - GET /knowledge-bases/:id — 单条查询
 *   - GET /knowledge-bases/search — 关键词搜索
 *
 * 需认证（auth: true）：
 *   - POST /knowledge-bases — 创建文档（仅管理员）
 *   - PUT /knowledge-bases/:id — 更新文档（仅管理员）
 *   - DELETE /knowledge-bases/:id — 删除文档（仅管理员）
 *   - POST /knowledge-bases/sync-all — 同步网站内容（仅管理员）
 *
 * 权限分层理由：访客只需浏览和搜索已就绪的知识库内容，
 * 文档的增删改和同步操作涉及向量化队列和 pgvector 写入，必须由管理员执行。
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/knowledge-bases',
      handler: 'api::knowledge-base.knowledge-base.find',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/knowledge-bases/:id',
      handler: 'api::knowledge-base.knowledge-base.findOne',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/knowledge-bases/search',
      handler: 'api::knowledge-base.knowledge-base.search',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/knowledge-bases',
      handler: 'api::knowledge-base.knowledge-base.create',
      config: {
        auth: { enabled: true },
      },
    },
    {
      method: 'PUT',
      path: '/knowledge-bases/:id',
      handler: 'api::knowledge-base.knowledge-base.update',
      config: {
        auth: { enabled: true },
      },
    },
    {
      method: 'DELETE',
      path: '/knowledge-bases/:id',
      handler: 'api::knowledge-base.knowledge-base.delete',
      config: {
        auth: { enabled: true },
      },
    },
    {
      method: 'POST',
      path: '/knowledge-bases/sync-all',
      handler: 'api::knowledge-base.knowledge-base.syncAll',
      config: {
        auth: { enabled: true },
      },
    },
  ],
};
