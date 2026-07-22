/**
 * 临时迁移服务（Phase 1 完成后删除）
 *
 * 将 campus↔teacher 旧 oneToMany 关系迁移到显式中间表 campus-teacher-link。
 *
 * 流程：
 *   1. 读取 teachers_campus_lnk 表获取现有关系数据
 *   2. 按 (teacher.documentId, campus.documentId) 去重 —— 中间表不本地化，
 *      同一教师的 zh-CN/en-US locale 行映射到同一条 junction 记录
 *   3. 幂等检查：campus_teacher_links 表是否已有数据
 *   4. 用 strapi.documents().create() 创建 junction 记录（关系能正确解析）
 *
 * 设计参考 backend/scripts/migrate-to-manytomany.ts 的 buildMigrationPlan 纯函数。
 */

interface RawLnkRow {
  teacher_doc_id: string;
  teacher_name: string;
  locale: string;
  campus_doc_id: string;
  campus_name: string;
}

interface MigrationLink {
  teacher_doc_id: string;
  teacher_name: string;
  campus_doc_id: string;
  campus_name: string;
  status: 'active';
  sortOrder: number;
}

export default {
  async runCampusTeacherMigration() {
    // 1. 读取 teachers_campus_lnk 现有关系数据
    const rawRows: RawLnkRow[] = await strapi.db.connection
      .select(
        't.document_id as teacher_doc_id',
        't.name as teacher_name',
        't.locale',
        'c.document_id as campus_doc_id',
        'c.name as campus_name'
      )
      .from('teachers_campus_lnk as l')
      .join('teachers as t', 'l.teacher_id', 't.id')
      .join('campuses as c', 'l.campus_id', 'c.id')
      .orderBy(['c.name', 't.name']);

    // 2. 按 (teacher_doc_id, campus_doc_id) 去重
    // 中间表不本地化，同一教师的 zh-CN/en-US locale 行映射到同一条 junction 记录
    const seen = new Set<string>();
    const links: MigrationLink[] = [];
    let sortOrder = 0;

    for (const row of rawRows) {
      const key = `${row.teacher_doc_id}::${row.campus_doc_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({
        teacher_doc_id: row.teacher_doc_id,
        teacher_name: row.teacher_name,
        campus_doc_id: row.campus_doc_id,
        campus_name: row.campus_name,
        status: 'active',
        sortOrder: sortOrder++,
      });
    }

    // 3. 幂等检查：campus_teacher_links 表是否已有数据
    const existingCount = await strapi.db.connection
      .count('* as n')
      .from('campus_teacher_links')
      .first();

    if (existingCount && Number(existingCount.n) > 0) {
      return {
        skipped: true,
        message: `campus_teacher_links 表已有 ${existingCount.n} 条记录，跳过迁移（幂等保护）`,
        existingCount: Number(existingCount.n),
        planCount: links.length,
      };
    }

    // 4. 用 document service 创建 junction 记录
    // document service 会正确处理 Strapi v5 的关系存储格式（lnk 表按行+locale）
    const created = [];
    const errors = [];

    for (const link of links) {
      try {
        const doc = await strapi.documents(
          'api::campus-teacher-link.campus-teacher-link'
        ).create({
          data: {
            campus: link.campus_doc_id,
            teacher: link.teacher_doc_id,
            status: link.status,
            sortOrder: link.sortOrder,
          },
        });
        created.push({
          documentId: doc.documentId,
          teacher: link.teacher_name,
          campus: link.campus_name,
          sortOrder: link.sortOrder,
        });
      } catch (err: any) {
        errors.push({
          teacher: link.teacher_name,
          campus: link.campus_name,
          error: err.message,
        });
      }
    }

    return {
      success: errors.length === 0,
      created: created.length,
      errors: errors.length,
      stats: {
        totalLnkRows: rawRows.length,
        uniquePairs: links.length,
        dedupedLocales: rawRows.length - links.length,
      },
      records: created,
      errorDetails: errors.length > 0 ? errors : undefined,
    };
  },
};
