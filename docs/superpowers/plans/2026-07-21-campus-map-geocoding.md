# 校区地图坐标优化：地址自动 Geocoding 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 Strapi v5 后端为 `campus` content type 添加 lifecycle hook，保存时自动调用高德 Web Service Geocoding API 把 `address` 转换为 GCJ-02 坐标，填充 `latitude` / `longitude` / `formattedAddress` 字段，admin 不再需要手输经纬度。

**架构：** Strapi register 阶段订阅 `campus` 的 `beforeCreate` / `beforeUpdate` lifecycle，hook 调用 `services/amap-geocode-service.ts` 封装的高德 API，根据 `address` 字段是否变化决定是否重新 geocoding。错误隔离：API 失败不阻断保存，记录 warning 保留旧坐标。

**技术栈：** Strapi v5.50.2 / TypeScript / vitest / 高德 Web Service Geocoding API v3 / Node.js fetch

**源码位置：** 客户服务器 `121.196.210.191` 的 `/opt/customer-site/backend/`（容器内挂载到 `/opt/app/`）。所有 ssh 操作使用 `sshpass -p 'Ysxkt12345' ssh root@121.196.210.191`。所有 docker exec 使用 `docker exec yousen-backend`。

**前置依赖：** 已批准的设计文档 `docs/superpowers/specs/2026-07-21-campus-map-geocoding-design.md`。高德 Web Service key 已提供：`1faffb1bce264c7661f0a3100320dc31`。

---

## 文件结构

| 操作 | 文件 | 职责 |
|------|------|------|
| 创建 | `/opt/customer-site/backend/src/services/amap-geocode-service.ts` | 高德 Web Service Geocoding API 封装（地址 → 坐标） |
| 创建 | `/opt/customer-site/backend/src/services/__tests__/amap-geocode-service.test.ts` | geocode service 单元测试 |
| 修改 | `/opt/customer-site/backend/src/api/campus/content-types/campus/schema.json` | 新增 `formattedAddress` 字段（i18n） |
| 修改 | `/opt/customer-site/backend/src/index.ts` | register 阶段订阅 campus 的 `beforeCreate` / `beforeUpdate` lifecycle |
| 修改 | `/opt/customer-site/backend/src/__tests__/register-lifecycles.test.ts` | 测试 campus lifecycle 注册正确 |
| 修改 | `/opt/customer-site/docker-compose.yml` | backend 服务环境变量加 `AMAP_WEB_SERVICE_KEY` |
| 修改 | `/opt/customer-site/.env` | 添加 `AMAP_WEB_SERVICE_KEY=1faffb1bce264c7661f0a3100320dc31` |
| 创建 | `/opt/customer-site/backend/scripts/regenerate-campus-coords.ts` | 一次性批量重新 geocoding 脚本 |

---

## 任务 1：创建高德 Geocoding 服务（含单元测试）

**文件：**
- 创建：`/opt/customer-site/backend/src/services/amap-geocode-service.ts`
- 测试：`/opt/customer-site/backend/src/services/__tests__/amap-geocode-service.test.ts`

**职责：** 封装高德 Web Service Geocoding API 调用，输入地址返回标准化地址 + GCJ-02 坐标。处理错误（网络失败、API 错误、空结果）。

- [ ] **步骤 1.1：编写失败的测试**

通过 ssh 在客户服务器创建测试文件 `src/services/__tests__/amap-geocode-service.test.ts`：

```typescript
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

  afterEach(() => {
    global.fetch = originalFetch;
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
```

- [ ] **步骤 1.2：运行测试验证失败**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'docker exec yousen-backend sh -c "cd /opt/app && npx vitest run src/services/__tests__/amap-geocode-service.test.ts"'
```

预期：FAIL，报错 `Cannot find module '../amap-geocode-service'`

- [ ] **步骤 1.3：编写实现代码**

通过 ssh 在客户服务器创建 `src/services/amap-geocode-service.ts`：

```typescript
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
```

- [ ] **步骤 1.4：运行测试验证通过**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'docker exec yousen-backend sh -c "cd /opt/app && npx vitest run src/services/__tests__/amap-geocode-service.test.ts"'
```

