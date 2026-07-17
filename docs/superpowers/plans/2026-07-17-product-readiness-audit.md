# 产品级就绪核查与补全实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 验证并补全产品级就绪状态——前端页面齐全+部件完整、后端数据齐全、前后端功能对齐、前后端双语齐全，达到"改数据就能在客户服务器部署"的状态。

**架构：** 本地 PostgreSQL 环境（已对齐服务器）逐项核查 + 补全。核查分三阶段：P1 翻译与渲染验证（浏览器逐页验证）→ P2 功能对齐与 SEO/GEO 完整性 → P3 部署就绪化（seed 可重复执行 + 检查清单）。

**技术栈：** Strapi v5（backend, PostgreSQL 16）、Next.js 14（frontend-next, next-intl）、Next.js（central）、Vitest、Playwright、browser_use

**前置条件：**
- 本地 backend 运行在 `http://localhost:1337`（PostgreSQL 模式，NODE_ENV=production）
- 本地 PostgreSQL 容器 `yousen-postgres` 运行中（strapi/changeme）
- 本地 frontend-next 构建成功（`npm run build`）
- admin 登录凭据：`admin@yousen.com` / `Admin123!`

---

## 当前状态快照（2026-07-17 调研）

| 维度 | 状态 | 详情 |
|------|------|------|
| 后端数据 | ✅ 齐全 | pages 12, products 6, news 20, teachers 12, campuses 12, navigations 6, site_settings 1, footers 1 |
| 前端路由 | ✅ 齐全 | 18 个页面（首页/预约/校区/课程/新闻/教师/FAQ/联系/隐私/退款/用户协议 + 动态详情页） |
| 前端组件 | ✅ 齐全 | 12 个 section（Hero/Features/Advantages/Gallery/Team/Testimonials/Faq/ProductGrid/ProductComparison/ContactForm/FloatingButton/RichText） |
| 后端 API | ✅ 齐全 | 22 个 API 模块 |
| 翻译 key 对齐 | ✅ | zh-CN + en-US 顶层 17 key 完全对齐，嵌套 key 无缺失 |
| 种子脚本 | ✅ 存在 | `backend/scripts/seed-yousen.js`（支持 --force/--remove） |
| i18n 配置 | ✅ | locales: ['zh-CN', 'en-US'], defaultLocale: 'zh-CN' |

**待核查缺口**：
1. en-US 翻译值质量（是否有空值/占位）
2. 18 个页面实际渲染是否正常（部件完整、无报错）
3. Dynamic Zone 组件配置是否完整
4. SEO/GEO（sitemap.xml/robots.txt/llms.txt/JSON-LD/hreflang）
5. seed-yousen.js 是否可重复执行（--force 不报错）
6. "改数据就能部署"的参数化标准

---

## 文件结构

### 修改的文件

| 文件 | 职责 | 任务 |
|------|------|------|
| `frontend-next/i18n/messages/en-US.json` | 补全空值/占位翻译 | T1 |
| `docs/PRE-DEPLOY-CHECKLIST.md` | 新建部署前检查清单 | T8 |
| `docs/PRODUCT-READINESS-REPORT.md` | 新建产品级就绪报告 | T9 |

### 创建的文件

| 文件 | 职责 | 任务 |
|------|------|------|
| `docs/PRE-DEPLOY-CHECKLIST.md` | 部署前检查清单 | T8 |
| `docs/PRODUCT-READINESS-REPORT.md` | 产品级就绪核查报告 | T9 |

---

## P1：翻译与渲染验证（任务 1-3）

### 任务 1：en-US 翻译值质量核查与补全

**文件：**
- 修改：`frontend-next/i18n/messages/en-US.json`

- [ ] **步骤 1：扫描 en-US.json 的空值/占位**

