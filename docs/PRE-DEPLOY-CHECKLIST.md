# 部署前检查清单（本地 → 服务器同步）

> **生成时间：** 2026-07-17
> **适用场景：** 客户业务系统（yousen）从本地环境同步到生产服务器（124.223.1.67）前的逐项验证
> **关联文档：** [PRODUCT-READINESS-REPORT.md](./PRODUCT-READINESS-REPORT.md) · [DEPLOY-RUNBOOK.md](./DEPLOY-RUNBOOK.md) · [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md)

---

## 0. 使用说明

本清单按"本地验证 → 同步 → 服务器验证"三阶段组织。每一项必须打勾后才能进入下一阶段。

- **本地阶段（§1-§7）** 在本地宿主机执行，目标是证明"本地跑通即上线"
- **同步阶段（§8）** 通过 rsync 将本地代码同步到服务器，跳过 GitHub 依赖
- **服务器阶段（§9-§11）** 在服务器上重建镜像、执行 seed、端到端验证

> **核心原则：** 本地环境 = 生产环境（PostgreSQL + Docker services + production 模式）。任何"本地能跑、服务器不能跑"的差异都必须在本清单中暴露并修复。

---

## 1. 本地代码完整性

### 1.1 待同步 commits（必须全部已提交）

| Commit | 说明 | 状态 |
|--------|------|------|
| `11ca549` | fix(seed): 补全 privacy-policy 和 user-agreement 页面 seed 数据 | ☐ 已提交 |
| `d1fa4cc` | fix(seed): 修复 seed 脚本本地执行 + locale 容错（distDir 参数） | ☐ 已提交 |
| `bee8af3` | fix(schema): 给 11 个业务 content type 启用 i18n localized | ☐ 已提交 |
| `9ebab08` | feat(seed): 批量创建 en-US 本地化数据脚本 | ☐ 已提交 |

**验证命令：**
```bash
cd /home/tishensnoopy/project/superpowers-zh
git log --oneline -4
# 应看到上述 4 个 commit
```

### 1.2 未提交改动处理

- [ ] `docs/superpowers/plans/` 下 3 个 plan 文档（deploy-exec.md / deploy-prep.md / product-readiness-audit.md）有未提交改动 → 决定 commit 或 stash
  ```bash
  git status --short
  # 预期：仅 docs/superpowers/plans/ 下 3 个文件为 M 状态
  ```
- [ ] 工作区无其他未跟踪的业务代码文件
- [ ] `patches/` 目录不存在（确认已清理无效补丁）
- [ ] `package.json` 中无 `patch-package` 依赖、无 `postinstall` 脚本（确认已清理）

### 1.3 服务器未同步的修复（本次同步目标）

| 修复项 | 涉及文件 | 关联 commit |
|--------|---------|------------|
| schema kind 字段（15 个 collectionType） | `backend/src/api/*/content-types/*/schema.json` | `3c1abc6` |
| zh-CN.json 4 个翻译 bug | `backend/src/plugins/i18n/locales/zh-CN.json` | `8c58dcd` |
| seed 脚本补全（privacy-policy + user-agreement） | `backend/scripts/seed-yousen.js` | `11ca549` |
| seed 脚本本地执行修复（distDir + locale 容错） | `backend/scripts/seed-yousen.js` | `d1fa4cc` |
| 11 个 content type 启用 i18n localized | `backend/src/api/*/content-types/*/schema.json` | `bee8af3` |
| en-US 本地化数据创建脚本 | `backend/scripts/create-en-us-locales.js` | `9ebab08` |

---

## 2. 本地环境对齐

> **目标：** 本地环境与生产服务器配置一致，避免环境差异掩盖问题。

### 2.1 Docker 服务

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

- [ ] `yousen-postgres` 运行中（healthy），端口 5432
- [ ] Redis 运行中（healthy），端口 6379（如启用）
- [ ] MeiliSearch 运行中（healthy），端口 7700（如启用）

### 2.2 PostgreSQL 配置