预期：PASS，8 个测试全部通过

- [ ] **步骤 1.5：Commit**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'cd /opt/customer-site/backend && git add src/services/amap-geocode-service.ts src/services/__tests__/amap-geocode-service.test.ts && git commit -m "feat(backend): add amap geocode service for address-to-coordinate conversion"'
```

---

## 任务 2：campus schema 加 formattedAddress 字段

**文件：**
- 修改：`/opt/customer-site/backend/src/api/campus/content-types/campus/schema.json`

**职责：** 新增 `formattedAddress` 字段（i18n），用于存储高德返回的标准化地址，admin 可对照原输入地址发现歧义。

- [ ] **步骤 2.1：编辑 schema.json，在 `mapEmbed` 字段后新增 `formattedAddress`**

通过 ssh 在客户服务器执行（用 python 精确插入 JSON 节点，避免 sed 破坏格式）：

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 << 'EOF'
python3 - << 'PYEOF'
import json
path = '/opt/customer-site/backend/src/api/campus/content-types/campus/schema.json'
with open(path) as f:
    schema = json.load(f)

# 在 mapEmbed 后面插入 formattedAddress
attrs = schema['attributes']
if 'formattedAddress' in attrs:
    print('formattedAddress 已存在，跳过')
else:
    # 找到 mapEmbed 的位置，在其后插入
    new_attrs = {}
    for k, v in attrs.items():
        new_attrs[k] = v
        if k == 'mapEmbed':
            new_attrs['formattedAddress'] = {
                'type': 'string',
                'maxLength': 500,
                'description': '高德 Geocoding API 返回的标准化地址（自动填充，对照 address 用于发现歧义）',
                'pluginOptions': {
                    'i18n': {
                        'localized': True
                    }
                }
            }
    schema['attributes'] = new_attrs
    with open(path, 'w') as f:
        json.dump(schema, f, indent=2, ensure_ascii=False)
    print('formattedAddress 字段已添加')
PYEOF
EOF
```

- [ ] **步骤 2.2：验证 schema 合法**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'docker exec yousen-backend node -e "JSON.parse(require(\"fs\").readFileSync(\"/opt/app/src/api/campus/content-types/campus/schema.json\", \"utf8\")); console.log(\"schema JSON 合法\")"'
```

预期：输出 `schema JSON 合法`

- [ ] **步骤 2.3：验证 formattedAddress 字段存在**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'docker exec yousen-backend grep -A 8 "formattedAddress" /opt/app/src/api/campus/content-types/campus/schema.json'
```

预期：看到 formattedAddress 字段定义，type=string，i18n localized=true

- [ ] **步骤 2.4：重启 backend 让 schema 生效**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'docker restart yousen-backend && sleep 5 && docker logs yousen-backend --tail 20 2>&1 | grep -E "Server listening|lifecycles|error" | tail -5'
```

预期：看到 `Server listening at: http://localhost:1337`，无 schema 错误

- [ ] **步骤 2.5：验证数据库表已有 formattedAddress 列**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'docker exec yousen-postgres psql -U yousen -d yousen_db -c "\d campuses" | grep -i formatted'
```

预期：看到 `formatted_address | character varying(500)` 列（Strapi 自动 camelCase → snake_case）

- [ ] **步骤 2.6：Commit**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'cd /opt/customer-site/backend && git add src/api/campus/content-types/campus/schema.json && git commit -m "feat(campus): add formattedAddress i18n field for standardized address"'
```

---

## 任务 3：在 src/index.ts 注册 campus 的 beforeCreate/beforeUpdate lifecycle hook

**文件：**
- 修改：`/opt/customer-site/backend/src/index.ts`
- 测试：`/opt/customer-site/backend/src/__tests__/register-lifecycles.test.ts`

**职责：** 在 register 阶段订阅 `api::campus.campus` 的 `beforeCreate` / `beforeUpdate` 事件，调用 `geocodeAddress` 把 `address` 转换为坐标填充 `latitude/longitude/formattedAddress`。地址未变时不覆盖现有坐标。