```bash
cd /home/tishensnoopy/project/superpowers-zh/frontend-next
python3 <<'PYEOF'
import json
en = json.load(open('i18n/messages/en-US.json'))
zh = json.load(open('i18n/messages/zh-CN.json'))

def find_empty(d, prefix=''):
    empty = []
    for k, v in d.items():
        full = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            empty.extend(find_empty(v, full))
        elif not v or v.strip() == '' or v.startswith('TODO') or v.startswith('待翻译'):
            empty.append((full, v))
    return empty

empty_en = find_empty(en)
if empty_en:
    print(f"❌ en-US 有 {len(empty_en)} 个空值/占位:")
    for k, v in empty_en[:20]:
        print(f"  {k}: '{v}'")
else:
    print("✅ en-US 无空值/占位")

# 检查 en-US 值是否跟 zh-CN 一样（未翻译）
same_as_zh = []
def check_same(en_d, zh_d, prefix=''):
    for k in en_d:
        full = f"{prefix}.{k}" if prefix else k
        if k in zh_d and isinstance(en_d[k], str) and isinstance(zh_d[k], str):
            if en_d[k] == zh_d[k] and en_d[k]:
                same_as_zh.append((full, en_d[k]))
        elif k in zh_d and isinstance(en_d[k], dict) and isinstance(zh_d[k], dict):
            check_same(en_d[k], zh_d[k], full)
check_same(en, zh)
if same_as_zh:
    print(f"⚠️ en-US 有 {len(same_as_zh)} 个值跟 zh-CN 一样（可能未翻译）:")
    for k, v in same_as_zh[:10]:
        print(f"  {k}: '{v[:50]}'")
else:
    print("✅ en-US 所有值都跟 zh-CN 不同（已翻译）")
PYEOF
```

预期：识别出空值/占位/未翻译的 key。

- [ ] **步骤 2：补全空值/占位翻译**

根据步骤 1 的输出，编辑 `frontend-next/i18n/messages/en-US.json`，为每个空值/占位 key 填写正确的英文翻译。参考 `zh-CN.json` 对应 key 的中文含义。

- [ ] **步骤 3：验证翻译完整性**

重新运行步骤 1 的脚本，预期输出：
```
✅ en-US 无空值/占位
✅ en-US 所有值都跟 zh-CN 不同（已翻译）
```

- [ ] **步骤 4：验证前端构建**

```bash
cd /home/tishensnoopy/project/superpowers-zh/frontend-next
npm run build 2>&1 | tail -10
```
预期：构建成功，无 i18n 相关错误。

- [ ] **步骤 5：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend-next/i18n/messages/en-US.json
git commit -m "fix(i18n): 补全 en-US 翻译空值/占位

