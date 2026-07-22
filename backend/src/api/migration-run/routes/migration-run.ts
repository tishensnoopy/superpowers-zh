/**
 * 临时迁移路由（Phase 1 完成后删除此整个 api 目录）
 *
 * 用途：将 campus↔teacher 的旧 oneToMany 关系数据迁移到显式中间表
 * campus-teacher-link。用 strapi.documents().create() 写关系，
 * 确保 Strapi v5 关系存储格式正确（lnk 表按行+locale 自动处理）。
 *
 * 安全性：auth:false 仅限本地迁移使用，迁移完成后立即删除。
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/migration-run/campus-teacher-links',
      handler: 'migration-run.runCampusTeacherMigration',
      config: {
        auth: false,
      },
    },
  ],
};