- [ ] **步骤 3.1：编写失败的测试 — 追加到 register-lifecycles.test.ts**

通过 ssh 在客户服务器追加测试用例（保留现有测试不破坏）：

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 << 'EOF'
cat >> /opt/customer-site/backend/src/__tests__/register-lifecycles.test.ts << 'TESTEOF'

// ============ campus geocoding lifecycle 测试 ============

describe('register() campus geocoding lifecycle', () => {
  it('订阅 campus 的 beforeCreate/beforeUpdate 钩子', async () => {
    const subscribe = vi.fn();
    const strapi: any = { db: { lifecycles: { subscribe } } };

    await index.register({ strapi });

    // 找到 campus 的订阅
    const campusSub = subscribe.mock.calls.find(
      (c) => c[0].models[0] === 'api::campus.campus'
    );
    expect(campusSub).toBeDefined();
    expect(typeof campusSub![0].beforeCreate).toBe('function');
    expect(typeof campusSub![0].beforeUpdate).toBe('function');
  });

  it('beforeCreate: address 非空时调用 geocodeAddress 并填充 lat/lng/formattedAddress', async () => {
    process.env.AMAP_WEB_SERVICE_KEY = 'test-key';
    const subscribe = vi.fn();
    const strapi: any = { db: { lifecycles: { subscribe } } };

    // mock geocodeAddress 返回固定坐标
    vi.doMock('../services/amap-geocode-service', () => ({
      geocodeAddress: vi.fn().mockResolvedValue({
        latitude: 30.6486,
        longitude: 114.3185,
        formattedAddress: '湖北省武汉市江岸区百步亭花园',
      }),
    }));

    await index.register({ strapi });

    const campusSub = subscribe.mock.calls.find(
      (c) => c[0].models[0] === 'api::campus.campus'
    );

    const eventData = { params: { data: { address: '武汉市江岸区百步亭' } } };
    await campusSub![0].beforeCreate(eventData);

    expect(eventData.params.data.latitude).toBe(30.6486);
    expect(eventData.params.data.longitude).toBe(114.3185);
    expect(eventData.params.data.formattedAddress).toBe('湖北省武汉市江岸区百步亭花园');

    vi.doUnmock('../services/amap-geocode-service');
    delete process.env.AMAP_WEB_SERVICE_KEY;
  });

  it('beforeUpdate: address 未变时不覆盖现有坐标', async () => {
    const subscribe = vi.fn();
    const existingAddress = '武汉市江岸区百步亭';
    const findOne = vi.fn().mockResolvedValue({ address: existingAddress });
    const strapi: any = {
      db: {
        lifecycles: { subscribe },
        query: vi.fn(() => ({ findOne })),
      },
    };

    await index.register({ strapi });

    const campusSub = subscribe.mock.calls.find(
      (c) => c[0].models[0] === 'api::campus.campus'
    );

    const eventData = {
      params: { data: { address: existingAddress }, where: { id: 1 } },
    };
    await campusSub![0].beforeUpdate(eventData);

    // findOne 被调用查现有 address
    expect(findOne).toHaveBeenCalled();
    // 因为 address 没变，不应该调 geocodeAddress（这里用 latitude 没被覆盖来间接验证）
    expect(eventData.params.data.latitude).toBeUndefined();
  });

  it('beforeUpdate: address 变化时调用 geocodeAddress 覆盖坐标', async () => {
    process.env.AMAP_WEB_SERVICE_KEY = 'test-key';
    const subscribe = vi.fn();
    const findOne = vi.fn().mockResolvedValue({ address: '旧地址' });
    const strapi: any = {
      db: {
        lifecycles: { subscribe },
        query: vi.fn(() => ({ findOne })),
      },
    };

    vi.doMock('../services/amap-geocode-service', () => ({
      geocodeAddress: vi.fn().mockResolvedValue({
        latitude: 30.65,
        longitude: 114.32,
        formattedAddress: '新地址标准化',
      }),
    }));

    await index.register({ strapi });

    const campusSub = subscribe.mock.calls.find(
      (c) => c[0].models[0] === 'api::campus.campus'
    );

    const eventData = {
      params: { data: { address: '新地址' }, where: { id: 1 } },
    };
    await campusSub![0].beforeUpdate(eventData);

    expect(eventData.params.data.latitude).toBe(30.65);
    expect(eventData.params.data.longitude).toBe(114.32);
    expect(eventData.params.data.formattedAddress).toBe('新地址标准化');

    vi.doUnmock('../services/amap-geocode-service');
    delete process.env.AMAP_WEB_SERVICE_KEY;
  });

  it('geocodeAddress 失败时不阻断保存（返回 null 时数据原样保留）', async () => {
    process.env.AMAP_WEB_SERVICE_KEY = 'test-key';
    const subscribe = vi.fn();
    const findOne = vi.fn().mockResolvedValue({ address: '旧地址' });
    const strapi: any = {
      db: {
        lifecycles: { subscribe },
        query: vi.fn(() => ({ findOne })),
      },
    };

    vi.doMock('../services/amap-geocode-service', () => ({
      geocodeAddress: vi.fn().mockResolvedValue(null),  // 模拟失败
    }));

    await index.register({ strapi });

    const campusSub = subscribe.mock.calls.find(
      (c) => c[0].models[0] === 'api::campus.campus'
    );

    const eventData = {
      params: { data: { address: '新地址', latitude: 99, longitude: 99 }, where: { id: 1 } },
    };

    // 不应该抛异常
    await expect(campusSub![0].beforeUpdate(eventData)).resolves.toBeUndefined();
    // 旧坐标应被保留（99 不被覆盖）
    expect(eventData.params.data.latitude).toBe(99);

    vi.doUnmock('../services/amap-geocode-service');
    delete process.env.AMAP_WEB_SERVICE_KEY;
  });
});
TESTEOF
EOF
```

- [ ] **步骤 3.2：运行测试验证失败**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'docker exec yousen-backend sh -c "cd /opt/app && npx vitest run src/__tests__/register-lifecycles.test.ts"'
```

