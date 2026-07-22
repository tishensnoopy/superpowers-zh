/**
 * 临时迁移控制器（Phase 1 完成后删除）
 */
export default {
  async runCampusTeacherMigration(ctx: any) {
    const result = await strapi
      .service('api::migration-run.migration-run')
      .runCampusTeacherMigration();
    ctx.body = result;
  },
};
