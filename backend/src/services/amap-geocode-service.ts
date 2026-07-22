/**
 * 高德 Web Service Geocoding API 封装
 *
 * 用途：把中文地址转换为 GCJ-02 坐标（高德原生坐标系）。
 *
 * API 文档：https://lbs.amap.com/api/webservice/guide/api/georegeo
 *
 * 关键约束：
 *   - key 只在服务端使用，不暴露到前端
 *   - 失败时返回 null，不抛异常（lifecycle 调用方依赖此约定做错误隔离）
 *   - 高德返回的 location 格式是 "经度,纬度"（lng,lat 顺序），与 latitude/longitude 字段对应需拆分
 */

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

const AMAP_GEOCODE_ENDPOINT = 'https://restapi.amap.com/v3/geocode/geo';
const REQUEST_TIMEOUT_MS = 5000;

/**
 * 把地址字符串转换为 GCJ-02 坐标。
 *
 * @param address 中文地址，如 "武汉市江岸区百步亭"
 * @returns GeocodeResult 或 null（任何失败都返回 null，不抛异常）
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const key = process.env.AMAP_WEB_SERVICE_KEY;
  if (!key) {
    console.warn('[amap-geocode] AMAP_WEB_SERVICE_KEY 未配置，跳过 geocoding');
    return null;
  }

  if (!address || !address.trim()) {
    return null;
  }

  const url = new URL(AMAP_GEOCODE_ENDPOINT);
  url.searchParams.set('key', key);
  url.searchParams.set('address', address);
  // 输出格式 JSON，强制返回标准化地址
  url.searchParams.set('output', 'JSON');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[amap-geocode] HTTP ${response.status} 调用失败，地址: "${address}"`);
      return null;
    }

    const data = (await response.json()) as {
      status?: string;
      count?: string;
      geocodes?: Array<{
        formatted_address?: string;
        location?: string;
      }>;
      info?: string;
      infocode?: string;
    };

    // 高德 status "1" = 成功，"0" = 失败
    if (data.status !== '1') {
      console.warn(
        `[amap-geocode] API 返回失败 status=${data.status} info=${data.info} infocode=${data.infocode}，地址: "${address}"`
      );
      return null;
    }

    if (!data.geocodes || data.geocodes.length === 0) {
      console.warn(`[amap-geocode] 未匹配到坐标，地址: "${address}"`);
      return null;
    }

    const first = data.geocodes[0];
    const location = first.location || '';
    // location 格式 "经度,纬度"，如 "114.3185,30.6486"
    const parts = location.split(',');
    if (parts.length !== 2) {
      console.warn(`[amap-geocode] location 格式异常: "${location}"`);
      return null;
    }

    const longitude = parseFloat(parts[0]);
    const latitude = parseFloat(parts[1]);
    if (!isFinite(latitude) || !isFinite(longitude)) {
      console.warn(`[amap-geocode] 坐标解析失败: "${location}"`);
      return null;
    }

    return {
      latitude,
      longitude,
      formattedAddress: first.formatted_address || address,
    };
  } catch (err) {
    console.warn(`[amap-geocode] 调用异常，地址: "${address}"`, err);
    return null;
  }
}