预期：FAIL，新加的 5 个 campus geocoding 测试失败（campus 的 beforeCreate/beforeUpdate 未注册）

- [ ] **步骤 3.3：修改 src/index.ts 添加 campus lifecycle 订阅**

通过 ssh 在客户服务器的 `src/index.ts` 的 register 函数末尾（在 `console.log('[Register] Lifecycle hooks registered');` 之前）插入 campus geocoding 订阅：

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 << 'EOF'
python3 - << 'PYEOF'
path = '/opt/customer-site/backend/src/index.ts'
with open(path) as f:
    content = f.read()

# 检查是否已加过
if 'campus-geocode' in content:
    print('campus geocoding 已注册，跳过')
else:
    # 在 '[Register] Lifecycle hooks registered' 之前插入
    insert_block = """
    // ------------------------------------------------------------
    // campus geocoding lifecycle：保存时自动调高德 API 把 address 转换为 GCJ-02 坐标
    // 错误隔离：geocoding 失败不阻断保存，保留旧坐标
    // ------------------------------------------------------------
    try {
      const { geocodeAddress } = await import('./services/amap-geocode-service');
      strapi.db.lifecycles.subscribe({
        models: ['api::campus.campus'],
        beforeCreate: async (event: any) => {
          const data = event?.params?.data;
          if (!data?.address) return;
          try {
            const result = await geocodeAddress(data.address);
            if (result) {
              data.latitude = result.latitude;
              data.longitude = result.longitude;
              data.formattedAddress = result.formattedAddress;
              console.log(`[campus-geocode] beforeCreate: "${data.address}" → ${result.latitude},${result.longitude}`);
            } else {
              console.warn(`[campus-geocode] beforeCreate: geocoding 失败，保留原数据，地址: "${data.address}"`);
            }
          } catch (err) {
            console.warn('[campus-geocode] beforeCreate 异常:', err);
          }
        },
        beforeUpdate: async (event: any) => {
          const data = event?.params?.data;
          if (!data?.address) return;
          try {
            // 比对数据库现有 address：没变就不覆盖坐标
            const existing = await strapi.db.query('api::campus.campus').findOne({
              where: { id: event.params.where.id },
              select: ['address'],
            });
            if (existing?.address === data.address) {
              return; // 地址没变，不动坐标
            }
            const result = await geocodeAddress(data.address);
            if (result) {
              data.latitude = result.latitude;
              data.longitude = result.longitude;
              data.formattedAddress = result.formattedAddress;
              console.log(`[campus-geocode] beforeUpdate: "${data.address}" → ${result.latitude},${result.longitude}`);
            } else {
              console.warn(`[campus-geocode] beforeUpdate: geocoding 失败，保留旧坐标，地址: "${data.address}"`);
            }
          } catch (err) {
            console.warn('[campus-geocode] beforeUpdate 异常:', err);
          }
        },
      });
      console.log('[Register] campus geocoding lifecycle subscribed');
    } catch (err) {
      console.warn('[Register] Failed to subscribe campus geocoding lifecycle:', err);
    }

"""
    marker = "    console.log('[Register] Lifecycle hooks registered');"
    if marker in content:
        content = content.replace(marker, insert_block + marker)
        with open(path, 'w') as f:
            f.write(content)
        print('campus geocoding lifecycle 已插入')
    else:
        print('ERROR: 找不到 marker，未修改')
