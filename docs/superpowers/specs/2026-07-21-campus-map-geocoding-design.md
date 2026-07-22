# 校区地图坐标优化：从手输经纬度到地址自动 Geocoding

日期：2026-07-21
状态：✅ 用户已决策（2026-07-21），等待规格审查后进入实施

## 用户决策记录（D1~D5）

- **D1：核心痛点** —— 坐标系不一致 + 后台输经纬度数字"很蠢"。原话："地图根本就没有显示到精确的地址，然后后台管理需要输入经纬度，这样是很蠢，直接输入准确地址不行吗？"
- **D2：前端地图服务** —— 高德地图（GCJ-02 火星坐标系）
- **D3：Admin 输入方式** —— 地址反查（输入地址 → 自动获取经纬度）
- **D4：数据现状** —— 6 个校区需要重新收集地址
- **D5：可视化方案** —— "都不需要交互式地图"，admin 不做可拖拽微调地图，前端保留 iframe 不升级到 JS SDK

## 现状审计（服务器实测，2026-07-21）

### 数据库现状

| 校区 | latitude | longitude | 地址 |
|------|---------|----------|------|
| yousen-baibuting | 30.6486 | 114.3185 | 武汉市江岸区百步亭 |
| yousen-sanyanglu | 30.6036 | 114.2936 | 武汉市江岸区三阳路 |
| yousen-dongwuyuan | 30.547 | 114.231 | 武汉市汉阳区动物园附近 |
| （其余 3 个校区类似，未逐一列出） | | | |

### 前端实现真相

校区详情页 `/[locale]/campuses/[slug]` 用 **iframe 嵌入高德 URI scheme** 渲染地图：

```html
<iframe src="https://uri.amap.com/marker?position=114.3185,30.6486&name=百步亭校区&src=yousen&callnative=0"
        width="100%" height="320" style="border:0"></iframe>
```

`uri.amap.com/marker` 是公共 URI scheme，**不需要 key**，但渲染的是粗糙预览图，不是交互式地图。

### 后端 schema 现状

`campus` content type 包含三个坐标相关字段：

```json
"latitude":  { "type": "float", "description": "纬度（GCJ-02 火星坐标系）" },
"longitude": { "type": "float", "description": "经度（GCJ-02 火星坐标系）" },
"mapEmbed":  { "type": "text", "description": "地图嵌入代码（已废弃，保留兼容）" }
```

Strapi admin 后台没有任何地图可视化组件，admin 需要手输 float 数字。

### 范围审计

| Content type | 是否有坐标字段 |
|---|---|
| campus | ✅ 有 latitude/longitude/mapEmbed |
| site-settings | ❌ 无 |
| teacher | ❌ 无 |
| contact | ❌ 无 |
| footer | ❌ 无 |
| 前端其他页面 | ❌ 无（只有 campus 详情页用 uri.amap） |

**未来扩展需求**：用户表示"现在只有 campus，但未来要加"——可能给 site-settings 加总部坐标、teacher 加教学点等。方案需预留扩展性。

### 高德 Key 现状

用户提供的 key：`1faffb1bce264c7661f0a3100320dc31`（32 位 hex）

**能力范围**（用户在高德控制台确认）：
- 静态地图 API
- **地理编码 API**（关键能力，用于方案）
- **逆地理编码 API**
- **关键字搜索 API**
- **输入提示 API**（AutoComplete，浏览器端需要的但本方案不用）
- 周边搜索 API、多边形搜索 API、ID 查询 API
- 路径规划 API、坐标转换 API
- 行政区划查询 API、IP 定位 API、天气查询 API
- 交通态势 API、地理围栏 API、猎鹰服务 API、GeoHUB 服务 API

**Key 类型**：纯 Web Service API key（服务端用），**不包含 JS API**（用户确认"都不需要交互式地图"，不申请 JS API key）。

## 不精确根因分析

1. **手输精度问题**：4 位小数 `30.6486` 约有 11 米误差；输错一位（如 `30.6846`）就偏几百米
2. **坐标系混用风险**：admin 可能从 Google Maps（WGS-84）拿坐标直接粘贴 → 在高德地图（GCJ-02）上显示偏移几百米
3. **uri.amap.com/marker 本身是粗糙预览**：不是交互式地图，无法点击/缩放验证
4. **改地址后坐标不会自动更新**：admin 改了 `address` 字段但忘了同时改 `latitude/longitude`