- 修复 N 个空值/占位翻译
- 确保 zh-CN 和 en-US 翻译质量一致"
```

---

### 任务 2：前端页面渲染逐页验证（zh-CN）

**文件：** 无修改（验证任务）

**说明：** 需要启动 frontend-next dev 服务器。确保 backend 在 1337 端口运行。

- [ ] **步骤 1：启动 frontend-next dev 服务器**

```bash
cd /home/tishensnoopy/project/superpowers-zh/frontend-next
npm run dev 2>&1 &
# 等待启动
sleep 10
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/zh-CN
```
预期：HTTP 200

- [ ] **步骤 2：用 browser_use 逐页验证 18 个页面**

使用 browser_use agent 验证以下 18 个页面（zh-CN）：

| # | URL | 预期内容 |
|---|-----|---------|
| 1 | http://localhost:3000/zh-CN | 首页：Hero + Features + Advantages + Gallery + Testimonials |
| 2 | http://localhost:3000/zh-CN/courses | 课程列表 |
| 3 | http://localhost:3000/zh-CN/courses/[第一个slug] | 课程详情 |
| 4 | http://localhost:3000/zh-CN/teachers | 教师列表（12 位） |
| 5 | http://localhost:3000/zh-CN/teachers/[第一个slug] | 教师详情 |
| 6 | http://localhost:3000/zh-CN/campuses | 校区列表（12 个） |
| 7 | http://localhost:3000/zh-CN/campuses/[第一个slug] | 校区详情 |
| 8 | http://localhost:3000/zh-CN/news | 新闻列表（20 篇） |
| 9 | http://localhost:3000/zh-CN/news/[第一个slug] | 新闻详情 |
| 10 | http://localhost:3000/zh-CN/faq | FAQ 列表（9 条） |
| 11 | http://localhost:3000/zh-CN/appointment | 预约表单 |
| 12 | http://localhost:3000/zh-CN/appointment-success | 预约成功页 |
| 13 | http://localhost:3000/zh-CN/contact | 联系表单 |
| 14 | http://localhost:3000/zh-CN/privacy-policy | 隐私政策 |
| 15 | http://localhost:3000/zh-CN/refund-policy | 退款政策 |
| 16 | http://localhost:3000/zh-CN/user-agreement | 用户协议 |
| 17 | http://localhost:3000/zh-CN/[第一个page slug] | 动态页面（从 Strapi pages 获取） |

每个页面验证：
- 页面加载不报 500/404
- 关键部件渲染（不是白屏）
- 浏览器控制台无致命错误
- 截图保存

- [ ] **步骤 3：记录渲染问题清单**

将发现的渲染问题整理为清单，标注：
- 页面 URL
- 问题描述（白屏/部件缺失/样式错误/API 报错）
- 截图路径
- 严重程度（P0 阻塞 / P1 影响 / P2 优化）

- [ ] **步骤 4：修复 P0/P1 渲染问题**

根据问题清单，逐个修复 P0/P1 问题。修复后重新验证。

---

### 任务 3：前端页面渲染逐页验证（en-US）

**文件：** 无修改（验证任务）

- [ ] **步骤 1：用 browser_use 验证 en-US 路由**

验证关键页面（en-US）：
- http://localhost:3000/en-US
- http://localhost:3000/en-US/courses
- http://localhost:3000/en-US/teachers
- http://localhost:3000/en-US/campuses
- http://localhost:3000/en-US/news
- http://localhost:3000/en-US/faq
- http://localhost:3000/en-US/appointment
- http://localhost:3000/en-US/contact

每个页面验证：
- 页面加载不报 500/404
- 文字显示为英文（不是中文 fallback）
- hreflang 标签正确（`<link rel="alternate" hreflang="en-US" ...>`）
- 截图保存

- [ ] **步骤 2：记录 en-US 翻译问题**

整理翻译问题清单：
- 未翻译的硬编码中文
- fallback 到 key 名的翻译
- hreflang 标签缺失

- [ ] **步骤 3：修复翻译问题**

根据问题清单修复：
- 硬编码中文 → 使用 `useTranslations()` hook
- 缺失翻译 → 补充 en-US.json
- hreflang 标签 → 检查 `buildMetadata` 函数

---

## P2：功能对齐与 SEO/GEO 完整性（任务 4-6）

### 任务 4：前后端功能对齐核查

**文件：** 无修改（核查任务，如有缺失再补）

- [ ] **步骤 1：提取前端调用的所有 API 端点**

```bash
cd /home/tishensnoopy/project/superpowers-zh/frontend-next
# 提取所有 fetch 调用的 API 路径
grep -rn "fetch\|getStrapiURL\|apiFetch\|STRAPI_API" lib/ app/ components/ 2>/dev/null \
  | grep -oP "['\"](/api/[^'\"]*|/content-manager/[^'\"]*)['\"]" \
  | sort -u > /tmp/frontend-api-endpoints.txt
cat /tmp/frontend-api-endpoints.txt
```

- [ ] **步骤 2：提取后端提供的所有 API 路由**

```bash
cd /home/tishensnoopy/project/superpowers-zh/backend
# 提取所有路由定义
find src/api -name "*.ts" -path "*/routes/*" -exec grep -H "router\.\(get\|post\|put\|delete\|patch\)" {} \; \
  | head -50