PYEOF
EOF
```

- [ ] **步骤 3.4：运行测试验证通过**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'docker exec yousen-backend sh -c "cd /opt/app && npx vitest run src/__tests__/register-lifecycles.test.ts"'
```

预期：PASS，所有测试通过（包括原有 4 个 + 新加 5 个 = 9 个）

- [ ] **步骤 3.5：Commit**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'cd /opt/customer-site/backend && git add src/index.ts src/__tests__/register-lifecycles.test.ts && git commit -m "feat(campus): register beforeCreate/beforeUpdate geocoding lifecycle"'
```

---

## 任务 4：配置 AMAP_WEB_SERVICE_KEY 环境变量

**文件：**
- 修改：`/opt/customer-site/docker-compose.yml`
- 修改：`/opt/customer-site/.env`

**职责：** 把高德 Web Service key 通过环境变量注入 backend 容器，service 通过 `process.env.AMAP_WEB_SERVICE_KEY` 读取。

- [ ] **步骤 4.1：在 docker-compose.yml 的 backend 服务环境变量加 AMAP_WEB_SERVICE_KEY**

通过 ssh 在客户服务器编辑 docker-compose.yml，在 backend 服务的 environment 节加一行：

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 << 'EOF'
python3 - << 'PYEOF'
path = '/opt/customer-site/docker-compose.yml'
with open(path) as f:
    content = f.read()

if 'AMAP_WEB_SERVICE_KEY' in content:
    print('AMAP_WEB_SERVICE_KEY 已在 docker-compose.yml 中')
else:
    # 在 backend 服务的 environment 块内插入
    # 找到 backend: 下面的 environment: 然后加一行
    marker = '      DATABASE_SSL: ${DATABASE_SSL:-false}'
    if marker in content:
        content = content.replace(
            marker,
            marker + '\n      # 高德 Web Service API key（服务端用，不暴露到前端）\n      AMAP_WEB_SERVICE_KEY: ${AMAP_WEB_SERVICE_KEY:-}'
        )
        with open(path, 'w') as f:
            f.write(content)
        print('AMAP_WEB_SERVICE_KEY 已添加到 docker-compose.yml')
    else:
        print('ERROR: 找不到 marker')
PYEOF
EOF
```

- [ ] **步骤 4.2：在 .env 加 AMAP_WEB_SERVICE_KEY 值**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'grep -q "AMAP_WEB_SERVICE_KEY" /opt/customer-site/.env && echo "已存在" || (echo "" >> /opt/customer-site/.env && echo "# 高德 Web Service API key（服务端用）" >> /opt/customer-site/.env && echo "AMAP_WEB_SERVICE_KEY=1faffb1bce264c7661f0a3100320dc31" >> /opt/customer-site/.env && echo "已添加到 .env")'
```

- [ ] **步骤 4.3：重启 backend 让环境变量生效**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'cd /opt/customer-site && docker compose up -d backend && sleep 8 && docker exec yousen-backend env | grep AMAP'
```

