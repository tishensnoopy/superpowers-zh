/**
 * 一次性脚本：遍历所有 campus，调用高德 Geocoding API 重新计算坐标。
 *
 * 用途：现有校区坐标可能不准（手输错误/坐标系混用/旧数据），全部按当前
 *      address 字段重新 geocode 并写入数据库。设计参考 migrate-knowledge-base-locale.ts。
 *
 * 运行方式（在 backend 容器内）：
 *   docker exec -it yousen-backend npx tsx scripts/regenerate-campus-coords.ts
 *
 * 可选 DRY_RUN：
 *   docker exec -it yousen-backend npx tsx scripts/regenerate-campus-coords.ts --dry-run
 *   （只打印将要做的变更，不写库）
 *
 * 输出：每行一个校区记录的处理结果，最后总结成功/失败数。
 *
 * 注意：
 *   - 通过 `createStrapi().load()` 加载 strapi 实例，不依赖 global.__strapi。
 *   - 加载会触发 bootstrap（幂等的 initializeDefaults 不会破坏现有数据）。
 *   - 按 (documentId, locale) 维度处理，i18n 各 locale 独立 geocode。
 *   - geocodeAddress 失败时返回 null，脚本保留旧坐标并继续下一条。
 */

import { geocodeAddress } from '../src/services/amap-geocode-service';

const DRY_RUN = process.argv.includes('--dry-run');

interface CampusRecord {
  documentId: string;
  locale?: string;
  slug?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  formattedAddress?: string | null;
}

async function regenerateCampusCoords(strapi: any): Promise<{
  total: number;
  success: number;
  failed: number;
  skipped: number;
}> {
  console.log('=== 开始批量重新 geocoding 校区坐标 ===\n');
  if (DRY_RUN) console.log('*** DRY RUN — 不写入 ***\n');

  // 查询所有校区记录（含草稿、所有 locale）
  // Strapi v5 documents API：limit: -1 表示无限制
  const campuses: CampusRecord[] = await strapi
    .documents('api::campus.campus')
    .findMany({ limit: -1, locale: 'all' });

  console.log(`找到 ${campuses.length} 个校区记录\n`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const campus of campuses) {
    const label = `${campus.slug || campus.documentId}[${campus.locale || '??'}]`;
    const address = campus.address;

    if (!address) {
      console.log(`[${label}] 跳过：无 address 字段`);
      skipped++;
      continue;
    }

    console.log(`[${label}] 处理地址: "${address}"`);

    let result;
    try {
      result = await geocodeAddress(address);
    } catch (err) {
      // geocodeAddress 本身约定不抛异常，这里兜底防御
      console.warn(`  → geocodeAddress 抛异常:`, err instanceof Error ? err.message : err);
      result = null;
    }

    if (!result) {
      console.log(`  → 失败，保留旧坐标\n`);
      failed++;
      continue;
    }

    // 与现有坐标完全一致就不写
    const unchanged =
      campus.latitude === result.latitude &&
      campus.longitude === result.longitude &&
      campus.formattedAddress === result.formattedAddress;

    if (unchanged) {
      console.log(`  → 坐标已是 ${result.latitude}, ${result.longitude}，无需更新\n`);
      skipped++;
      continue;
    }

    if (!DRY_RUN) {
      await strapi.documents('api::campus.campus').update({
        documentId: campus.documentId,
        locale: campus.locale,
        data: {
          latitude: result.latitude,
          longitude: result.longitude,
          formattedAddress: result.formattedAddress,
        },
      });
    }

    console.log(
      `  → ${result.latitude}, ${result.longitude} (${result.formattedAddress})${DRY_RUN ? ' [dry-run 未写库]' : ''}\n`
    );
    success++;
  }

  console.log('=== 处理完成 ===');
  console.log(
    `成功: ${success}, 失败: ${failed}, 跳过: ${skipped}, 总计: ${campuses.length}`
  );

  return { total: campuses.length, success, failed, skipped };
}

async function main() {
  const { createStrapi } = await import('@strapi/strapi');
  const strapi = await createStrapi().load();
  try {
    await regenerateCampusCoords(strapi);
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

export { regenerateCampusCoords };