- [ ] `backend/.env` 中 `DATABASE_CLIENT=postgres`（非 sqlite）
- [ ] `DATABASE_HOST=127.0.0.1`
- [ ] `DATABASE_PORT=5432`
- [ ] `DATABASE_NAME=strapi`
- [ ] `DATABASE_USERNAME=strapi`（非 postgres 超级用户）
- [ ] 数据库用户 `strapi` 对 `strapi` 数据库有完整权限

**验证命令：**
```bash
docker exec yousen-postgres psql -U strapi -d strapi -c "SELECT current_user, current_database();"
# 预期输出：strapi | strapi
```

### 2.3 Strapi 配置

- [ ] `backend/config/plugins.ts` 中 i18n 配置：
  - `defaultLocale: 'zh-CN'`
  - `locales: ['zh-CN', 'en-US']`
- [ ] `backend/config/database.ts` 使用 PostgreSQL client

### 2.4 后端运行模式

- [ ] 本地 backend 以 `NODE_ENV=production` 模式运行（模拟生产环境）
  ```bash
  cd backend && NODE_ENV=production npm start
  ```
- [ ] 端口 1337 可访问：`curl -s -o /dev/null -w "%{http_code}" http://localhost:1337/api/pages/homepage` 返回 200

---

## 3. Schema 完整性

> **目标：** 所有 content type 的 schema.json 字段合法，与数据库表结构一致。

### 3.1 kind 字段合法性

- [ ] 所有 schema.json 的 `kind` 字段值为 `collectionType` 或 `singleType`（Strapi v5 合法值）
- [ ] **无 `contentType` 非法值**（这是下午 Content Manager 崩溃的根因之一）

**验证命令：**
```bash
cd backend
grep -r '"kind"' src/api/*/content-types/*/schema.json | grep -v 'collectionType\|singleType'
# 预期：无输出（所有 kind 字段都合法）
```

### 3.2 i18n pluginOptions

- [ ] 11 个业务 content type 的 schema.json 都有 `pluginOptions.i18n.localized: true`：
  - page, product, product-category, campus, teacher, news-article
  - faq-item, navigation, footer, site-settings, knowledge-base
- [ ] 7 个不启用 i18n 的 content type 的 pluginOptions 为空或不包含 i18n：
  - ai-config, appointment, chat-message, chat-session, feedback, product-spec, vector-config

**验证命令：**
```bash
cd backend
for uid in page product product-category campus teacher news-article faq-item navigation footer site-settings knowledge-base; do
  file=$(find src/api -path "*/$uid/schema.json" 2>/dev/null | head -1)
  [ -z "$file" ] && continue
  result=$(grep -A2 '"i18n"' "$file" 2>/dev/null | grep localized)
  echo "$uid: ${result:-缺失}"
done
# 预期：每个都显示 "localized": true
```

---

## 4. Seed 脚本可重复执行

> **目标：** 证明 seed 脚本可以幂等执行，这是"改数据就能部署"的关键证明。

### 4.1 脚本存在性

- [ ] `backend/scripts/seed-yousen.js` 存在
- [ ] `backend/scripts/create-en-us-locales.js` 存在
- [ ] `backend/dist/` 目录存在（已执行 `npm run build` 生成编译后配置）

### 4.2 本地宿主机执行验证

```bash
cd backend

# 1. 清空 pages 表（测试 seed 可重建）
docker exec yousen-postgres psql -U strapi -d strapi -c "TRUNCATE pages, pages_cmps RESTART IDENTITY CASCADE;"

# 2. 执行 seed（仅 pages 模块，force 模式）
node scripts/seed-yousen.js --only=pages --force

# 3. 验证数据
docker exec yousen-postgres psql -U strapi -d strapi -c "SELECT slug, locale FROM pages ORDER BY slug;"
```

- [ ] seed 脚本无报错退出（exit code 0）
- [ ] pages 表有 5 条业务页面记录（about, contact, refund-policy, privacy-policy, user-agreement）
- [ ] 所有记录 `locale='zh-CN'`（非 NULL）

### 4.3 全量 seed 验证（推荐但非必须）

```bash
cd backend
# 危险：会清空并重建所有业务数据，仅在首次部署或数据重置时执行
node scripts/seed-yousen.js --force
```