```

- [ ] **步骤 3：对照前端调用与后端路由**

将前端调用的 API 端点与后端路由对照：
- ✅ 前端调用 + 后端有 → 正常
- ❌ 前端调用 + 后端无 → 缺失 API，需补全
- ⚠️ 后端有 + 前端未调用 → 可能是未使用的 API

- [ ] **步骤 4：补全缺失的 API（如有）**

如果步骤 3 发现缺失 API，在 `backend/src/api/<module>/routes/` 和 `controllers/` 中补全。

- [ ] **步骤 5：验证 API 对齐**

重新运行步骤 1-3，确认所有前端调用的 API 后端都有实现。

---

### 任务 5：Dynamic Zone 组件配置完整性

**文件：** 无修改（核查任务）

- [ ] **步骤 1：检查 pages 的 layout 字段（Dynamic Zone）**

```bash
docker exec yousen-postgres psql -U strapi -d strapi -c "
SELECT id, title, 
  jsonb_array_length(layout) as component_count,
  jsonb_typeof(layout) as layout_type
FROM pages 
WHERE layout IS NOT NULL 
LIMIT 10;
"
```

- [ ] **步骤 2：检查 page schema 的 Dynamic Zone 定义**

```bash
cat /home/tishensnoopy/project/superpowers-zh/backend/src/api/page/content-types/page/schema.json \
  | python3 -c "import json,sys; d=json.load(sys.stdin); dz=d['attributes'].get('layout',{}); print(json.dumps(dz, indent=2, ensure_ascii=False))"
```

- [ ] **步骤 3：核查 Dynamic Zone 可用组件**

确认 `layout` Dynamic Zone 的 `components` 列表包含所有 12 个 section 组件：
- common.hero, common.features, common.advantages, common.gallery
- common.team, common.testimonials, common.faq
- section.advantages, section.features 等

- [ ] **步骤 4：在 Strapi Admin 中验证**

打开 http://localhost:1337/admin，登录后：
1. Content Manager → Pages → 编辑任意 page
2. 确认 layout 字段是 Dynamic Zone
3. 确认可以添加所有 section 组件
4. 截图保存

---

### 任务 6：SEO/GEO 完整性核查

**文件：** 无修改（核查任务，如有缺失再补）

- [ ] **步骤 1：验证 sitemap.xml**

```bash
curl -s http://localhost:3000/sitemap.xml | head -30
# 预期：包含所有页面的 URL，有 zh-CN 和 en-US 两个 locale
```

- [ ] **步骤 2：验证 robots.txt**

```bash
curl -s http://localhost:3000/robots.txt
# 预期：允许爬取，指向 sitemap.xml
```

- [ ] **步骤 3：验证 llms.txt**

```bash
curl -s http://localhost:3000/llms.txt | head -20
# 预期：包含 AI 摘要和结构化信息
```

- [ ] **步骤 4：验证 JSON-LD 结构化数据**

用 browser_use 打开首页，检查页面源码是否包含：
- `application/ld+json` script 标签
- Organization / WebSite / EducationalOrganization schema

- [ ] **步骤 5：验证 hreflang 标签**

用 browser_use 打开首页和课程页，检查 `<head>` 是否包含：
```html
<link rel="alternate" hreflang="zh-CN" href="..." />
<link rel="alternate" hreflang="en-US" href="..." />
<link rel="alternate" hreflang="x-default" href="..." />
```

- [ ] **步骤 6：记录并修复 SEO/GEO 缺失项**

整理缺失项清单并修复。

---

## P3：部署就绪化（任务 7-9）

### 任务 7：种子数据可重复部署化验证

**文件：** 无修改（验证任务）

- [ ] **步骤 1：验证 seed-yousen.js --force 可重复执行**

```bash
cd /home/tishensnoopy/project/superpowers-zh/backend
# 先备份当前数据
docker exec yousen-postgres psql -U strapi -d strapi -c "SELECT count(*) FROM pages;"

