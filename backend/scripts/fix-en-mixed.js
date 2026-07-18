#!/usr/bin/env node
/**
 * 修复 en-US 内容中英夹杂（一次性修复脚本）
 *
 * 背景：DashScope 翻译 en-US 版本时留下少量未翻片段（"启蒙""托管"等），
 * 以及 products.spec_values 的 jsonb 键名未翻译。此处全部用确定性英文替换，
 * 避免再次调用 LLM 产生新的半翻问题。
 *
 * 用法: node scripts/fix-en-mixed.js [--dry-run]
 * 验证: 脚本结尾自动复查目标行，残留 CJK 则报错退出
 */

const { Client } = require('pg');

const DRY_RUN = process.argv.includes('--dry-run');
const CJK = /[\u4e00-\u9fff]/;

// [table, id, column, find, replace]
const TEXT_FIXES = [
  // products 描述：English language启蒙 → English language foundation
  ['products', 13, 'description', 'English language启蒙', 'English language foundation'],
  ['products', 22, 'description', 'English language启蒙', 'English language foundation'],
  // FAQ 答案
  ['faq_items', 46, 'answer', 'English启蒙 (alphabet and oral English)', 'English foundation (alphabet and oral English)'],
  // 教师教学特色
  ['teachers', 29, 'teaching_features', 'English启蒙 teaching, interactive classroom', 'Early English foundation teaching with interactive classroom'],
  ['teachers', 45, 'teaching_features', 'English启蒙 teaching, interactive classroom', 'Early English foundation teaching with interactive classroom'],
  // 课程分类名
  ['product_categories', 11, 'name', 'After-school托管', 'After-school Care'],
  // 课程模块标题
  ['components_course_modules', 71, 'title', 'English启蒙 Module', 'English Foundation Module'],
  ['components_course_modules', 89, 'title', 'English启蒙 Module', 'English Foundation Module'],
  // 新闻正文（消除与括注重复）
  ['news_articles', 72, 'content', 'English启蒙 (English early learning)', 'early English learning'],
  ['news_articles', 91, 'content', 'English启蒙 (English early learning)', 'early English learning'],
  ['news_articles', 78, 'content', 'Pinyin启蒙 (Pinyin Introduction)', 'Pinyin Introduction'],
  ['news_articles', 94, 'content', 'Pinyin启蒙 (Pinyin Introduction)', 'Pinyin Introduction'],
  // about 页办学理念富文本
  ['components_section_rich_texts', 84, 'content', 'English启蒙 (English introduction)', 'English introduction'],
  ['components_section_rich_texts', 86, 'content', 'English启蒙 (English introduction)', 'English introduction'],
];

// spec_values jsonb 键名映射
const SPEC_KEY_MAP = {
  '班额': 'Class Size',
  '服务时间': 'Service Hours',
  '适合年龄': 'Age Range',
  '课时': 'Class Hours',
  '课程周期': 'Course Duration',
};

async function main() {
  if (DRY_RUN) console.log('*** DRY RUN — 不写入 ***\n');
  const client = new Client({
    host: '127.0.0.1', port: 5432,
    user: process.env.DB_USER || 'strapi',
    password: process.env.DB_PASSWORD || 'changeme',
    database: process.env.DB_NAME || 'strapi',
  });
  await client.connect();

  let fixed = 0;
  const problems = [];

  // 1. 文本替换
  for (const [table, id, col, find, replace] of TEXT_FIXES) {
    const { rows } = await client.query(`SELECT "${col}" AS v FROM ${table} WHERE id=$1`, [id]);
    if (!rows.length) { problems.push(`${table}#${id}: 行不存在`); continue; }
    const cur = rows[0].v;
    if (cur == null) { problems.push(`${table}#${id}.${col}: NULL`); continue; }
    if (!cur.includes(find)) {
      if (!CJK.test(cur)) { console.log(`  = ${table}#${id}.${col} 已干净，跳过`); continue; }
      problems.push(`${table}#${id}.${col}: 找不到目标片段「${find}」当前值=${String(cur).slice(0, 60)}`);
      continue;
    }
    const next = cur.split(find).join(replace);
    if (!DRY_RUN) await client.query(`UPDATE ${table} SET "${col}"=$1 WHERE id=$2`, [next, id]);
    console.log(`  ✓ ${table}#${id}.${col}: 「${find}」→「${replace}」`);
    fixed++;
  }

  // 2. products.spec_values 键名翻译
  const { rows: prodRows } = await client.query(
    `SELECT id, spec_values FROM products WHERE locale='en-US' AND spec_values IS NOT NULL`
  );
  for (const row of prodRows) {
    const sv = row.spec_values;
    if (!sv || typeof sv !== 'object') continue;
    const hasCjkKey = Object.keys(sv).some((k) => CJK.test(k));
    if (!hasCjkKey) continue;
    const next = {};
    for (const [k, v] of Object.entries(sv)) next[SPEC_KEY_MAP[k] || k] = v;
    if (!DRY_RUN) await client.query(`UPDATE products SET spec_values=$1 WHERE id=$2`, [JSON.stringify(next), row.id]);
    console.log(`  ✓ products#${row.id}.spec_values 键名 → 英文 (${Object.keys(next).join(', ')})`);
    fixed++;
  }

  // 3. 复查：所有目标行不得残留 CJK
  console.log('\n=== 复查 ===');
  let remaining = 0;
  for (const [table, id, col] of TEXT_FIXES) {
    const { rows } = await client.query(`SELECT "${col}" AS v FROM ${table} WHERE id=$1`, [id]);
    if (rows.length && rows[0].v != null && CJK.test(rows[0].v)) {
      console.log(`  ✗ ${table}#${id}.${col} 仍含 CJK`);
      remaining++;
    }
  }
  const { rows: svCheck } = await client.query(
    `SELECT id, spec_values FROM products WHERE locale='en-US' AND spec_values IS NOT NULL`
  );
  for (const row of svCheck) {
    if (row.spec_values && Object.keys(row.spec_values).some((k) => CJK.test(k))) {
      console.log(`  ✗ products#${row.id}.spec_values 仍含 CJK 键`);
      remaining++;
    }
  }

  for (const p of problems) console.log(`  ! ${p}`);
  console.log(`\n修复 ${fixed} 处；残留 ${remaining} 处；异常 ${problems.length} 处`);
  await client.end();
  if (remaining > 0 || problems.length > 0) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