- [ ] 全量 seed 无报错退出
- [ ] 所有业务表都有 zh-CN 数据

---

## 5. 双语数据完整性

> **目标：** 所有业务 content type 都有 zh-CN + en-US 双语数据，无 NULL locale 记录。

### 5.1 locale 分布检查

```bash
docker exec yousen-postgres psql -U strapi -d strapi -c "
SELECT 'pages' AS tbl, locale, COUNT(*) FROM pages GROUP BY locale
UNION ALL SELECT 'products', locale, COUNT(*) FROM products GROUP BY locale
UNION ALL SELECT 'campuses', locale, COUNT(*) FROM campuses GROUP BY locale
UNION ALL SELECT 'teachers', locale, COUNT(*) FROM teachers GROUP BY locale
UNION ALL SELECT 'news_articles', locale, COUNT(*) FROM news_articles GROUP BY locale
UNION ALL SELECT 'faq_items', locale, COUNT(*) FROM faq_items GROUP BY locale
UNION ALL SELECT 'navigations', locale, COUNT(*) FROM navigations GROUP BY locale
UNION ALL SELECT 'footers', locale, COUNT(*) FROM footers GROUP BY locale
UNION ALL SELECT 'site_settings', locale, COUNT(*) FROM site_settings GROUP BY locale
ORDER BY tbl, locale;
"
```

- [ ] 所有业务表都有 `zh-CN` 记录
- [ ] 所有业务表都有 `en-US` 记录
- [ ] **无 `locale IS NULL` 记录**（这是下午 Content Manager 崩溃的根因之一）

### 5.2 i18n 默认 locale 配置

```bash
docker exec yousen-postgres psql -U strapi -d strapi -c "
SELECT * FROM strapi_core_store_settings WHERE key LIKE '%i18n%';
"
```

- [ ] `plugin_i18n_default_locale` 的 `value` 为 `"zh-CN"`（非 `"en"`）
- [ ] `i18n_locale` 表中有 `zh-CN` 和 `en-US` 两条记录（无 `en` 旧记录）

### 5.3 前端双语验证

- [ ] `curl http://localhost:3000/zh-CN` 返回 200（中文首页）
- [ ] `curl http://localhost:3000/en-US` 返回 200（英文首页）
- [ ] `curl http://localhost:1337/api/pages/homepage?locale=zh-CN` 返回 200
- [ ] `curl http://localhost:1337/api/pages/homepage?locale=en-US` 返回 200（或 fallback 到 zh-CN）
- [ ] `curl http://localhost:1337/api/site-settings?locale=en-US` 返回 200 且有数据（非 null）

---

## 6. SEO/GEO 要素

> **目标：** 前端 SEO 标签、结构化数据、AI 搜索优化文件全部就位。

### 6.1 基础文件

- [ ] `frontend-next/public/sitemap.xml` 可访问（`curl http://localhost:3000/sitemap.xml` 返回 200，含 hreflang alternates）
- [ ] `frontend-next/public/robots.txt` 可访问（Allow: /, Disallow: /api/ /admin/, Sitemap 指向）
- [ ] `frontend-next/app/[locale]/llms.txt/route.ts` 可访问（`curl http://localhost:3000/llms.txt` 返回 200，含机构简介）

### 6.2 meta 标签

```bash
curl -s http://localhost:3000/zh-CN | python3 -c "
import sys, re
html = sys.stdin.read()
for tag in re.findall(r'<meta[^>]+>', html):
    if any(k in tag for k in ['description', 'robots', 'og:', 'twitter:']):
        print(tag[:120])
"
```

- [ ] 至少 11 个 SEO meta 标签（description, robots, og:title/description/type, twitter:card/title/description 等）

### 6.3 hreflang

- [ ] 中文页面有 `<link rel="alternate" hreflang="zh-CN" ...>` 和 `hreflang="en-US" ...`
- [ ] 英文页面有对应 alternate links
- [ ] canonical URL 正确指向当前 locale 版本

### 6.4 JSON-LD 结构化数据

```bash
python3 << 'EOF'
import urllib.request, re
for name, url in [('homepage', 'http://localhost:3000/zh-CN'), ('courses', 'http://localhost:3000/zh-CN/courses')]:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')
    blocks = re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL)
    print(f'{name}: {len(blocks)} blocks')
EOF
```