## 方案设计（基于 D5 简化版）

### 核心思路

**Strapi 后端 lifecycle hook 自动 geocoding**：在 `campus` 内容保存前自动调用高德 Web Service Geocoding API，把地址转换为 GCJ-02 坐标。

```
admin 在 Strapi 后台输入/修改 campus.address
  ↓ beforeCreate / beforeUpdate lifecycle hook 触发
  ↓ Strapi 后端调用 https://restapi.amap.com/v3/geocode/geo?key=...&address=...
  ↓ 高德返回 GCJ-02 坐标
  ↓ hook 自动填充 campus.latitude / campus.longitude / campus.formattedAddress
入库 → 前端读取 → iframe uri.amap.com/marker 显示准确位置
```

### 数据模型变更（保守版，最小改动）

```
campus schema:
  ✓ address (string, i18n)              ← admin 唯一需要输入的字段
  ✓ latitude (float)                     ← hook 自动填充
  ✓ longitude (float)                    ← hook 自动填充
  ✓ mapEmbed (text)                      ← 保留兼容（前端不再使用）
  + formattedAddress (string, i18n)      ← 新增，高德返回的标准化地址
```

**为什么保留 `latitude` / `longitude` 字段名不变**：前端代码完全不需要改动，继续读取 `campus.latitude` / `campus.longitude`。

**为什么新增 `formattedAddress`**：admin 可以对照原输入地址（如"武汉市江岸区百步亭"）和高德返回的标准化地址（如"湖北省武汉市江岸区百步亭花园怡康路 1 号"），发现输入错误或地址歧义。

### Lifecycle Hook 策略

```typescript
// server/src/index.ts 或 plugins/campus-geocode/server/index.ts

export default {
  async beforeCreate(event) {
    await geocodeIfAddressPresent(event.params.data);
  },
  async beforeUpdate(event) {
    await geocodeIfAddressChanged(event.params.data, event.where.id);
  },
};

async function geocodeIfAddressPresent(data) {
  if (!data.address) return;
  const result = await callAmapGeocode(data.address);
  if (result?.geocodes?.[0]) {
    const [lng, lat] = result.geocodes[0].location.split(',').map(Number);
    data.latitude = lat;
    data.longitude = lng;
    data.formattedAddress = result.geocodes[0].formatted_address;
  }
}

async function geocodeIfAddressChanged(data, id) {
  // 拿数据库里现有的 address 比对
  const existing = await strapi.db.query('api::campus.campus').findOne({
    where: { id },
    select: ['address'],
  });
  if (data.address === existing?.address) return;  // 地址没变，不动坐标
  await geocodeIfAddressPresent(data);
}
```

**关键策略**：
- 地址没变 → 不覆盖现有坐标（保留 admin 手输兜底能力）
- 地址变了 → 自动重新 geocoding 覆盖坐标
- 高德 API 失败 → 不阻断保存，记录日志（admin 看到坐标没更新就知道出问题了）

### 配置

环境变量（客户服务器 `/opt/customer-site/.env` 和测试服务器）：

```bash
# 高德 Web Service API key（服务端用，不暴露到浏览器）
AMAP_WEB_SERVICE_KEY=1faffb1bce264c7661f0a3100320dc31
```

### 错误处理

| 场景 | 行为 |
|---|---|
| 高德 API 返回非 1 状态码（如 key 失效、配额超限） | 不阻断保存，记录 warning 日志，保留旧坐标 |
| 高德返回空 geocodes 数组（地址太模糊） | 不阻断保存，记录 warning，保留旧坐标；formattedAddress 设为"未匹配到精确坐标" |
| 网络/超时（>5 秒） | 不阻断保存，记录 error，保留旧坐标 |
| 高德返回多个候选 | 取第一个（高德默认按相关性排序） |

### 一次性批量重新 geocoding 任务

6 个校区已有坐标，但用户说"需要重新收集"。方案：

1. **第一步：核对地址** —— 让用户在 Strapi 后台手动核对 6 个校区的 `address` 字段（或先在 Excel 里整理好 6 个准确地址，再批量更新到 Strapi）
2. **第二步：批量重新 geocoding** —— 写一个一次性 Node.js 脚本，遍历所有校区，调用高德 API 重新算坐标，更新数据库
3. **第三步：验证** —— 在前端打开 6 个校区详情页，确认地图显示位置准确

## 实施步骤