预期：看到 `AMAP_WEB_SERVICE_KEY=1faffb1bce264c7661f0a3100320dc31`

- [ ] **步骤 4.4：验证 backend 健康**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'docker ps --filter name=yousen-backend --format "{{.Names}}: {{.Status}}" && curl -sk -o /dev/null -w "backend HTTP %{http_code}\n" "https://yoosen.cn/admin/init"'
```

预期：`yousen-backend: Up X seconds (healthy)` + `backend HTTP 200`

- [ ] **步骤 4.5：Commit**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'cd /opt/customer-site && git add docker-compose.yml .env && git commit -m "chore(config): inject AMAP_WEB_SERVICE_KEY env into backend container"'
```

注意：检查 .env 是否在 .gitignore 里，如果是则只 commit docker-compose.yml，不要 commit .env（含敏感 key）：

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'cd /opt/customer-site && git diff --cached --name-only'
```

如果 .env 在 staging，从 staging 移除：
```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'cd /opt/customer-site && git reset HEAD .env && git add docker-compose.yml && git commit -m "chore(config): inject AMAP_WEB_SERVICE_KEY env into backend container"'
```

---

## 任务 5：一次性批量重新 geocoding 脚本

**文件：**
- 创建：`/opt/customer-site/backend/scripts/regenerate-campus-coords.ts`

**职责：** 一次性遍历所有 campus 记录，对每个校区调用 `geocodeAddress` 重新计算坐标并写入数据库。用于清理现有可能不准的坐标。

- [ ] **步骤 5.1：创建脚本**

通过 ssh 在客户服务器创建 `scripts/regenerate-campus-coords.ts`：

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 << 'EOF'
mkdir -p /opt/customer-site/backend/scripts
cat > /opt/customer-site/backend/scripts/regenerate-campus-coords.ts << 'SCRIPTEOF'
/**
 * 一次性脚本：遍历所有 campus，调用高德 Geocoding API 重新计算坐标。
 *
 * 用途：现有 6 个校区的坐标可能不准（手输错误/坐标系混用），全部按当前 address 重新算。
 *
 * 运行方式（在 backend 容器内）：
 *   docker exec -it yousen-backend npx tsx scripts/regenerate-campus-coords.ts
 *
 * 输出：每行一个校区的处理结果，最后总结成功/失败数。
 */
import { geocodeAddress } from '../src/services/amap-geocode-service';

async function main() {
  // 通过 strapi instance 查询 + 更新
  // 这里的 strapi 通过 global.__strapi 拿到（在 strapi 启动后注入）
  const strapi = (global as any).__strapi;
  if (!strapi) {
    console.error('ERROR: strapi instance 未找到，请在 strapi 容器内运行');
    process.exit(1);
  }

  console.log('=== 开始批量重新 geocoding 校区坐标 ===\n');

  // 查询所有校区（含草稿）
  const campuses = await strapi.documents('api::campus.campus').findMany({
    limit: -1,
    locale: 'all',
  });

  console.log(`找到 ${campuses.length} 个校区记录\n`);

  let success = 0;
  let failed = 0;

  for (const campus of campuses) {
    const address = campus.address;
    if (!address) {
      console.log(`[${campus.slug || campus.documentId}] 跳过：无 address 字段`);
      failed++;
      continue;
    }

    console.log(`[${campus.slug || campus.documentId}] 处理地址: "${address}"`);
    const result = await geocodeAddress(address);

    if (result) {
      await strapi.documents('api::campus.campus').update({
        documentId: campus.documentId,
        locale: campus.locale,
        data: {
          latitude: result.latitude,
          longitude: result.longitude,
          formattedAddress: result.formattedAddress,
        },
      });
      console.log(`  → ${result.latitude}, ${result.longitude} (${result.formattedAddress})\n`);
      success++;
    } else {
      console.log(`  → 失败，保留旧坐标\n`);
      failed++;
    }
  }

  console.log('=== 处理完成 ===');
  console.log(`成功: ${success}, 失败: ${failed}, 总计: ${campuses.length}`);
}

main().catch((err) => {
  console.error('脚本异常:', err);
  process.exit(1);
});
SCRIPTEOF
EOF
```