- [ ] 首页有 2 个 JSON-LD blocks（WebSite + EducationalOrganization，由 layout.tsx 渲染）
- [ ] 其他页面有 3 个 JSON-LD blocks（WebSite + EducationalOrganization + BreadcrumbList）
- [ ] JSON-LD 中 `@context` 为 `https://schema.org`，`@type` 合法

---

## 7. 前端构建与端到端验证

### 7.1 前端构建

- [ ] `frontend-next/.env` 中 `NEXT_PUBLIC_STRAPI_API_URL` 指向生产域名（如 `https://yousen.tishensnoopy.cloud/strapi`）
- [ ] `NEXT_PUBLIC_SITE_URL` 指向生产域名（如 `https://yousen.tishensnoopy.cloud`）
- [ ] 执行 `cd frontend-next && npm run build` 构建通过（SSG 预渲染成功）

### 7.2 本地端到端

- [ ] `curl http://localhost:3000/zh-CN` 返回 200
- [ ] `curl http://localhost:3000/zh-CN/courses` 返回 200
- [ ] `curl http://localhost:3000/zh-CN/campuses` 返回 200
- [ ] `curl http://localhost:3000/zh-CN/teachers` 返回 200
- [ ] `curl http://localhost:3000/zh-CN/news` 返回 200
- [ ] `curl http://localhost:3000/zh-CN/faq` 返回 200
- [ ] `curl http://localhost:3000/zh-CN/privacy-policy` 返回 200
- [ ] `curl http://localhost:3000/zh-CN/user-agreement` 返回 200
- [ ] `curl http://localhost:3000/zh-CN/appointment` 返回 200
- [ ] `curl http://localhost:3000/zh-CN/contact` 返回 200
- [ ] `curl http://localhost:3000/zh-CN/about` 返回 200

---

## 8. 同步到服务器

> **同步方式：** rsync（避免依赖客户服务器连接 GitHub）

### 8.1 同步前准备

- [ ] 服务器 SSH 可达：`ssh root@124.223.1.67 echo ok`
- [ ] 服务器目标目录存在：`ssh root@124.223.1.67 ls /opt/customer-site/`
- [ ] 服务器 Docker 服务正常运行

### 8.2 rsync 同步命令

```bash
cd /home/tishensnoopy/project/superpowers-zh

rsync -avz --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='dist/' \
  --exclude='.next/' \
  --exclude='coverage/' \
  --exclude='*.log' \
  --exclude='playwright-report/' \
  --exclude='test-results/' \
  -e ssh \
  ./ root@124.223.1.67:/opt/customer-site/
```

**关键排除规则：**
- `.git/` — 不同步 git 历史
- `node_modules/` — 服务器重新安装依赖
- `.env` / `.env.local` — 服务器有自己的环境变量
- `dist/` — 服务器重新构建
- `.next/` — 服务器重新构建

- [ ] rsync 执行成功，无错误
- [ ] rsync 输出中包含修改的关键文件：
  - `backend/src/api/*/content-types/*/schema.json`
  - `backend/scripts/seed-yousen.js`
  - `backend/scripts/create-en-us-locales.js`
  - `backend/src/plugins/i18n/locales/zh-CN.json`

### 8.3 服务器环境变量检查

```bash
ssh root@124.223.1.67 'cat /opt/customer-site/.env | grep -E "DATABASE_|DASHSCOPE_|NEXT_PUBLIC_"'
```

- [ ] `DATABASE_CLIENT=postgres`
- [ ] `DATABASE_PASSWORD` 已设置（与服务器 PostgreSQL 一致）
- [ ] `DASHSCOPE_API_KEY` 已设置（百炼工作空间 API key）
- [ ] `NEXT_PUBLIC_STRAPI_API_URL` 指向生产域名
- [ ] `NEXT_PUBLIC_SITE_URL` 指向生产域名

---

## 9. 服务器重建镜像

