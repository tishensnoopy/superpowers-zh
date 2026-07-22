/**
 * Host 端 dry-run runner：绕过 Strapi 加载，用 pg 直连本地 DB 验证迁移逻辑。
 *
 * 用途：当容器内 `createStrapi().load()` 因 lodash/fp 缺失无法运行时，
 *      在 host 上用本脚本直接连 localhost:5432 读取 teachers_campus_lnk，
 *      复用已测试的 buildMigrationPlan 计算迁移计划。
 *
 * 运行方式（host，backend 目录下）：
 *   npx tsx scripts/dry-run-migration.ts
 *
 * 注意：仅 dry-run，不写库。
 */

import { Pool } from 'pg';
import { buildMigrationPlan, printPlan } from './migrate-to-manytomany';

async function main() {
  const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    database: 'strapi',
    user: 'strapi',
    password: 'changeme',
  });

  try {
    const res = await pool.query(
      `SELECT t.document_id AS teacher_doc_id,
              t.name AS teacher_name,
              t.locale,
              c.document_id AS campus_doc_id,
              c.name AS campus_name
       FROM teachers_campus_lnk AS l
       JOIN teachers AS t ON l.teacher_id = t.id
       JOIN campuses AS c ON l.campus_id = c.id
       ORDER BY c.name, t.name`
    );

    const plan = buildMigrationPlan(res.rows as any);
    printPlan(plan);
    console.log('\n*** DRY RUN (host pg 直连) —— 未写库 ***');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('dry-run 异常:', err);
  process.exit(1);
});