- [ ] **步骤 5.2：验证脚本语法**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'docker exec yousen-backend sh -c "cd /opt/app && npx tsc --noEmit scripts/regenerate-campus-coords.ts 2>&1 | head -20"'
```

预期：无错误输出（或仅有"找不到 strapi 实例"这种运行时错误，编译应通过）

- [ ] **步骤 5.3：Commit**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'cd /opt/customer-site/backend && git add scripts/regenerate-campus-coords.ts && git commit -m "chore(scripts): add one-shot campus coords regeneration script"'
```

---

## 任务 6：部署 + 6 个校区数据重新 geocoding + 验证

**职责：** 把所有改动部署到客户服务器，运行批量脚本重新算 6 个校区坐标，验证前后端功能正常。

- [ ] **步骤 6.1：触发 Strapi 重建（让 TypeScript 改动编译生效）**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'cd /opt/customer-site && docker compose build backend && docker compose up -d backend && sleep 10 && docker logs yousen-backend --tail 30 2>&1 | grep -E "Server listening|campus geocoding|ERROR|error" | tail -10'
```

预期：看到 `Server listening at: http://localhost:1337` + `[Register] campus geocoding lifecycle subscribed`

- [ ] **步骤 6.2：手动触发一次 geocoding 验证（改一个校区的 address 测试）**

先看一个校区当前坐标，然后改 address 触发 hook，验证坐标变化：

```bash
# 记录改之前的坐标
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'docker exec yousen-postgres psql -U yousen -d yousen_db -c "SELECT slug, address, latitude, longitude, formatted_address FROM campuses WHERE slug = '\''yousen-baibuting'\'' AND locale = '\''zh-CN'\'';"'
```

然后用 admin API 改 address（需要 admin token，这里用数据库直接改触发 hook 比较复杂，所以用 admin UI 测试）：

通过 Strapi admin UI 测试：
1. 浏览器打开 `https://yoosen.cn/admin/`
2. 进入 Content Manager → 校区 → 百步亭
3. 修改 address 字段（例如末尾加个空格再删掉，或微调地址文案）
4. 保存
5. 然后看数据库：

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'docker exec yousen-postgres psql -U yousen -d yousen_db -c "SELECT slug, address, latitude, longitude, formatted_address FROM campuses WHERE slug = '\''yousen-baibuting'\'' AND locale = '\''zh-CN'\'';"'
```

预期：latitude/longitude 变化（与改之前不同），formatted_address 有值

- [ ] **步骤 6.3：运行批量重新 geocoding 脚本（对 6 个校区全部重算）**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'docker exec yousen-backend sh -c "cd /opt/app && npx tsx scripts/regenerate-campus-coords.ts"'
```

预期输出：
```
=== 开始批量重新 geocoding 校区坐标 ===
找到 12 个校区记录（6 个校区 × 2 个 locale）
[yousen-baibuting] 处理地址: "武汉市江岸区百步亭"
  → 30.6486, 114.3185 (湖北省武汉市江岸区百步亭花园)
...
=== 处理完成 ===
成功: 12, 失败: 0, 总计: 12
```

- [ ] **步骤 6.4：验证所有校区坐标已更新**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'docker exec yousen-postgres psql -U yousen -d yousen_db -c "SELECT slug, locale, address, latitude, longitude, formatted_address FROM campuses ORDER BY slug, locale;"'
```

预期：所有 6 个校区 × 2 个 locale = 12 条记录都有 formatted_address 值，latitude/longitude 不为 NULL

- [ ] **步骤 6.5：前端验证 — 打开 6 个校区详情页**

```bash
for slug in yousen-baibuting yousen-sanyanglu yousen-dongwuyuan; do
  echo "=== $slug ==="
  sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
    "curl -skL -o /dev/null -w 'HTTP %{http_code}, Size: %{size_download}\n' 'https://yoosen.cn/zh-CN/campuses/$slug'"
