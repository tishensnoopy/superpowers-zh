# 全量重置前问题根因报告

> **生成时间：** 2026-07-18（第二轮补充）
> **修复状态更新时间：** 2026-07-18（见文末「修复状态追踪」）
> **目的：** 汇总全覆盖排查发现的所有问题的**根因**与**修复优先级**，为「全量重置服务器数据库（保留超管账号）」提供前置依据
> **原则：** 只报告根因，不提修复方案；所有结论均经亲自验证，子代理误判已剔除
> **关联文档：** [PRODUCT-READINESS-REPORT.md](./PRODUCT-READINESS-REPORT.md) · [PRE-DEPLOY-CHECKLIST.md](./PRE-DEPLOY-CHECKLIST.md) · [known-issues.md](./known-issues.md)

---

## 0. 事实复核声明（推翻 3 个子代理误判）

| # | 子代理报告 | 复核结果 | 证据 |
|---|-----------|---------|------|
| 1 | 「backend 缺少 `@strapi/plugin-i18n` 依赖，导致 admin 无中文翻译」 | **误判**。Strapi v5 的 i18n 插件包名为 `@strapi/i18n`，随 `@strapi/strapi` 核心捆绑 | `backend/node_modules/@strapi/i18n` 存在；i18n 功能实际工作正常（locale 数据、API fallback、en-US 页面均验证通过） |
| 2 | 「前端翻译文件 key 缺失（zh-CN 有 nav.settings，en-US 无）」 | **误判**。zh-CN.json 与 en-US.json 各 388 个 key，**完全对齐，0 缺失、0 空值** | 脚本扁平化对比（见附录 A 验证方法） |
| 3 | 「backend 存在 308 处 console.log」 | **数字失准**。`backend/src` 实际 122 处；其中 **13 处打印 `ctx.request.body`** 属实 | Grep 统计（见附录 A） |

**方法论教训：** 子代理报告的所有关键数据必须经主会话亲自验证后才能采信。

---

## 1. 用户提出问题的真实根因

### 1.1 「中英文翻译不全」——前端

**表象认知：** 翻译文件缺 key。
**实际根因（翻译文件本身完整，问题在别处）：**

