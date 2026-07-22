/**
 * Phase 1 迁移脚本：将 campus↔teacher 的 oneToMany 关系迁移到显式中间表。
 *
 * 背景：当前 teacher.campus 是 manyToOne（单校区），campus.teachers 是 oneToMany。
 *      重构后改为通过显式 collection type `campus-teacher-link` 承载多对多关系。
 *      关系存储在 Strapi 隐式 join 表 `teachers_campus_lnk` 里。
 *
 * 本脚本做的事：
 *   1. 读取 teachers_campus_lnk 现有关系数据
 *   2. 按 (teacher.documentId, campus.documentId) 去重 —— 中间表不本地化，
 *      同一教师的 zh-CN/en-US locale 行映射到同一条 junction 记录
 *   3. --dry-run：打印将要创建的 junction 记录，不写库
 *   4. --execute：实际创建 junction 记录（要求 campus-teacher-link content type 已存在）
 *
 * 注意：
 *   - campus↔product 和 teacher↔product 关系当前不存在（greenfield），
 *     无数据可迁移，脚本对此只做"0 条"报告。
 *   - 幂等：--execute 前检查目标是否已有数据，避免重复创建。
 *
 * 运行方式（backend 容器内）：
 *   docker exec -it yousen-backend npx tsx scripts/migrate-to-manytomany.ts --dry-run
 *   docker exec -it yousen-backend npx tsx scripts/migrate-to-manytomany.ts --execute
 *
 * 设计参考 regenerate-campus-coords.ts。
 */

export interface CampusTeacherLink {
  teacherDocumentId: string;
  teacherName: string;
  campusDocumentId: string;
  campusName: string;
  status: 'active';
  sortOrder: number;
}

export interface MigrationPlan {
  campusTeacherLinks: CampusTeacherLink[];
  stats: {
    totalLnkRows: number;
    uniquePairs: number;
    dedupedLocales: number;
  };
}

interface RawLnkRow {
  teacher_doc_id: string;
  teacher_name: string;
  locale: string;
  campus_doc_id: string;
  campus_name: string;
}

/**
 * 从原始 link 表行（含 per-locale 重复）计算去重后的迁移计划。
 * 纯函数，便于单元测试。
 */
export function buildMigrationPlan(rawRows: RawLnkRow[]): MigrationPlan {
  const seen = new Set<string>();
  const links: CampusTeacherLink[] = [];
  let sortOrder = 0;

  // 按 campus 名 + teacher 名排序，保证输出稳定可读
  const sorted = [...rawRows].sort((a, b) => {
    const cmp = (a.campus_name || '').localeCompare(b.campus_name || '');
    if (cmp !== 0) return cmp;
    return (a.teacher_name || '').localeCompare(b.teacher_name || '');
  });

  for (const row of sorted) {
    const key = `${row.teacher_doc_id}::${row.campus_doc_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({
      teacherDocumentId: row.teacher_doc_id,
      teacherName: row.teacher_name,
      campusDocumentId: row.campus_doc_id,
      campusName: row.campus_name,
      status: 'active',
      sortOrder: sortOrder++,
    });
  }

  return {
    campusTeacherLinks: links,
    stats: {
      totalLnkRows: rawRows.length,
      uniquePairs: links.length,
      dedupedLocales: rawRows.length - links.length,
    },
  };
}

/**
 * 从 Strapi DB 读取现有的 teachers_campus_lnk 关系数据。
 */
async function fetchRawLnkRows(strapi: any): Promise<RawLnkRow[]> {
  return strapi.db.connection
    .select(
      't.document_id as teacher_doc_id',
      't.name as teacher_name',
      't.locale',
      'c.document_id as campus_doc_id',
      'c.name as campus_name',
    )
    .from('teachers_campus_lnk as l')
    .join('teachers as t', 'l.teacher_id', 't.id')
    .join('campuses as c', 'l.campus_id', 'c.id')
    .orderBy(['c.name', 't.name']);
}

export function printPlan(plan: MigrationPlan): void {
  console.log('=== Phase 1 迁移计划（campus↔teacher oneToMany → 显式中间表）===\n');
  console.log(
    `源数据：teachers_campus_lnk 表共 ${plan.stats.totalLnkRows} 条 link 行`
  );
  console.log(
    `去重后：${plan.stats.uniquePairs} 条唯一 (teacher, campus) 对` +
      `（去重 ${plan.stats.dedupedLocales} 条 per-locale 重复）\n`
  );

  console.log('将创建的 campus_teacher_links 记录：');
  console.log(
    '  # | sortOrder | teacher (docId)              | campus (docId)                | status'
  );
  console.log(
    '  --|-----------|-------------------------------|-------------------------------|--------'
  );
  for (const link of plan.campusTeacherLinks) {
    console.log(
      `  ${String(link.sortOrder + 1).padStart(2)} | ${String(link.sortOrder).padStart(9)} | ` +
        `${link.teacherName.padEnd(12)} (${link.teacherDocumentId.slice(0, 12)}) | ` +
        `${link.campusName.padEnd(14)} (${link.campusDocumentId.slice(0, 12)}) | ${link.status}`
    );
  }

  console.log('\n=== 其他关系对（无现存数据，greenfield）===');
  console.log('  campus↔product (课程): 0 条（关系尚不存在，无需迁移）');
  console.log('  teacher↔product (课程): 0 条（关系尚不存在，无需迁移）');
}

async function executeMigration(
  strapi: any,
  plan: MigrationPlan
): Promise<{ created: number; skipped: number }> {
  // 幂等检查：campus_teacher_links 表是否已有数据
  const existingCount = await strapi.db.connection
    .count('* as n')
    .from('campus_teacher_links')
    .first();

  if (existingCount && Number(existingCount.n) > 0) {
    console.log(
      `\n⚠ campus_teacher_links 表已有 ${existingCount.n} 条记录，跳过迁移（幂等保护）。`
    );
    return { created: 0, skipped: plan.campusTeacherLinks.length };
  }

  let created = 0;
  for (const link of plan.campusTeacherLinks) {
    await strapi.db.connection.insert({
      campus_document_id: link.campusDocumentId,
      teacher_document_id: link.teacherDocumentId,
      status: link.status,
      sort_order: link.sortOrder,
    }).into('campus_teacher_links');
    created++;
  }
  return { created, skipped: 0 };
}

async function main() {
  const DRY_RUN = process.argv.includes('--dry-run');
  const EXECUTE = process.argv.includes('--execute');

  if (!DRY_RUN && !EXECUTE) {
    console.error('用法: migrate-to-manytomany.ts --dry-run | --execute');
    process.exit(1);
  }

  const { createStrapi } = await import('@strapi/strapi');
  const strapi = await createStrapi().load();
  try {
    const rawRows = await fetchRawLnkRows(strapi);
    const plan = buildMigrationPlan(rawRows);
    printPlan(plan);

    if (DRY_RUN) {
      console.log('\n*** DRY RUN —— 未写库 ***');
    } else if (EXECUTE) {
      console.log('\n--- 开始执行迁移 ---');
      const result = await executeMigration(strapi, plan);
      console.log(`创建 ${result.created} 条，跳过 ${result.skipped} 条`);
    }
  } finally {
    await strapi.destroy();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('脚本异常:', err);
    process.exit(1);
  });
}