done
```

预期：全部 HTTP 200，Size > 50KB

然后用浏览器人工验证 6 个校区详情页的 iframe 地图显示位置准确（这一步需要你手动在浏览器打开每个校区详情页看地图）。

- [ ] **步骤 6.6：检查 backend logs 没有异常**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'docker logs yousen-backend --tail 100 2>&1 | grep -E "campus-geocode|amap-geocode" | tail -20'
```

预期：看到 `[campus-geocode] beforeCreate/beforeUpdate: "地址" → lat,lng` 日志，无 ERROR / 异常 stack trace

- [ ] **步骤 6.7：Final Commit**

所有改动已经在前面的步骤 commit 过了，这一步只是确认 git 状态干净：

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'cd /opt/customer-site && git status && git log --oneline -5'
```

预期：working tree clean，最近 5 个 commit 包含本次的 4 个 commit（geocode service / schema / lifecycle / config）+ 1 个 script

---

## 自检

### 1. 规格覆盖度

| 规格要求 | 对应任务 |
|---------|---------|
| 高德 Web Service Geocoding API 封装（服务端调用，不暴露 key） | 任务 1 |
| campus schema 加 formattedAddress 字段（i18n） | 任务 2 |
| lifecycle hook（beforeCreate/beforeUpdate）+ 地址未变不覆盖 | 任务 3 |
| AMAP_WEB_SERVICE_KEY 环境变量配置 | 任务 4 |
| 一次性批量重新 geocoding 6 个校区 | 任务 5 + 任务 6.3 |
| 错误隔离（API 失败不阻断保存） | 任务 1（service 层）+ 任务 3（hook 层） |
| 测试覆盖（成功路径、降级路径、保留路径） | 任务 1.1 + 任务 3.1 |
| 前端 iframe 不动（latitude/longitude 字段名不变） | 任务 2 保留字段名 + 任务 6.5 验证 |
| 配额风险（5000 次/天） | 任务 5 + 任务 6.3 实际只用 ~12 次，远低于配额 |

覆盖完整。

### 2. 占位符扫描

- 无 TODO / 待定 / "后续实现"
- 每个步骤都有具体代码或具体命令
- 测试代码完整可运行

### 3. 类型一致性

- `GeocodeResult` 接口在任务 1 定义，任务 3 使用（`{ latitude, longitude, formattedAddress }`）✓
- `geocodeAddress(address: string): Promise<GeocodeResult | null>` 签名一致 ✓
- `formattedAddress` 字段名在 schema.json、service、hook、脚本中都一致 ✓
- `AMAP_WEB_SERVICE_KEY` 环境变量名在 service、docker-compose、.env 中一致 ✓
- lifecycle 钩子名 `beforeCreate` / `beforeUpdate` 在测试和实现中一致 ✓

无类型不一致。

### 4. 关键风险点提示

- **Strapi v5 lifecycle API**：用 `strapi.db.lifecycles.subscribe({ models, beforeCreate, beforeUpdate })`，与现有 `register-lifecycles.test.ts` 的 `afterCreate/afterUpdate/afterDelete` 模式一致（同一 API 不同事件）
- **i18n 校区**：每个校区有 zh-CN + en-US 两条记录，schema 字段加 `pluginOptions.i18n.localized: true`。en-US 的 address 是英文，高德 geocoding 对英文地址也能识别但效果可能稍差，可在批量脚本里跳过 en-US（让 zh-CN 算完坐标后 en-US 自动复用——但实际是两条独立记录）。建议批量脚本对 en-US 跳过（在脚本里加判断 `if (campus.locale !== 'zh-CN') continue`），只算 zh-CN 一条，然后通过 Strapi API 把 zh-CN 的坐标同步到 en-US。这个细节在任务 6.3 看到实际结果再决定是否需要补丁。
- **数据库列名**：Strapi 自动 camelCase → snake_case，`formattedAddress` 列名是 `formatted_address`，在 SQL 查询时用 snake_case

---

## 执行交接

计划已完成并保存到 `/home/tishensnoopy/project/superpowers-zh/docs/superpowers/plans/2026-07-21-campus-map-geocoding.md`。两种执行方式：

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

选哪种方式？
