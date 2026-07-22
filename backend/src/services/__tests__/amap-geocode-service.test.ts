/**
 * amap-geocode-service 单元测试
 *
 * 测试策略：
 * - mock global fetch 模拟高德 API 响应
 * - 验证成功路径：返回坐标 + 标准化地址
 * - 验证降级路径：API 失败/空结果返回 null，不抛异常
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { geocodeAddress, type GeocodeResult } from '../amap-geocode-service';

describe('amap-geocode-service', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.AMAP_WEB_SERVICE_KEY;

  beforeEach(() => {
    // 默认为每个测试提供一个 key，测试 8 会在自身内 delete
    process.env.AMAP_WEB_SERVICE_KEY = 'test-key-123';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) {
      delete process.env.AMAP_WEB_SERVICE_KEY;
    } else {
      process.env.AMAP_WEB_SERVICE_KEY = originalKey;
    }
    vi.restoreAllMocks();
  });

  it('成功路径：地址匹配到坐标，返回 latitude/longitude/formattedAddress', async () => {
    // 高德 API 返回格式：location 是 "经度,纬度" 字符串
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: '1',
        count: '1',
        geocodes: [
          {
            formatted_address: '湖北省武汉市江岸区百步亭花园',
            location: '114.3185,30.6486',
          },
        ],
      }),
    } as any);

    const result = await geocodeAddress('武汉市江岸区百步亭');

    expect(result).not.toBeNull();
    expect(result!.latitude).toBe(30.6486);
    expect(result!.longitude).toBe(114.3185);
    expect(result!.formattedAddress).toBe('湖北省武汉市江岸区百步亭花园');
  });

  it('API 返回非 1 status（如 key 失效）→ 返回 null', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: '0',
        info: 'INVALID_USER_KEY',
        infocode: '10001',
      }),
    } as any);

    const result = await geocodeAddress('武汉市江岸区百步亭');
    expect(result).toBeNull();
  });

  it('API 返回空 geocodes 数组（地址太模糊）→ 返回 null', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: '1',
        count: '0',
        geocodes: [],
      }),
    } as any);

    const result = await geocodeAddress('xyz 不存在的地址');
    expect(result).toBeNull();
  });

  it('网络异常（fetch reject）→ 返回 null，不抛异常', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

    const result = await geocodeAddress('武汉市江岸区百步亭');
    expect(result).toBeNull();
  });

  it('HTTP 非 2xx → 返回 null', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as any);

    const result = await geocodeAddress('武汉市江岸区百步亭');
    expect(result).toBeNull();
  });

  it('location 字段格式异常（无逗号）→ 返回 null', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: '1',
        count: '1',
        geocodes: [{ formatted_address: '某地', location: 'invalid' }],
      }),
    } as any);

    const result = await geocodeAddress('某地');
    expect(result).toBeNull();
  });

  it('请求 URL 包含 key 和 address 参数', async () => {
    process.env.AMAP_WEB_SERVICE_KEY = 'test-key-123';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: '1', count: '0', geocodes: [] }),
    } as any);

    await geocodeAddress('测试地址');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://restapi.amap.com/v3/geocode/geo'),
      expect.objectContaining({ method: 'GET' })
    );
    const calledUrl = (global.fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain('key=test-key-123');
    expect(calledUrl).toContain('address=');
  });

  it('未配置 AMAP_WEB_SERVICE_KEY 环境变量 → 返回 null 并 warn', async () => {
    delete process.env.AMAP_WEB_SERVICE_KEY;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await geocodeAddress('测试地址');

    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('AMAP_WEB_SERVICE_KEY'));
    warn.mockRestore();
  });
});