| 阶段 | 内容 | 工作量 |
|------|------|--------|
| 1 | Strapi plugin 开发：lifecycle hook + 高德 Web Service API 调用 + key 配置 | 0.5-1 天 |
| 2 | campus schema 加 formattedAddress 字段（i18n） | 0.2 天 |
| 3 | 一次性"批量重新 geocoding"任务脚本 + 6 个校区数据更新 | 0.3 天 |
| 4 | 测试：改一个校区地址 → 验证坐标自动更新 → 验证前端地图显示准确 | 0.5 天 |
| **合计** | | **1.5-2 天** |

## 测试方案（TDD）

### 单元测试

```typescript
// 测试 lifecycle hook
describe('campus geocoding lifecycle', () => {
  it('beforeCreate: 地址非空时自动填充 latitude/longitude/formattedAddress', async () => { ... });
  it('beforeUpdate: 地址未变时不覆盖现有坐标', async () => { ... });
  it('beforeUpdate: 地址变化时重新 geocoding', async () => { ... });
  it('高德 API 失败时不阻断保存', async () => { ... });
  it('高德返回空 geocodes 时保留旧坐标', async () => { ... });
});
```

### 集成测试

1. **正常路径**：创建新校区，输入地址 → 保存 → 数据库中 latitude/longitude/formattedAddress 自动填充
2. **更新路径**：修改现有校区 address → 保存 → 坐标自动更新
3. **保留路径**：修改现有校区其他字段（不改 address）→ 保存 → 坐标不变
4. **降级路径**：模拟高德 API 500 → 保存仍成功，坐标保留旧值，日志有 warning
5. **前端验证**：打开 `https://yoosen.cn/zh-CN/campuses/yousen-baibuting` → 地图 iframe 显示位置准确

### 真实数据验证

6 个校区全部重新 geocoding 后，逐一在前端验证：

| 校区 | 预期显示位置 |
|------|------------|
| yousen-baibuting | 武汉市江岸区百步亭 |
| yousen-sanyanglu | 武汉市江岸区三阳路 |
| yousen-dongwuyuan | 武汉市汉阳区动物园附近 |
| ... | ... |

## 未来扩展（不在本次范围）

按用户 D5 决策，本次不做交互式地图。但方案已为未来留好接口：

- 如果未来要给 site-settings 加总部坐标 → 复用同一个 lifecycle hook 模式（只需在 site-settings schema 加 `address/latitude/longitude/formattedAddress` 四个字段，hook 同样适用）
- 如果未来要做 admin 可视化（地图预览/拖拽微调）→ 申请高德 JS API key，写 Strapi custom field 包装现有逻辑
- 如果未来要做前端交互式地图 → 用 JS API key + AMap JS SDK 替换 iframe

## 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| 高德 API 配额超限（免费版每日 5000 次） | 单次保存只调 1 次 API，6 个校区一次性重算只 6 次；即使后续每日改 10 个校区，远低于配额 |
| 地址太模糊导致返回多个候选 | hook 只取第一个，admin 通过 `formattedAddress` 字段发现歧义后可手动改更精确的地址 |
| 高德 Web Service API 偶发故障 | hook 不阻断保存，记录日志，admin 看到坐标没更新就知道出问题 |
| Web Service key 暴露风险 | key 只配置在服务端环境变量，不暴露到前端 JS bundle；Strapi admin API 也不返回 key |
| 现有 6 个校区数据可能本来就不准 | 一次性批量重新 geocoding 任务，确保所有校区坐标都基于最新地址重新计算 |

## 不在范围（明确排除）

按 D5 决策和 YAGNI 原则，以下不在本次范围：

- ❌ Strapi admin 内嵌交互式地图（拖拽微调）
- ❌ 前端 iframe 升级到高德 JS SDK 交互式地图
- ❌ 申请高德 JS API key
- ❌ 自定义 Strapi custom field 组件（直接用 lifecycle hook 即可）
- ❌ 给其他 content type（site-settings、teacher）加坐标字段（"未来要加"不等于"现在做"）

## 待用户审查的关键点

1. **是否同意保留 `latitude` / `longitude` 字段名不变**（前端无需改动）？
2. **是否同意新增 `formattedAddress` 字段**（用于核对地址准确性）？
3. **6 个校区现有地址是否需要先核对**（建议在 Excel 里整理 6 个准确地址再批量导入）？
4. **高德 key 失效时的降级行为是否同意**（不阻断保存、保留旧坐标、记录日志）？