# 执行 seed --force
node scripts/seed-yousen.js --force 2>&1 | tail -20

# 验证数据仍然存在
docker exec yousen-postgres psql -U strapi -d strapi -c "SELECT count(*) FROM pages;"
```
预期：seed 执行成功，数据数量不变或增加。

- [ ] **步骤 2：验证 seed --remove 清理**

```bash
cd /home/tishensnoopy/project/superpowers-zh/backend
node scripts/seed-yousen.js --remove 2>&1 | tail -10
docker exec yousen-postgres psql -U strapi -d strapi -c "SELECT count(*) FROM pages;"
# 预期：数据被清空（0 行）
```

- [ ] **步骤 3：重新 seed 恢复数据**

```bash
cd /home/tishensnoopy/project/superpowers-zh/backend
node scripts/seed-yousen.js 2>&1 | tail -10
docker exec yousen-postgres psql -U strapi -d strapi -c "SELECT count(*) FROM pages;"
# 预期：数据恢复（12 行 pages）
```

- [ ] **步骤 4：记录 seed 脚本使用说明**

确认 seed 脚本的用法：
- 首次部署：`node scripts/seed-yousen.js`
- 强制重置：`node scripts/seed-yousen.js --force`
- 清空数据：`node scripts/seed-yousen.js --remove`
- 部分 seed：`node scripts/seed-yousen.js --only=pages,teachers`

---

### 任务 8：创建部署前检查清单

**文件：**
- 创建：`docs/PRE-DEPLOY-CHECKLIST.md`

- [ ] **步骤 1：创建 PRE-DEPLOY-CHECKLIST.md**

创建 `/home/tishensnoopy/project/superpowers-zh/docs/PRE-DEPLOY-CHECKLIST.md`：

```markdown
# 部署前检查清单

> 服务器同步前必须逐项打勾。任何一项未通过都不可上服务器。

## 本地环境（必须 PostgreSQL，不是 SQLite）

- [ ] backend/.env 的 DATABASE_CLIENT=postgres
- [ ] 本地 PostgreSQL 容器运行中（`docker ps | grep postgres`）
- [ ] backend 能连接 PostgreSQL（`curl http://localhost:1337/_health` 返回 204）

## 代码质量

- [ ] `cd backend && npm run typecheck` 通过（无错误）
- [ ] `cd backend && npm test` 全绿（177+ 测试通过）
- [ ] `cd central && set -a && source .env && set +a && npm test` 全绿（83+ 测试通过）
- [ ] `cd frontend-next && npm run build` 成功（无错误，ESLint 警告可接受）

## Content Manager 验证

- [ ] /content-manager/init API 返回 36+ content type，kind 全部为 collectionType
- [ ] 浏览器登录 Content Manager，Page 列表正常显示（不卡 loading）
- [ ] 浏览器登录 Content Manager，Page 创建页正常显示表单
- [ ] 无 "Cannot read properties of undefined (reading 'push')" 错误

## i18n 验证

- [ ] i18n_locale 表有 zh-CN 和 en-US 两条记录，locale 字段不为 NULL
- [ ] plugin_i18n_default_locale = "zh-CN"
- [ ] 所有业务表 locale 字段无 NULL
- [ ] zh-CN.json 和 en-US.json 翻译 key 完全对齐
- [ ] en-US.json 无空值/占位

## 页面渲染验证

- [ ] zh-CN 首页正常渲染（Hero+Features+Advantages+Gallery+Testimonials）
- [ ] zh-CN 18 个页面全部可访问（无 500/404）
- [ ] en-US 关键页面正常渲染（翻译为英文）
- [ ] hreflang 标签正确（zh-CN + en-US + x-default）

## SEO/GEO

