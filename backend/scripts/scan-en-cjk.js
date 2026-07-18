#!/usr/bin/env node
/**
 * 扫描 en-US 内容中残留的汉字（中英夹杂检测）
 *
 * 背景：DashScope 翻译 en-US 版本时部分字段只翻了一半（如 "English启蒙 Module"）。
 * 本脚本扫描数据库中所有 en-US 相关文本，找出仍含 CJK 字符的字段。
 *
 * 扫描范围：
 *   1. 带 locale 字段的 content 表（pages/products/campuses/news... 等）的 en-US 行
 *   2. 这些行关联的 component 表行（components 无 locale，随宿主文档语言）
 *
 * 用法: node scripts/scan-en-cjk.js
 * 输出: 按表分组的 CJK 字段清单（表名/行id/字段路径/内容预览）
 */

const { Client } = require('pg');

const CJK = /[\u4e00-\u9fff]/;
const LATIN = /[a-zA-Z]{3,}/;

// 组件表通过 lnk 表挂到宿主；这里列出需要扫描的组件表
const COMPONENT_TABLES = [
  'components_section_heroes',
  'components_section_advantages',
  'components_common_advantages',
  'components_section_product_grids',
  'components_section_features',
  'components_common_features',
  'components_section_testimonials',
  'components_common_testimonials',
  'components_section_contact_forms',
  'components_common_form_fields',
  'components_section_faqs',
  'components_common_seos',
  'components_common_campus_sections',
  'components_common_course_modules',
  'components_section_rich_texts',
];

// 宿主表（有 locale 列）
const HOST_TABLES = [
  'pages', 'products', 'product_categories', 'campuses', 'teachers',
  'news_articles', 'news_categories', 'faqs', 'faq_items', 'navigations',
  'footers', 'site_settings', 'floating_buttons',
];

function walkStrings(obj, path, out) {
  if (obj == null) return;
  if (typeof obj === 'string') {
    if (CJK.test(obj)) out.push({ path, value: obj });
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => walkStrings(v, `${path}[${i}]`, out));
    return;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) walkStrings(v, path ? `${path}.${k}` : k, out);
  }
}

async function main() {
  const client = new Client({
    host: '127.0.0.1', port: 5432,
    user: process.env.DB_USER || 'strapi',
    password: process.env.DB_PASSWORD || 'changeme',
    database: process.env.DB_NAME || 'strapi',
  });
  await client.connect();

  const report = [];

  // 1. 宿主表 en-US 行：逐列扫描 text/varchar/jsonb 列
  for (const table of HOST_TABLES) {
    const colsRes = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = $1 AND data_type IN ('text','character varying','jsonb')`,
      [table]
    );
    if (!colsRes.rows.length) continue;
    const hasLocale = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name='locale'`, [table]
    );
    if (!hasLocale.rows.length) continue;

    const rows = await client.query(
      `SELECT id, ${colsRes.rows.map((c) => `"${c.column_name}"`).join(',')} FROM ${table} WHERE locale='en-US'`
    );
    for (const row of rows.rows) {
      for (const col of colsRes.rows) {
        const v = row[col.column_name];
        if (v == null) continue;
        const hits = [];
        walkStrings(v, col.column_name, hits);
        for (const h of hits) {
          report.push({ table, id: row.id, field: h.path, value: String(h.value).slice(0, 80) });
        }
      }
    }
  }

  // 2. 组件表：扫全表（组件无 locale，无法直接区分；列出让用户对照）
  const compHits = [];
  for (const table of COMPONENT_TABLES) {
    const exists = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name=$1`, [table]
    );
    if (!exists.rows.length) continue;
    const colsRes = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name=$1 AND data_type IN ('text','character varying','jsonb')`, [table]
    );
    if (!colsRes.rows.length) continue;
    const rows = await client.query(
      `SELECT id, ${colsRes.rows.map((c) => `"${c.column_name}"`).join(',')} FROM ${table}`
    );
    for (const row of rows.rows) {
      for (const col of colsRes.rows) {
        const v = row[col.column_name];
        if (v == null) continue;
        const hits = [];
        walkStrings(v, col.column_name, hits);
        for (const h of hits) {
          compHits.push({ table, id: row.id, field: h.path, value: String(h.value).slice(0, 80) });
        }
      }
    }
  }

  console.log('=== en-US 宿主表 CJK 残留（必为问题）===');
  if (!report.length) console.log('（无）');
  for (const r of report) console.log(`${r.table}#${r.id} ${r.field}: ${r.value}`);

  // 组件表无 locale：中英混杂 = 坏翻译；纯中文 = zh 版本（正常）
  const mixed = compHits.filter((r) => LATIN.test(r.value));
  console.log('\n=== 组件表「中英混杂」疑似坏翻译 ===');
  if (!mixed.length) console.log('（无）');
  for (const r of mixed) console.log(`${r.table}#${r.id} ${r.field}: ${r.value}`);

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
