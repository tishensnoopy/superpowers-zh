#!/usr/bin/env node
/**
 * 恢复 uploads 磁盘文件（一次性修复脚本）
 *
 * 背景：files 表有 114 条媒体记录，但 backend/public/uploads/ 目录为空
 * （本地与服务器均缺文件）。本脚本按 DB 记录从佑森源素材目录恢复：
 *   1. 按 files.name 在源目录递归定位原始图片
 *   2. 复制原图到 public/uploads/{hash}{ext}
 *   3. 按 formats JSON 中的尺寸用 sharp 重新生成各档缩略图
 *
 * 用法: node scripts/restore-uploads.js [--dry-run]
 * 验证: 脚本结尾自动校验每条 files.url 对应文件存在
 *
 * 环境变量（服务器执行时使用）：
 *   SRC_ROOT      源素材目录（默认 ../../佑森，相对本脚本）
 *   UPLOADS_DIR   目标目录（默认 ../public/uploads，相对本脚本）
 *   PG_CONTAINER  postgres 容器名（默认 yousen-postgres）
 *   DB_NAME       数据库名（默认 strapi；服务器为 yousen_db）
 *   DB_USER       数据库用户（默认 strapi；服务器为 yousen）
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('sharp');

const DRY_RUN = process.argv.includes('--dry-run');
const SRC_ROOT = process.env.SRC_ROOT
  ? path.resolve(process.env.SRC_ROOT)
  : path.resolve(__dirname, '../../佑森');
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(__dirname, '../public/uploads');
const PG_CONTAINER = process.env.PG_CONTAINER || 'yousen-postgres';
const DB_NAME = process.env.DB_NAME || 'strapi';
const DB_USER = process.env.DB_USER || 'strapi';

// === 1. 建立源文件索引：basename -> 绝对路径 ===
function indexSourceFiles(dir, index = new Map()) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      indexSourceFiles(full, index);
    } else if (/\.(jpe?g|png|webp|gif)$/i.test(entry.name)) {
      const key = entry.name.toLowerCase();
      if (index.has(key)) {
        // 同名冲突时保留第一个并记录，便于人工排查
        index.get(key).conflicts.push(full);
      } else {
        index.set(key, { path: full, conflicts: [] });
      }
    }
  }
  return index;
}

// === 2. 从 postgres 读取 files 记录 ===
function loadFileRecords() {
  const raw = execSync(
    `docker exec ${PG_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -t -A -c "SELECT json_build_object('id', id, 'name', name, 'hash', hash, 'ext', ext, 'mime', mime, 'formats', formats) FROM files ORDER BY id;"`,
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  return raw
    .split('\n')
    .filter((line) => line.trim().startsWith('{'))
    .map((line) => JSON.parse(line));
}

async function main() {
  console.log(`源目录: ${SRC_ROOT}`);
  console.log(`目标目录: ${UPLOADS_DIR}`);
  if (DRY_RUN) console.log('*** DRY RUN — 不写入任何文件 ***\n');

  const srcIndex = indexSourceFiles(SRC_ROOT);
  console.log(`源文件索引: ${srcIndex.size} 个图片\n`);

  if (!DRY_RUN) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const records = loadFileRecords();
  console.log(`DB files 记录: ${records.length} 条\n`);

  let restored = 0;
  let formatsGenerated = 0;
  const missing = [];
  const conflicted = [];

  for (const rec of records) {
    const srcEntry = srcIndex.get((rec.name || '').toLowerCase());
    if (!srcEntry) {
      missing.push(`${rec.id}: ${rec.name}`);
      continue;
    }
    if (srcEntry.conflicts.length > 0) {
      conflicted.push(`${rec.id}: ${rec.name} (+${srcEntry.conflicts.length} 个同名)`);
    }

    const origDest = path.join(UPLOADS_DIR, `${rec.hash}${rec.ext}`);
    if (!DRY_RUN) fs.copyFileSync(srcEntry.path, origDest);
    restored++;

    // 重新生成 formats 缩略图
    const formats = rec.formats;
    if (formats && typeof formats === 'object') {
      for (const [sizeName, fmt] of Object.entries(formats)) {
        if (!fmt || !fmt.url || !fmt.width) continue;
        const fmtFile = path.basename(fmt.url);
        const fmtDest = path.join(UPLOADS_DIR, fmtFile);
        if (DRY_RUN) continue;
        try {
          await sharp(srcEntry.path)
            .resize({ width: fmt.width, withoutEnlargement: true })
            .toFile(fmtDest);
          formatsGenerated++;
        } catch (err) {
          console.error(`  ✗ formats 生成失败 ${rec.name} [${sizeName}]: ${err.message}`);
        }
      }
    }
  }

  console.log(`\n=== 恢复结果 ===`);
  console.log(`原图恢复: ${restored}/${records.length}`);
  console.log(`缩略图生成: ${formatsGenerated}`);
  if (missing.length) {
    console.log(`\n源目录缺失 (${missing.length}):`);
    missing.forEach((m) => console.log(`  - ${m}`));
  }
  if (conflicted.length) {
    console.log(`\n同名冲突 (${conflicted.length}):`);
    conflicted.forEach((m) => console.log(`  - ${m}`));
  }

  // === 3. 校验：每条 files.url 对应文件必须存在 ===
  if (!DRY_RUN) {
    const recordsAfter = loadFileRecords();
    const missingFiles = [];
    for (const rec of recordsAfter) {
      const p = path.join(UPLOADS_DIR, `${rec.hash}${rec.ext}`);
      if (!fs.existsSync(p)) missingFiles.push(`${rec.hash}${rec.ext}`);
      if (rec.formats && typeof rec.formats === 'object') {
        for (const fmt of Object.values(rec.formats)) {
          if (fmt && fmt.url) {
            const fp = path.join(UPLOADS_DIR, path.basename(fmt.url));
            if (!fs.existsSync(fp)) missingFiles.push(path.basename(fmt.url));
          }
        }
      }
    }
    console.log(`\n=== 校验 ===`);
    if (missingFiles.length === 0) {
      console.log('✓ 所有 files.url 对应文件均已存在');
    } else {
      console.log(`✗ 仍缺失 ${missingFiles.length} 个文件:`);
      missingFiles.slice(0, 20).forEach((f) => console.log(`  - ${f}`));
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