- [ ] /sitemap.xml 可访问，包含双语 URL
- [ ] /robots.txt 可访问，指向 sitemap
- [ ] /llms.txt 可访问
- [ ] 首页有 JSON-LD 结构化数据（Organization/WebSite）

## 数据完整性

- [ ] seed-yousen.js --force 可重复执行
- [ ] pages 12+ / products 6+ / news 20+ / teachers 12+ / campuses 12+
- [ ] navigations 6+ / site_settings 1+ / footers 1+

## 服务器同步前

- [ ] git status 干净（所有修改已提交）
- [ ] git push 完成
- [ ] 服务器 SSH 可连接
- [ ] 服务器 .env 已配置（DATABASE_PASSWORD/AES_KEY/JWT_SECRET 等敏感变量）

## 服务器同步后

- [ ] docker compose build 成功
- [ ] docker compose up -d 成功
- [ ] 所有容器 healthy
- [ ] 服务器 Content Manager 不卡 loading
- [ ] 服务器首页可访问
```

- [ ] **步骤 2：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add docs/PRE-DEPLOY-CHECKLIST.md
git commit -m "docs: 添加部署前检查清单 PRE-DEPLOY-CHECKLIST

- 7 大检查维度：环境/代码质量/Content Manager/i18n/页面渲染/SEO-GEO/数据完整性
- 服务器同步前后各阶段检查项
- 确保本地 PostgreSQL 测试全绿才上服务器"
```

---

### 任务 9：生成产品级就绪报告

**文件：**
- 创建：`docs/PRODUCT-READINESS-REPORT.md`

- [ ] **步骤 1：执行完整核查**

按 PRE-DEPLOY-CHECKLIST.md 逐项核查，记录结果。

- [ ] **步骤 2：生成报告**

创建 `/home/tishensnoopy/project/superpowers-zh/docs/PRODUCT-READINESS-REPORT.md`，包含：
- 核查日期和环境信息
- 各维度核查结果（通过/未通过/部分通过）
- 发现的问题和修复状态
- "改数据就能部署"的评估结论
- 遗留风险和缓解措施

- [ ] **步骤 3：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add docs/PRODUCT-READINESS-REPORT.md
git commit -m "docs: 生成产品级就绪核查报告

- 9 个维度核查结果
- 产品级就绪状态评估
- 遗留风险和缓解措施"
```

---

## 自检

### 规格覆盖度
- ✅ 前端页面齐全 → 任务 2（逐页验证 18 个页面）
- ✅ 显示正常 → 任务 2（浏览器验证渲染）
- ✅ 部件完整 → 任务 2 + 任务 5（Dynamic Zone 组件配置）
- ✅ 后端有数据 → 当前已验证（调研快照）
- ✅ 前后端功能完整对齐 → 任务 4（API 对照核查）
- ✅ 前端双语齐全 → 任务 1（en-US 翻译质量）+ 任务 3（en-US 渲染验证）
- ✅ 后端双语齐全 → 当前已验证（i18n_locale 表 zh-CN + en-US）
- ✅ "改数据就能部署" → 任务 7（seed 可重复执行）+ 任务 8（部署检查清单）

### 执行顺序
1. **任务 1**（翻译补全）→ 必须先做，否则 en-US 页面渲染会发现问题
2. **任务 2**（zh-CN 渲染验证）→ 核心验证
3. **任务 3**（en-US 渲染验证）→ 依赖任务 1
4. **任务 4-6**（功能对齐 + SEO/GEO）→ 可并行
5. **任务 7**（seed 验证）→ 独立
6. **任务 8-9**（检查清单 + 报告）→ 最后汇总

### 风险提示
- 任务 2-3 需要启动 frontend dev 服务器（端口 3000），需确保 central 不占用 3000
- 任务 7 的 seed --remove 会清空数据，执行前确保有备份
- 浏览器验证需要 backend + frontend 同时运行