```bash
ssh root@124.223.1.67 << 'EOF'
cd /opt/customer-site
# 重建 backend 镜像（包含 schema 和 seed 脚本修改）
docker compose build backend
# 重建 frontend 镜像（包含 NEXT_PUBLIC_* 变量）
docker compose build frontend
# 重启服务
docker compose up -d backend frontend
# 等待健康检查通过
sleep 30
docker compose ps
EOF
```

- [ ] backend 镜像构建成功
- [ ] frontend 镜像构建成功
- [ ] 所有容器状态为 `healthy` 或 `running`

---

## 10. 服务器数据库修复

> **目标：** 在服务器 PostgreSQL 上执行与本地相同的数据库修复（schema 不一致 + i18n locale 修复）。

### 10.1 i18n locale 表修复

```bash
ssh root@124.223.1.67 << 'EOF'
docker exec yousen-postgres psql -U strapi -d strapi << 'SQL'
-- 1. 修复 i18n_locale 表（移除旧的 'en' 记录，确保有 zh-CN 和 en-US）
DELETE FROM i18n_locale WHERE code = 'en';
INSERT INTO i18n_locale (code, name) VALUES ('zh-CN', '中文 (简体)') ON CONFLICT (code) DO NOTHING;
INSERT INTO i18n_locale (code, name) VALUES ('en-US', 'English (US)') ON CONFLICT (code) DO NOTHING;

-- 2. 修复默认 locale
UPDATE strapi_core_store_settings
SET value = '"zh-CN"'
WHERE key = 'plugin_i18n_default_locale';

-- 3. 修复业务表 locale=NULL 记录
UPDATE pages SET locale = 'zh-CN' WHERE locale IS NULL;
UPDATE products SET locale = 'zh-CN' WHERE locale IS NULL;
UPDATE product_categories SET locale = 'zh-CN' WHERE locale IS NULL;
UPDATE campuses SET locale = 'zh-CN' WHERE locale IS NULL;
UPDATE teachers SET locale = 'zh-CN' WHERE locale IS NULL;
UPDATE news_articles SET locale = 'zh-CN' WHERE locale IS NULL;
UPDATE faq_items SET locale = 'zh-CN' WHERE locale IS NULL;
UPDATE navigations SET locale = 'zh-CN' WHERE locale IS NULL;
UPDATE footers SET locale = 'zh-CN' WHERE locale IS NULL;
UPDATE site_settings SET locale = 'zh-CN' WHERE locale IS NULL;
UPDATE knowledge_bases SET locale = 'zh-CN' WHERE locale IS NULL;

SELECT 'i18n_locale records:' AS info;
SELECT code FROM i18n_locale ORDER BY code;
SELECT 'NULL locale count:' AS info;
SELECT 'pages', COUNT(*) FROM pages WHERE locale IS NULL
UNION ALL SELECT 'products', COUNT(*) FROM products WHERE locale IS NULL;
SQL
EOF
```

- [ ] SQL 执行成功
- [ ] `i18n_locale` 表有 `zh-CN` 和 `en-US` 两条记录
- [ ] 所有业务表 `locale IS NULL` 记录数为 0

### 10.2 重启 backend 加载新 schema

```bash
ssh root@124.223.1.67 'cd /opt/customer-site && docker compose restart backend && sleep 15'
```

- [ ] backend 重启成功
- [ ] `curl http://124.223.1.67:1337/api/pages/homepage?locale=zh-CN` 返回 200

### 10.3 服务器 seed 执行（如需重建数据）

```bash
ssh root@124.223.1.67 << 'EOF'
cd /opt/customer-site
# 在容器内执行 seed 脚本（--force 覆盖现有数据）
docker compose exec backend node scripts/seed-yousen.js --force
EOF
```

- [ ] seed 脚本执行成功（exit code 0）
- [ ] 无 `locale` 相关错误

### 10.4 创建 en-US 本地化数据

```bash
ssh root@124.223.1.67 'cd /opt/customer-site && docker compose exec backend node scripts/create-en-us-locales.js'
```

- [ ] 脚本执行成功
- [ ] 服务器所有业务表都有 en-US 数据

---

## 11. 服务器端到端验证

### 11.1 HTTP 直连验证

