#!/usr/bin/env node
/**
 * 填充校区地图嵌入代码（可重复执行，--force 强制覆盖）
 *
 * 背景：campuses.map_embed 原本使用高德搜索页 iframe
 * （https://uri.amap.com/search），实际显示的是搜索框而非定位地图。
 * 现改为高德坐标标记模式（https://uri.amap.com/marker?position=...），
 * 可直接显示校区位置标记，无需用户再搜索。
 *
 * 用法: node scripts/fix-campus-map-embed.js [--dry-run] [--force]
 * 环境变量: DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME（默认值同本地 docker）
 */

const { Client } = require('pg');

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

// 高德地图坐标（GCJ-02 火星坐标系）
// 可从 https://lbs.amap.com/tools/picker 拾取校准
const CAMPUS_COORDS = {
  'yousen-baibuting':   { lng: 114.3185, lat: 30.6486, name: '百步亭校区' },
  'yousen-sanyanglu':   { lng: 114.2936, lat: 30.6036, name: '三阳路校区' },
  'yousen-dongwuyuan':  { lng: 114.2310, lat: 30.5470, name: '动物园校区' },
  'yousen-zhongjiacun': { lng: 114.2594, lat: 30.5535, name: '钟家村校区' },
  'yousen-sixin':       { lng: 114.2280, lat: 30.5120, name: '四新校区' },
  'yousen-zhuankou':    { lng: 114.1645, lat: 30.5080, name: '沌口校区' },
};

function buildEmbed({ lng, lat, name }) {
  const src =
    'https://uri.amap.com/marker?position=' +
    lng + ',' + lat +
    '&name=' + encodeURIComponent(name) +
    '&src=yousen&callnative=0';
  return `<iframe src="${src}" width="100%" height="320" style="border:0" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" title="campus map"></iframe>`;
}

async function main() {
  if (DRY_RUN) console.log('*** DRY RUN — 不写入 ***\n');
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'strapi',
    password: process.env.DB_PASSWORD || 'changeme',
    database: process.env.DB_NAME || 'strapi',
  });
  await client.connect();

  // 按 document_id + locale 查所有校区行
  const { rows } = await client.query(
    `SELECT id, document_id, locale, slug, map_embed FROM campuses ORDER BY document_id, locale`
  );

  let updated = 0;
  let skipped = 0;
  for (const r of rows) {
    const coord = CAMPUS_COORDS[r.slug];
    if (!coord) {
      console.log(`  ! campuses#${r.id} slug=${r.slug} 无坐标配置，跳过`);
      skipped++;
      continue;
    }
    if (r.map_embed && r.map_embed.includes('uri.amap.com/marker') && !FORCE) {
      console.log(`  - campuses#${r.id} (${r.locale}) 已是 marker 模式，跳过（--force 强制更新）`);
      skipped++;
      continue;
    }
    const embed = buildEmbed(coord);
    if (!DRY_RUN) {
      await client.query('UPDATE campuses SET map_embed=$1 WHERE id=$2', [embed, r.id]);
    }
    console.log(`  ✓ campuses#${r.id} (${r.locale}) slug=${r.slug} ← marker(${coord.lng},${coord.lat})`);
    updated++;
  }

  // 复查
  const { rows: check } = await client.query(
    `SELECT COUNT(*)::int AS n FROM campuses WHERE map_embed IS NULL OR map_embed NOT LIKE '%uri.amap.com/marker%'`
  );
  console.log(`\n更新 ${updated} 行；跳过 ${skipped} 行；仍非 marker 模式 ${DRY_RUN ? '(dry-run 未查)' : check[0].n + ' 行'}`);
  await client.end();
  if (!DRY_RUN && check[0].n > 0) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
