#!/usr/bin/env node
/**
 * 填充校区经纬度坐标（可重复执行）
 *
 * 背景：campuses.map_embed iframe 方案不可行（uri.amap.com 会 302 跳转到
 * 带搜索框的完整页面）。改为存储经纬度，前端用高德 JS API 渲染干净地图。
 *
 * 用法: node scripts/set-campus-coords.js [--dry-run]
 * 环境变量: DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME（默认值同本地 docker）
 */

const { Client } = require('pg');

const DRY_RUN = process.argv.includes('--dry-run');

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

  const { rows } = await client.query(
    `SELECT id, document_id, locale, slug, latitude, longitude FROM campuses ORDER BY document_id, locale`
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
    if (r.latitude === coord.lat && r.longitude === coord.lng) {
      console.log(`  - campuses#${r.id} (${r.locale}) 坐标已正确，跳过`);
      skipped++;
      continue;
    }
    if (!DRY_RUN) {
      await client.query(
        'UPDATE campuses SET latitude=$1, longitude=$2 WHERE id=$3',
        [coord.lat, coord.lng, r.id]
      );
    }
    console.log(`  ✓ campuses#${r.id} (${r.locale}) slug=${r.slug} ← (${coord.lng},${coord.lat})`);
    updated++;
  }

  const { rows: check } = await client.query(
    `SELECT COUNT(*)::int AS n FROM campuses WHERE latitude IS NULL OR longitude IS NULL`
  );
  console.log(`\n更新 ${updated} 行；跳过 ${skipped} 行；仍缺坐标 ${DRY_RUN ? '(dry-run 未查)' : check[0].n + ' 行'}`);
  await client.end();
  if (!DRY_RUN && check[0].n > 0) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