| 根因 | 说明 | 证据 |
|------|------|------|
| R1：en-US **数据**不完整（非翻译文件） | 前端文案 key 完整（388/388），但 Strapi 内容表的 en-US 记录是 7-17 批量脚本生成的，部分字段为机翻/占位质量；且 seed 脚本只创建 zh-CN 数据，en-US 依赖事后补建脚本（`create-en-us-locales.js`），**重置后该脚本必须重跑，否则 en-US 页面 500** | PRODUCT-READINESS-REPORT §2.5：i18n 修复后 en-US 页面曾因无数据全部 500（`Cannot read properties of undefined (reading 'logo')`） |
| R2：LanguageSwitcher 切换逻辑 bug | `cleanPath = pathname.replace(/^\/en-US/, '')` 只剥离 en-US 前缀。从英文页切回中文时正常，但**从中文页（/zh-CN 或无前缀）切到英文时**，拼接逻辑依赖 cookie + 路径约定，在 `/zh-CN/...` 显式路径下会生成错误 URL | [LanguageSwitcher.tsx](file:///home/tishensnoopy/project/superpowers-zh/frontend-next/components/layout/LanguageSwitcher.tsx) |
| R3：next-intl middleware 307 重定向副作用 | `/zh-CN` → `/` 的 307 重定向会中断 RSC prefetch；`set-cookie: NEXT_LOCALE` 使响应 cache-control 变为 `private, no-cache, no-store`，**ISR 缓存失效**，所有页面退化为动态渲染 | [middleware.ts](file:///home/tishensnoopy/project/superpowers-zh/frontend-next/middleware.ts) + routing 配置 |

### 1.2 「中英文翻译不全」——后端（Strapi Admin）

| 根因 | 说明 | 证据 |
|------|------|------|
| R4：Admin UI 语言未配置 | `backend/src/admin/` 目录为空，无 app 配置。Strapi v5 Admin 界面语言按**每个用户的 Profile 设置**生效（自带 zh-Hans 语言包），未设置时跟随浏览器/默认英文 | `ls backend/src/admin/` 为空 |
| R5：字段标签无法中文化是 Strapi v5 原生行为 | v5 Content Manager 的字段标签直接显示 schema attribute 名（英文 camelCase），**v5 没有字段级翻译机制**；content type 的 displayName 已中文化（如「预约试听」），但字段级（parentName / childName / phone…）只能显示英文属性名 | [appointment/schema.json](file:///home/tishensnoopy/project/superpowers-zh/backend/src/api/appointment/content-types/appointment/schema.json)（displayName 中文、attribute 英文） |
| R6：后端业务数据 en-US 依赖补建脚本 | 同 R1。后端「英文不全」的实质是**数据层面** en-US 记录的质量与完整性，不是插件缺失 | 同 R1 |

### 1.3 「媒体库图片无法显示」

| 根因 | 说明 | 证据 |
|------|------|------|
| R7：服务器 nginx 配置漂移 | 本地 [nginx.conf](file:///home/tishensnoopy/project/superpowers-zh/nginx/nginx.conf) 有 `/uploads/` location 反代到 Strapi，但**服务器上的 nginx 配置缺少该 location**，请求 `/uploads/*` 未到达 Strapi，图片 500/404 | 服务器审计（7-18 凌晨）对比本地配置发现；根因类别 = 部署漂移（服务器配置未随仓库更新） |

---

## 2. 全覆盖排查发现的其他根因（用户未提及，按维度分组）

### 2.1 数据安全与合规（PIPL 相关）

| # | 根因 | 严重度 |
|---|------|--------|
| R8 | **13 处控制器打印完整 `ctx.request.body`**：product-category(2)、footer(2)、faq-item(3，含 submitFeedback 用户反馈内容)、site-settings(2)、navigation(2)、product-spec(2)。反馈/预约类 body 含用户输入，落盘到 Docker 日志即构成 PII 持久化风险 | 高 |
| R9 | ICP 备案号、公安备案号在 seed 数据中为空字符串（`icp: ''`），页脚渲染空备案信息，不符合国内网站合规要求 | 高（上线阻断） |
| R10 | 预约/反馈数据保留策略未定义（appointment/feedback/chat_message 无自动清理机制），长期积累 PII | 中 |

### 2.2 基础设施

| # | 根因 | 严重度 |
|---|------|--------|
| R11 | Docker 容器无内存/CPU 限制（docker-compose.yml 无 `mem_limit`/`cpus`/`deploy.resources`），服务器仅 3.6G 内存 + 2G swap，9 容器共存存在 OOM 竞争风险 | 高 |
| R12 | 数据库连接池未配置（`config/database.ts` 无 pool 设置，走 knex 默认 min 0/max 10），多服务共用 PG 时连接数无预算 | 中 |
| R13 | 客户业务数据库无自动备份（Central 有 cron 每天 3 点备份，客户业务仅手动 pg_dump） | 中 |
| R14 | 部署漂移无防护：服务器 nginx 配置、.env 与仓库可能不一致（R7 即实例），无配置校验/漂移检测步骤 | 高 |

### 2.3 功能缺陷

| # | 根因 | 严重度 |
|---|------|--------|
| R15 | 导航二级菜单数据损坏：navigation schema 的 children/parent 自引用定义正确，但 seed 脚本第二遍（创建子项并设置 parent 关系）在服务器上未成功执行，`navigations_parent_lnk` 关联表缺数据 → 前端导航无下拉 | 高 |
| R16 | `document-processor.ts` 硬编码 `CHUNK_SIZE=500 / CHUNK_OVERLAP=50`，ai-config 表中的 chunkSize/chunkOverlap 配置项**不生效**（配置 UI 形同虚设） | 中 |
| R17 | vector-config 是死代码：schema 定义了向量库配置表，但代码硬编码 pgvector，配置表从未被读取 | 低 |
| R18 | feedback API 前端无调用（dead code）：feedback content type + controller 存在，但前端无任何提交入口 | 低 |
| R19 | 权限管理只有静态配置：rbac.ts 硬编码权限列表，**无超管给客户管理员分配权限的 UI**，客户管理员权限集不可调 | 高（用户明确提出） |
| R20 | site-settings schema 无 themeColor/fontSettings 字段，主题色/字体无法在后台管理（如需该能力属需求缺口，非 bug） | 低 |
| R21 | API 响应格式不一致：Strapi 默认格式（data/attributes）、product controller 自定义格式、chat controller 混合格式并存，前端需适配多套解析逻辑 | 中 |

### 2.4 可观测性

| # | 根因 | 严重度 |
|---|------|--------|
| R22 | 后端无结构化日志：122 处 `console.*` 直出，无日志级别/格式/收集方案，生产排查靠 `docker logs` 人肉翻 | 中 |
| R23 | Sentry 仅前端：backend/central/agent 无错误监控接入（前端已配 Sentry + 噪声过滤） | 中 |

### 2.5 前端运行时

| # | 根因 | 严重度 |
|---|------|--------|
| R24 | Strapi Admin CodeMirror 报错：`@codemirror/state` 多实例导致 instanceof 检查失败（admin 构建期依赖 hoisting 问题；此前 npm audit fix 曾引发类似 hoisting 故障并回滚） | 中 |
| R25 | 404 页面返回 HTTP 200（软 404）：not-found 页未设置正确状态码，SEO 层面搜索引擎会将不存在页面编入索引 | 中 |

---

## 2A. 第二轮排查新发现（用户提示「还有很多其他问题」后补充）

### 2A.1 安全加固（7 项）

| # | 根因 | 严重度 | 证据 |
|---|------|--------|------|
| R26 | **数据库/Redis/MeiliSearch 端口直接绑定宿主机 0.0.0.0**：`docker-compose.yml` 把 5432/6379/7700 映射到宿主机所有接口，若安全组未拦截则直接暴露公网 | 高 | [docker-compose.yml:36,53,71](file:///home/tishensnoopy/project/superpowers-zh/docker-compose.yml) |
| R27 | **所有密钥默认值是 `changeme`**：APP_KEYS/JWT_SECRET/API_TOKEN_SALT/ADMIN_JWT_SECRET/TRANSFER_TOKEN_SALT 均有 `changeme` 兜底，生产环境若 .env 未配置则使用弱密钥 | 高 | [docker-compose.yml:109-113](file:///home/tishensnoopy/project/superpowers-zh/docker-compose.yml) |
| R28 | **backend 无 middlewares.ts**：无 CORS 白名单、无 rate-limit 中间件、无 helmet 安全头自定义配置（仅有 appointment 控制器内嵌的 max 5/hour 限流） | 中 | `ls backend/config/` 仅 4 个文件，无 middlewares.ts |
| R29 | **25 处 dangerouslySetInnerHTML 渲染富文本**：JSON-LD 结构化数据 + Strapi 富文本直接注入，若富文本含恶意代码则 XSS（内容来自可信管理员，风险中等） | 中 | Grep frontend-next 25 处匹配 |
| R30 | **MeiliSearch 默认 development 模式 + 弱 master key**：`MEILI_ENV:-development` 且默认 key 为 `changeme_master_key_12345` | 中 | [docker-compose.yml:68-69](file:///home/tishensnoopy/project/superpowers-zh/docker-compose.yml) |
| R31 | **chat sessionId 仍用 Math.random()**：`chat.ts:37` 生成 sessionId 使用 `Math.random().toString(36)`，安全审计已标记为 IDOR 风险，仍可被枚举 | 中 | [chat.ts:37](file:///home/tishensnoopy/project/superpowers-zh/backend/src/api/chat/controllers/chat.ts) |
| R32 | **appointment 限流可被绕过**：仅 IP 限流（max 5/hour），无验证码/短信验证，攻击者可换 IP 继续刷 | 低 | [appointment.ts:74](file:///home/tishensnoopy/project/superpowers-zh/backend/src/api/appointment/controllers/appointment.ts) |

### 2A.2 运维盲区（5 项）

| # | 根因 | 严重度 | 证据 |
|---|------|--------|------|
| R33 | **无 Docker 日志轮转配置**：docker-compose.yml 所有服务无 `logging:` 段，json-file driver 无 max-size/max-file 限制，长期运行撑爆磁盘 | 高 | [docker-compose.yml](file:///home/tishensnoopy/project/superpowers-zh/docker-compose.yml) 全文无 logging 配置 |
| R34 | **无证书自动续期 cron**：central nginx 配置有 SSL（Let's Encrypt），但无 certbot renew cron 配置，证书 90 天后过期 | 中 | central/nginx/nginx.conf 有 ssl 配置，但无续期脚本/cron |
| R35 | **无监控/告警**：无 uptime 监控、无磁盘空间监控、无容器健康告警、无日志聚合，故障只能靠用户反馈 | 中 | 无 prometheus/grafana/uptime-kuma 等配置 |
| R36 | **frontend-next 用 next/font/google（Noto_Sans_SC + Nunito）**：构建时需访问 Google Fonts，国内服务器可能被墙导致构建失败或回退到系统字体 | 中 | [layout.tsx:2](file:///home/tishensnoopy/project/superpowers-zh/frontend-next/app/[locale]/layout.tsx) |
| R37 | **images.unoptimized = true**：所有图片未优化（无 WebP/AVIF 转换、无响应式 srcset），性能损失但避免了 Docker 容器内 localhost 访问问题 | 低 | [next.config.ts:15](file:///home/tishensnoopy/project/superpowers-zh/frontend-next/next.config.ts) |

### 2A.3 多租户硬编码（3 项）

| # | 根因 | 严重度 | 证据 |
|---|------|--------|------|
| R38 | **seed-yousen.js 硬编码「佑森小课堂」品牌数据**：学校名/校区/课程/教师/FAQ/新闻等全部写死，多客户部署需完全重写 seed 脚本 | 高 | [seed-yousen.js](file:///home/tishensnoopy/project/superpowers-zh/backend/scripts/seed-yousen.js) 全文 |
| R39 | **前端 fallback 文案硬编码「佑森小课堂」**：en-US.json 中 brandNameFallback/sloganFallback/aboutTextFallback 等全写死「Yousen Classroom/8 Years of...」，多客户部署需改翻译文件 | 中 | [en-US.json:28-39](file:///home/tishensnoopy/project/superpowers-zh/frontend-next/i18n/messages/en-US.json) |
| R40 | **cleanup-test-data.js 硬编码 admin@yousen.com、yousen-news-test- 前缀**：清理脚本与品牌耦合 | 低 | [cleanup-test-data.js:27,93](file:///home/tishensnoopy/project/superpowers-zh/backend/scripts/cleanup-test-data.js) |

### 2A.4 技术债务（4 项）

| # | 根因 | 严重度 | 证据 |
|---|------|--------|------|
| R41 | **frontend/（旧 Vite 前端）目录仍在 git 中**：包含完整 src/ + package.json + e2e 测试 + playwright 配置，未清理，每次 rsync 部署都会同步废弃代码 | 中 | `git ls-files | grep ^frontend/` 有 20+ 文件 |
| R42 | **shouye/（Figma 原型）目录仍在 git 中**：包含设计稿 React 代码 + shadcn/ui 组件库 + pnpm-workspace.yaml，与生产代码无关但占用空间且可能干扰包管理 | 中 | `git ls-files | grep ^shouye/` 有 50+ 文件 |
| R43 | **版本混乱**：frontend/package.json 用 React 18.3.1（Vite 旧前端），frontend-next 用 Next.js 15（React 19），shouye/ 也用 React 18.3.1，三套前端技术栈并存 | 低 | frontend/package.json vs frontend-next/package.json vs shouye/package.json |
| R44 | **shouye/ 有 pnpm-workspace.yaml**：可能干扰根目录包管理（项目用 npm，但 shouye 声明 pnpm workspace） | 低 | [shouye/pnpm-workspace.yaml](file:///home/tishensnoopy/project/superpowers-zh/shouye/pnpm-workspace.yaml) |

### 2A.5 AI 客服风险（已确认机制完整，无新根因）

- ✅ 防滥用机制已实现：引导模式（相似度<0.3 转人工）+ 10 轮阈值 + 500 字符限制
- ✅ systemPrompt 支持中英文分离（systemPrompt/systemPromptEn）
- ✅ RAG fallback 链完整：en-US 命中<2 时自动 fallback 到 zh-CN
- ✅ API key 从 ai-config 表读取，支持多 provider（qwen/openai/custom）
- ⚠️ 无 prompt injection 防护（用户输入未过滤「忽略之前指令」等攻击模式），但属行业难题，标记为已知风险

### 2A.6 数据一致性（已确认机制完整，无新根因）

- ✅ 知识库同步：lifecycle hooks（afterCreate/afterUpdate/afterDelete）+ BullMQ 队列 + 去重 + 删除清理
- ✅ i18n fallback：RAG 服务支持 en-US → zh-CN 自动 fallback
- ✅ locale 完整性：所有业务表 0 个 NULL locale（本地已验证）

---

## 3. 修复优先级（与数据库重置的关系）

### P0 —— 重置前必须解决（否则重置后问题原样重现）

| 根因 | 理由 |
|------|------|
| R1/R6 en-US 数据补建机制 | 重置会清空所有数据，en-US 必须能在重置后可靠重建 |
| R7 nginx /uploads 漂移 | 不解决则重置后媒体库依然 500 |
| R15 导航 seed 子项创建失败 | 重置后重跑 seed 会再次踩同一个坑 |
| R14 部署漂移防护 | R7 的同类问题预防措施 |
| R9 ICP 备案空值 | 重置填充数据时一并解决，成本最低 |
| R26 端口暴露公网 | 安全组配置核查，重置前必须确认 5432/6379/7700 不对外 |
| R27 弱密钥兜底 | 重置前核查服务器 .env 是否配置了强随机密钥 |
| R33 Docker 日志轮转 | 重置后长期运行必踩磁盘爆掉 |

### P1 —— 重置后、正式上线前解决

| 根因 | 理由 |
|------|------|
| R2 LanguageSwitcher bug | 影响双语核心体验 |
| R3 middleware 307 / ISR 失效 | 影响性能与 SEO |
| R4 Admin 语言配置 | 用户感知「后端中文不全」的主要来源 |
| R8 request.body 日志（13 处） | PIPL 合规 |
| R11 容器资源限制 | 服务器稳定性 |
| R19 权限分配 UI 缺失 | 用户明确提出的功能缺口 |
| R28 无 middlewares.ts（CORS/helmet） | 安全加固 |
| R30 MeiliSearch production 模式 | 安全加固 |
| R31 chat sessionId Math.random() | IDOR 风险 |
| R38 seed 脚本品牌解耦 | 多客户部署前提 |

### P2 —— 可排期处理

R5（v5 原生限制，需定制开发才能改）、R10、R12、R13、R16、R21、R22、R23、R24、R25、R29、R32、R34、R35、R36、R37、R39、R40、R41、R42

### P3 —— 信息项 / 不处理

R17（死代码，可删可留）、R18（dead code）、R20（需求缺口，待确认是否需要）、R43、R44

---

## 4. 关于「Content Type Builder 禁用」的事实核查

| 问题 | 结论 |
|------|------|
| 为什么服务器上禁用？ | **Strapi v5 设计如此**：production 模式（`NODE_ENV=production`）下 Content Type Builder 只读，schema 修改必须在 develop 模式进行后部署。这不是权限问题，超管也无法在 production admin 改 schema |
| 利 | 防止生产环境直接改 schema 导致数据库结构与代码不一致（本项目刚踩过：schema kind 非法 + i18n pluginOptions 缺失引发 Content Manager 崩溃） |
| 弊 | 客户管理员无法自助增减字段；任何 schema 变更都要走「本地 develop → 构建 → 部署」完整链路 |
| 超管改 schema 的实现难度 | 见下方方案对比（前次会话已提供 4 方案，推荐 Dynamic Zone 重构——把「可能变化的页面结构」放进 components，schema 稳定后不再需要改） |

**结论：禁用本身是正确的设计约束。** 真正要补的是 R19（权限分配 UI）和 R5 认知对齐（字段标签中文化需定制，且收益有限）。

---

## 5. 数据库重置 7 步执行顺序（建议）

1. **前置修复**：完成 P0 全部 5 项（en-US 补建机制验证、nginx /uploads、导航 seed 子项、漂移防护、ICP 数据）
2. **备份**：`pg_dump` 全量备份现有数据库（保留回滚能力）
3. **重置**：清空业务表，**保留** `admin_users` / `strapi_*` 系统表（保留超管账号）
4. **重建**：seed `--force` → 跑 `create-en-us-locales.js` → 上传媒体文件并重建关联
5. **权限重建**：rbac.ts 重跑，配置客户管理员角色
6. **验证**：18 页面 + Admin + 双语切换 + 表单提交 + 媒体库 + 导航二级菜单
7. **记录**：部署 commit SHA 记入文档

---

## 6. 待用户确认

| # | 问题 |
|---|------|
| 1 | 重置顺序：是否按 §5 的 7 步执行？P0 五项是否全部纳入前置？ |
| 2 | 超管改 schema 方案：接受「保持禁用 + Dynamic Zone 重构」方向，还是要求开发 admin 内 schema 编辑能力（工作量与风险显著更高）？ |
| 3 | R20 主题色/字体后台管理：是真实需求还是可砍掉？ |
| 4 | R17/R18 死代码（vector-config、feedback API）：删除还是保留？ |

---

## 附录 A：关键验证方法

```bash
# 前端翻译 key 对比（388/388 对齐，0 缺失）
node /tmp/i18n-diff.js

# console 统计（122 处）
grep -rc "console\." backend/src --include="*.ts" | awk -F: '{s+=$2} END {print s}'

# request.body 日志（13 处）
grep -rn "console\..*request\.body" backend/src

# i18n 插件实际存在（v5 核心捆绑，包名 @strapi/i18n）
ls backend/node_modules/@strapi/i18n
```

## 附录 B：根因索引

| 维度 | 根因编号 |
|------|---------|
| 用户提出的问题 | R1-R7 |
| 数据安全/合规 | R8-R10 |
| 基础设施 | R11-R14 |
| 功能缺陷 | R15-R21 |
| 可观测性 | R22-R23 |
| 前端运行时 | R24-R25 |
| 安全加固（第二轮） | R26-R32 |
| 运维盲区（第二轮） | R33-R37 |
| 多租户硬编码（第二轮） | R38-R40 |
| 技术债务（第二轮） | R41-R44 |

**共 44 个根因：P0 × 8 组，P1 × 10 组，P2 × 20 项，P3 × 6 项。**

---

## 修复状态追踪（2026-07-18 更新）

### P0 —— 全部 8 组已闭环 ✅

| 根因 | 修复内容 | 验证 |
|------|---------|------|
| R1/R6 en-US 补建机制 | 重写 [create-en-us-locales.js](../backend/scripts/create-en-us-locales.js)：populate 完整 zh-CN 文档 → 递归收集 dynamic zone/component 文本 → 分批调 DashScope 翻译 → 写回；支持 `--retranslate`/`--only`/`--dry-run` | dry-run 验证 homepage 20 字段正确收集，93 个已有 en-US 版本正确跳过，幂等 |
| R7 nginx /uploads 漂移 | 本地 [nginx.conf](../nginx/nginx.conf) 已含 `/uploads/` location（第 80-89 行）；服务器同步列入重置流程第 6 步 | R14 漂移防护兜底 |
| R15 导航 seed 子项创建失败 | 4 处 schema 关系修正为 manyToOne（navigation/page/product-category/faq-item）+ **重新 build 使 dist 生效** | [verify-relations.js](../backend/scripts/verify-relations.js) 实测：1 父 2 子并存，子项 parent 保留，PASS |
| R14 部署漂移防护 | [deploy.sh](../deploy.sh) nginx 启动后自动 `nginx -T` 校验 4 个关键 location（/api/ /admin /uploads/ /_health），缺失即退出部署 | bash -n 语法通过 |
| R9 ICP 备案空值 | 用户决定暂时留空，部署后再填（seed SITE_SETTINGS.icp 保留空字符串） | — |
| R26 端口暴露公网 | docker-compose postgres/redis/meilisearch 端口绑定改为 `127.0.0.1:` | 本地 3 容器 recreate 后 `docker ps` 确认全部 127.0.0.1 |
| R27 弱密钥兜底 | 用户决定跳过服务器核查 | — |
| R33 Docker 日志轮转 | docker-compose 全部 5 服务加 `logging: json-file max-size=10m max-file=3` | `docker compose config` 校验通过 |

### P1 —— 8/10 组已闭环 ✅

| 根因 | 修复内容 | 验证 |
|------|---------|------|
| R2 LanguageSwitcher bug | 重写为 `router.replace(pathname, { locale })`（[LanguageSwitcher.tsx](../frontend-next/components/layout/LanguageSwitcher.tsx)），不再手拼 URL | 6 个单测全过 |
| R3 middleware 307 / ISR 失效 | **架构调整**：`localeCookie: false` + `localeDetection: false`（[routing.ts](../frontend-next/i18n/routing.ts)），locale 纯靠 URL 前缀；新建 [i18n/navigation.ts](../frontend-next/i18n/navigation.ts) 导出本地化 Link/useRouter/usePathname，替换 17 文件 Link + 3 文件 useRouter | 前端全量 430 测试通过；`npm run build` 所有页面恢复 SSG/Static（●/○） |
| R4 Admin 语言配置 | 新建 [set-admin-locale.js](../backend/scripts/set-admin-locale.js)，一键把所有 admin 用户 `prefered_language` 设为 zh-Hans；列入重置流程 | 本地实测：1 个 admin 用户已设置 |
| R8 request.body 日志 | 删除 7 个 controller 共 13 处 `JSON.stringify(ctx.request.body)` 日志 | grep 验证 0 残留 |
| R11 容器资源限制 | docker-compose 全部服务加 `deploy.resources.limits/reservations`（backend 1G、frontend/postgres/meilisearch 512M、redis 128M）+ backend `NODE_OPTIONS=--max-old-space-size=768` | `docker compose config` + `yaml.safe_load` 双校验通过 |
| R28 无 middlewares.ts | 新建 [config/middlewares.ts](../backend/config/middlewares.ts)：CORS 白名单（`CORS_ORIGINS` env，空则拒绝所有跨域浏览器请求；@koa/cors 不支持数组故用函数形式）+ CSP 收紧 + 保留完整默认中间件栈；`.env.example` 增加说明；docker-compose backend 传入 `CORS_ORIGINS` | backend build 通过 + Strapi 生产模式启动成功 |
| R30 MeiliSearch production | `MEILI_ENV: ${MEILI_ENV:-production}`（此前已完成） | — |
| R31 sessionId Math.random() | [chat.ts](../backend/src/api/chat/controllers/chat.ts) `randomId` 改用 `crypto.randomUUID()` | backend build 通过 |
| R19 权限分配 UI | **未做**（大功能，需需求确认后单独立项） | — |
| R38 seed 品牌解耦 | **未做**（多客户部署前提，建议作为独立子项目） | — |

### 附带修复（排查中发现的关联问题）

- 本地 backend/.env `REDIS_HOST/REDIS_PASSWORD` 空值导致 BullMQ NOAUTH 报错 → 已填 `127.0.0.1`/`changeme`（与根 .env 对齐），queue 连接恢复正常
- frontend-next vitest 无法解析 next-intl ESM 的 `next/navigation` → `__tests__/setup.ts` 增加 `@/i18n/navigation` 工厂 mock

### 重置前仍需人工执行的事项

1. **R7**：rsync 同步 `nginx/nginx.conf` 到服务器并 `docker compose restart nginx`（deploy.sh --nginx 模式现在会自动校验）
2. **R26**：服务器安全组确认 5432/6379/7700 不对外开放（compose 层已绑定回环，安全组是第二道防线）
3. 数据库重置 7 步流程中执行：`set-admin-locale.js`（第 4 步后）+ `create-en-us-locales.js`（seed 后）