```bash
# HTTP 直连（验证 backend 可达）
curl -s -o /dev/null -w "zh-CN homepage: %{http_code}\n" http://124.223.1.67:1337/api/pages/homepage?locale=zh-CN
curl -s -o /dev/null -w "en-US homepage: %{http_code}\n" http://124.223.1.67:1337/api/pages/homepage?locale=en-US
curl -s -o /dev/null -w "en-US site-settings: %{http_code}\n" http://124.223.1.67:1337/api/site-settings?locale=en-US
```

- [ ] zh-CN homepage 返回 200
- [ ] en-US homepage 返回 200（或 fallback 到 zh-CN）
- [ ] en-US site-settings 返回 200 且有数据

### 11.2 Strapi Admin 验证

- [ ] 访问 `http://124.223.1.67:1337/admin` 可登录
- [ ] **Content Manager 不再报 "Cannot read properties of undefined (reading 'push')" 错误**
- [ ] Content Manager 可正常浏览所有 content type
- [ ] Page 列表显示 5 条业务页面（about, contact, refund-policy, privacy-policy, user-agreement）

### 11.3 HTTPS 域名验证

```bash
curl -s -o /dev/null -w "HTTPS zh-CN: %{http_code}\n" https://yousen.tishensnoopy.cloud/zh-CN
curl -s -o /dev/null -w "HTTPS en-US: %{http_code}\n" https://yousen.tishensnoopy.cloud/en-US
curl -s -o /dev/null -w "HTTPS courses: %{http_code}\n" https://yousen.tishensnoopy.cloud/zh-CN/courses
curl -s -o /dev/null -w "HTTPS Strapi Admin: %{http_code}\n" https://yousen.tishensnoopy.cloud/strapi/admin
```

- [ ] HTTPS zh-CN 首页返回 200
- [ ] HTTPS en-US 首页返回 200
- [ ] HTTPS courses 页面返回 200
- [ ] HTTPS Strapi Admin 可访问（不白屏）

### 11.4 AI Chat 验证

- [ ] 访问 `https://yousen.tishensnoopy.cloud/zh-CN`，点击浮动咨询按钮
- [ ] AI 对话正常响应（非 500 错误）
- [ ] 对话有实质内容回复（非"服务不可用"）

### 11.5 部署 commit SHA 记录

```bash
ssh root@124.223.1.67 'cd /opt/customer-site && git rev-parse HEAD > .deployed-commit && cat .deployed-commit'
```

- [ ] `.deployed-commit` 文件已创建并包含当前 commit SHA

---

## 12. 回滚预案

如果任何验证项失败，按以下顺序回滚：

### 12.1 停止所有客户业务容器

```bash
ssh root@124.223.1.67 'cd /opt/customer-site && docker compose down'
```

### 12.2 回滚到上一个稳定 commit

```bash
ssh root@124.223.1.67 << 'EOF'
cd /opt/customer-site
# 查看上一个稳定 commit（c-complete tag 或更早）
git log --oneline -20
# 回滚到指定 commit
git reset --hard <stable-commit-sha>
# 重建镜像
docker compose build backend frontend
docker compose up -d
EOF
```

### 12.3 数据库回滚

```bash
# 如有数据库备份，恢复备份
ssh root@124.223.1.67 'cd /opt/customer-site && docker exec yousen-postgres pg_restore -U strapi -d strapi -c /backups/pre-deploy.sql'
```

---

## 13. 完成签字

| 阶段 | 检查人 | 日期 | 状态 |
|------|--------|------|------|
| §1 本地代码完整性 | | | ☐ |
| §2 本地环境对齐 | | | ☐ |
| §3 Schema 完整性 | | | ☐ |
| §4 Seed 可重复执行 | | | ☐ |
| §5 双语数据完整性 | | | ☐ |
| §6 SEO/GEO 要素 | | | ☐ |
| §7 前端构建与端到端 | | | ☐ |
| §8 同步到服务器 | | | ☐ |
| §9 服务器重建镜像 | | | ☐ |
| §10 服务器数据库修复 | | | ☐ |
| §11 服务器端到端验证 | | | ☐ |
| **正式部署完成** | | | ☐ |
