# 部署前全局审查、功能补全、严格测试、客户业务部署与三端同步设计

- **项目**：佑森小课堂（Yousen Education）多租户官网系统
- **日期**：2026-07-16
- **状态**：待用户审查
- **前置条件**：Central 管理后台已部署并运行（central.tishensnoopy.cloud，commit 9928c89）

---

## 1. 背景与目标

### 1.1 背景

当前项目已完成多个里程碑：v5-migration、nextjs-skeleton、nextjs-content、子项目5（i18n+SEO+GEO+微信）、A 块（多租户）、C 块（客户部署）、Central 部署。Central 管理后台运行在 124.223.1.67，但客户业务系统尚未部署。

服务器实际状态（已 SSH 验证）：
- central-app 容器 healthy
- central-postgres 容器 healthy
- **central-nginx 容器 unhealthy**（healthcheck 误报，实际服务正常）
- **客户业务系统未部署**（/opt/customer-site 不存在）
- **Central cron 自动备份未配置**
- **服务器无 swap**（内存 3.6G，同时跑 Central + 客户业务会紧张）

本地代码状态：
- 与 GitHub origin/main 同步（commit 9928c89）
- 有未提交的本地修改：admins 用户管理功能（前后端）、layout 导航、spec 格式、.npmrc

### 1.2 目标

完成"部署前质量保障 + 部署 + 同步"完整闭环：
1. 修复服务器现状问题（nginx healthcheck、cron 备份、swap）
2. 全局审查 8 维度（业务/功能/前后端/部署/技术栈/依赖/版本），补全缺失功能
3. 严格测试套件全绿（单元 + E2E + 构建 + Lint）
4. 部署客户业务系统到服务器（Central + 客户业务同机）
5. 三端同步（GitHub/本地/服务器/记忆/文档）

---

## 2. 总体架构

5 个子项目按依赖顺序串行执行：

```
P1 服务器现状修复  →  P2 全局审查与功能补全  →  P3 严格测试  →  P4 客户业务部署  →  P5 三端同步与文档
```

**执行原则**：
- 每一步都基于实际验证（运行测试/SSH 命令/读取真实状态），不仅读代码
- 所有改动先在本地 → 测试通过 → commit → 部署到服务器
- 部署前必须有"绿牌"：所有测试通过 + lint 通过 + 构建通过

---

## 3. P1：服务器现状诊断与修复

### 3.1 修复 central-nginx unhealthy

**根因**（已验证）：[central/docker-compose.nginx.yml](file:///home/tishensnoopy/project/superpowers-zh/central/docker-compose.nginx.yml) 的 healthcheck 用 `wget --spider -q http://localhost:80/`，而 [nginx.conf](file:///home/tishensnoopy/project/superpowers-zh/central/nginx/nginx.conf) 把 80 端口所有请求 `return 301` 重定向到 HTTPS。wget `--spider` 模式收到 301 视为失败。

**修复方案**：在 nginx.conf 的 80 server 块中添加 `/healthz` 路径返回 200，healthcheck 改为检测 `/healthz`。

```nginx
# nginx.conf 的 80 server 块
location = /healthz {
    access_log off;
    return 200 'ok';
    add_header Content-Type text/plain;
}
location / {
    return 301 https://$host$request_uri;
}
```

```yaml
# docker-compose.nginx.yml
healthcheck:
  test: ["CMD", "wget", "--spider", "-q", "http://localhost/healthz"]
```

**验证**：`sudo docker ps` 显示 central-nginx healthy。

### 3.2 配置 Central 自动备份 cron

**现状**：`central/.env` 设置了 `BACKUP_RETENTION_DAYS=7`，[scripts/backup.sh](file:///home/tishensnoopy/project/superpowers-zh/central/scripts/backup.sh) 存在，但服务器 `sudo crontab -l` 无备份任务。

**修复**：在服务器 root crontab 配置：
```bash
0 3 * * * /opt/central/central/scripts/backup.sh >> /var/log/central-backup.log 2>&1
```

**验证**：手动执行 `backup.sh`，确认 `/opt/central/central/backups/` 下生成 `*.sql.gz` 和 `*.tar.gz`。

### 3.3 创建 swap（缓解内存紧张）

**现状**：服务器 3.6G 内存，Swap=0。Central 占 ~600MB，客户业务预期占 1-1.5G，构建期峰值更高。

**修复**：创建 2G swap：
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 3.4 验证 Central 健康

- `sudo docker ps` → central-nginx 显示 healthy
- `curl -skI https://central.tishensnoopy.cloud/login` → 200
- Central 后台可登录（账号 tishensnoopy@petalmail.com）

---

## 4. P2：全局审查与功能补全

### 4.1 审查方法学

| 方法 | 工具/命令 | 覆盖维度 |
|---|---|---|
| 静态读码 | Read/Grep/Glob + search 子代理 | 业务、功能、前后端代码 |
| 动态运行 | SSH 执行 docker/curl、本地 npm test | 部署、测试、运行时 |
| 工具扫描 | `npm audit` / `npm outdated` / `docker scout` | 依赖漏洞、版本 |
| 配置检查 | 比对 `.env.example` 与代码引用 | 配置完整性 |

每个维度都要产出"实际发现的问题清单"。

### 4.2 八维度审查清单

#### 维度 1：业务完整性
对照 `project_memory.md` 中的硬约束，逐项验证：
- 访客对提交类数据仅 create 权限
- 客户管理员不可删除提交数据，仅能更新状态
- AI 配置动态加载 + 5min 缓存 + env 降级
- AI 客服防滥用（500 字符 + 10 轮 + 相似度 0.3 转人工）
- 5 个 Chat API public（`auth: false`）
- lifecycle hooks（course/news/teacher/campus/faq-item）
- Next.js ISR/SSG（revalidate=300 页面，3600 sitemap/llms.txt）
- 备份策略（P1 修复 cron）
- Sentry client+server（触发错误验证上报）

#### 维度 2：功能完整性
- 后端 API 模块清单（grep `routes/*.ts`）
- 前端页面路由清单（`app/[locale]/*`）
- Central 后台模块清单
- E2E 测试覆盖场景清单

#### 维度 3：前端最佳实践
- Server vs Client Components 边界（`'use client'` 标记）
- `useSearchParams` Suspense 包裹
- `<Link>` vs `<a>` 检查
- `next/image` remotePatterns 配置
- `error.tsx` / `global-error.tsx` 实现
- `loading.tsx` 覆盖度

#### 维度 4：后端 Strapi v5 规范
- Document Service API 用法（`status: 'published'` 顶层参数）
- upload service 路径
- lifecycle hooks 注册方式
- RBAC policies 实现完整性
- 队列 worker 注册到 workers 字典

#### 维度 5：部署配置
- Dockerfile 健康检查、`npm config set registry`
- docker-compose.yml `build.network: host`
- SSR/客户端 API URL 区分
- nginx.conf 完整性（HTTP/HTTPS/WebSocket/HSTS）
- `.env.example` 完整性

#### 维度 6：技术栈版本
- Node.js >=20
- Strapi v5
- Next.js 14/15
- PostgreSQL 16 + pgvector
- Redis 7
- Meilisearch v1.12
- Docker 24+

#### 维度 7：依赖漏洞
```bash
cd backend && npm audit --omit=dev
cd frontend-next && npm audit --omit=dev
cd central && npm audit --omit=dev
cd agent && npm audit --omit=dev
```
**所有 high/medium/low 漏洞都要修复**（用户要求）。

#### 维度 8：版本号一致性
- 根 `package.json` version=1.6.0
- 各 plugin.json 版本同步
- RELEASE-NOTES 与实际功能对应
- Docker 镜像 tag

### 4.3 业务功能补全清单（已与用户确认）

**架构决策**：客户管理员继续使用 Strapi Admin（/admin）管理业务，不开发独立后台。

#### 高优先级（本次必须完成）

| # | 功能 | 现状 | 方案 |
|---|---|---|---|
| 1 | **admins 用户管理扩展** | 本地已有基础 CRUD | 补：角色权限编辑、密码重置、锁定/解锁 |
| 2 | **预约管理 API 开放** | 仅 `create` public | 补：`find`/`findOne` 给 client-admin，加 RBAC policy |
| 3 | **反馈/联系表单管理 API** | 后端有 model，路由未开放 | 补：client-admin 可查看/更新状态 |
| 4 | **知识库文档管理 UI** | 后端有 model + worker | 通过 Strapi Admin Content Manager 管理文档（默认已有 CRUD）；在 knowledge_base schema 中加 `vectorizationStatus`（enum: pending/processing/completed/failed）字段，worker 更新该字段，管理员可在 Content Manager 查看向量化状态 |
| 5 | **数据统计仪表盘** | 无 | 后端加 stats API + Strapi Admin 自定义仪表盘（通过 customizeWebpackPlugin 注入自定义页面，调用 `/api/stats/appointments` 等接口） |
| 6 | **报表导出（CSV）** | 无 | 后端加 `/appointments/export` 接口 |

#### admins 用户管理扩展详细

本地已有：
- [central/app/(dashboard)/admins/page.tsx](file:///home/tishensnoopy/project/superpowers-zh/central/app/(dashboard)/admins/page.tsx)（列表页）
- [central/app/(dashboard)/admins/new/page.tsx](file:///home/tishensnoopy/project/superpowers-zh/central/app/(dashboard)/admins/new/page.tsx)（新建页）
- [central/app/(dashboard)/admins/[id]/page.tsx](file:///home/tishensnoopy/project/superpowers-zh/central/app/(dashboard)/admins/[id]/page.tsx)（详情页）
- [central/app/api/admin/admins/route.ts](file:///home/tishensnoopy/project/superpowers-zh/central/app/api/admin/admins/route.ts)（GET/POST，已有 RBAC + audit log）
- [central/app/api/admin/admins/[id]/route.ts](file:///home/tishensnoopy/project/superpowers-zh/central/app/api/admin/admins/[id]/route.ts)（详情接口）

需要扩展：
- 角色权限编辑（PATCH `/api/admin/admins/[id]` 接受 `role` 字段）
- 密码重置（POST `/api/admin/admins/[id]/reset-password`）
- 锁定/解锁（POST `/api/admin/admins/[id]/lock`、`/unlock`）
- 数据库 schema 加 `locked` 字段（boolean）和 `lockedAt`（timestamp）

测试：
- `central/__tests__/api-admins-roles.test.ts`
- `central/__tests__/api-admins-password.test.ts`
- `central/__tests__/api-admins-lock.test.ts`

### 4.4 漏洞修复策略

修复方式优先级：
1. `npm audit fix`（自动修复）
2. `npm audit fix --force`（破坏性修复，需评估兼容性）
3. 手动升级依赖到安全版本
4. 无法升级的（如 Strapi 核心依赖）→ 评估风险并记录

**所有 high/medium/low 漏洞都修复**（用户要求）。

### 4.5 非阻断问题处理

**立即修复**（用户要求），不留到 P5 文档化。

### 4.6 P2 产出物

- `docs/AUDIT-REPORT.md`：8 维度审查报告
- 修复 commit（每个功能一个 commit）
- 新增功能测试

---

## 5. P3：严格测试套件

### 5.1 测试范围

| 测试套件 | 位置 | 命令 | 必须通过 |
|---|---|---|---|
| Backend 单元测试 | `backend/src/**/__tests__/*.test.ts` | `cd backend && npm test` | ✅ |
| Frontend 单元测试 | `frontend-next/lib/__tests__/` | `cd frontend-next && npm test` | ✅ |
| Central 单元测试 | `central/__tests__/*.test.ts` | `cd central && npm test` | ✅ |
| Agent 单元测试 | `agent/__tests__/*.test.ts` | `cd agent && npm test` | ✅ |
| Frontend E2E | `frontend-next/e2e/*.spec.ts` | `cd frontend-next && npx playwright test` | ✅ |
| Central E2E | `central/e2e/*.spec.ts` | `cd central && npx playwright test` | ✅ |
| 构建验证 | 各子项目 | `npm run build` | ✅ |
| Lint 检查 | 各子项目 | `npm run lint` | ✅ |

### 5.2 测试执行策略

分阶段执行：
1. 单元测试（最快，先跑）
2. 构建验证
3. Lint 检查
4. E2E 测试（最慢，最后跑）

### 5.3 测试修复原则

- **测试失败**：先判断是测试代码错误还是业务代码 bug
- **新功能测试**：P2 补的功能必须有测试
- **覆盖率不设阈值，但全覆盖**（用户要求）

### 5.4 E2E 测试前置条件

- Frontend E2E：使用 MSW mock（现有 `e2e/mocks/`）
- Central E2E：用 testcontainers（自动启停 PostgreSQL）

### 5.5 新增测试清单

| 功能 | 测试文件 | 测试内容 |
|---|---|---|
| admins 角色权限编辑 | `central/__tests__/api-admins-roles.test.ts` | superadmin 可改角色、admin 不可、viewer 不可 |
| admins 密码重置 | `central/__tests__/api-admins-password.test.ts` | superadmin 可重置、audit log 写入 |
| admins 锁定/解锁 | `central/__tests__/api-admins-lock.test.ts` | 锁定后无法登录、解锁后正常 |
| 预约 API find 开放 | `backend/src/api/appointment/controllers/__tests__/appointment-find.test.ts` | client-admin 可查看、访客不可、RBAC 生效 |
| 反馈 API find 开放 | 类似 | 同上 |
| 数据统计 API | `backend/src/api/**/controllers/__tests__/stats.test.ts` | 统计数据准确、权限正确 |
| CSV 导出 | `backend/src/api/**/controllers/__tests__/export.test.ts` | 导出格式正确、权限正确 |

### 5.6 历史环境依赖测试处理

如果某个历史 E2E 测试因环境问题无法通过（如微信回调需要真实公众号）：
- **标记 skip** + 记录到 `docs/known-issues.md`
- 不阻断部署（用户要求）

### 5.7 验证标准（"绿牌"）

部署前必须满足：
- ✅ 所有单元测试通过（0 失败）
- ✅ 所有 E2E 测试通过（允许 0 flaky，用户要求全绿）
- ✅ 所有子项目 `npm run build` 成功
- ✅ 所有子项目 `npm run lint` 无 error
- ✅ P2 新增功能都有测试覆盖

### 5.8 P3 产出物

- `docs/TEST-REPORT.md`：测试覆盖率、通过率、skip 测试清单
- 修复 commit

---

## 6. P4：客户业务系统部署

### 6.1 部署目标

在服务器 124.223.1.67（已部署 Central）上额外部署客户业务系统（佑森小课堂），实现 Central + 客户业务同机测试。

### 6.2 端口规划

| 服务 | 容器名 | 端口 | 说明 |
|---|---|---|---|
| Central Nginx | central-nginx | 80, 443 | 已占用 |
| Central App | central-app | 3000（容器内）| 已占用 |
| Central PostgreSQL | central-postgres | 5432（容器内）| 已占用，不映射宿主 |
| **客户 PostgreSQL** | yousen-postgres | **5432** | 与 Central 不冲突 |
| **客户 Redis** | yousen-redis | **6379** | 不冲突 |
| **客户 MeiliSearch** | yousen-meilisearch | **7700** | 不冲突 |
| **客户 Strapi 后端** | yousen-backend | **1337** | 不冲突 |
| **客户 Next.js 前端** | yousen-frontend | **3001** | 避免与 Central 冲突 |
| **Agent** | agent | 无外部端口 | 通过 WebSocket 连 Central |

### 6.3 部署目录

```
/opt/
├── central/              # Central 管理后台（已存在）
│   └── central/          # Central 子项目代码
└── customer-site/        # 客户业务系统（新建）
    ├── backend/
    ├── frontend-next/
    ├── docker-compose.yml
    ├── deploy.sh
    ├── .env
    └── 佑森/
```

### 6.4 部署步骤

#### 步骤 1：在 Central 后台创建客户 + 生成 Enrollment Code

1. 登录 https://central.tishensnoopy.cloud/login
2. 客户管理 → 新建客户 "佑森小课堂测试"
3. 生成 Enrollment Code（格式如 ABCD-1234-EFGH）
4. 创建配置版本并发布

#### 步骤 2：rsync 同步代码到服务器

```bash
cd /home/tishensnoopy/project/superpowers-zh

rsync -avz --progress \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.env*' \
  --exclude='.next/' \
  --exclude='test-results/' \
  --exclude='central/' \
  --exclude='shouye/' \
  --exclude='site/' \
  --exclude='docs/' \
  --exclude='skills/' \
  --exclude='hooks/' \
  --exclude='.trae/' \
  --exclude='.codex/' \
  --exclude='.cursor-plugin/' \
  --exclude='.claude-plugin/' \
  --exclude='.kimi-plugin/' \
  --exclude='.opencode/' \
  --exclude='.pi/' \
  ./ ubuntu@124.223.1.67:/tmp/customer-site/
```

#### 步骤 3：在服务器上移动文件并配置

```bash
ssh ubuntu@124.223.1.67
sudo mkdir -p /opt/customer-site
sudo cp -r /tmp/customer-site/* /opt/customer-site/
sudo chown -R root:root /opt/customer-site
sudo rm -rf /tmp/customer-site
cd /opt/customer-site
```

#### 步骤 4：配置 .env

```bash
sudo cp .env.example .env
sudo nano .env
```

关键配置项：
- `FRONTEND_PORT=3001`
- 数据库/Redis/MeiliSearch 强密码（`openssl rand -base64 32`）
- Strapi 安全密钥（5 个，各 `openssl rand -base64 32`）
- `NEXT_PUBLIC_STRAPI_API_URL=http://124.223.1.67:1337`
- `NEXT_PUBLIC_SITE_URL=http://124.223.1.67:3001`
- `CENTRAL_WS_URL=wss://central.tishensnoopy.cloud/api/agent/ws`
- `DASHSCOPE_API_KEY=<用户已确认拥有，P4 部署前用户提供>`（P5 阶段记录到 project_memory）
- 微信公众号配置先留空（HTTP 模式不可用，需域名+SSL）

#### 步骤 5：启动服务（分步）

```bash
cd /opt/customer-site

# 1. 基础设施
sudo docker compose up -d postgres redis meilisearch

# 2. 等待健康
sudo docker compose ps

# 3. 后端
sudo docker compose up -d --build backend

# 4. 等待后端健康
sudo docker compose ps

# 5. 前端
sudo docker compose up -d --build frontend

# 6. 检查所有服务
sudo docker compose ps
```

#### 步骤 6：创建 Strapi 超级管理员

**与 Central 管理员共用账号**（用户要求）：
- 邮箱：`tishensnoopy@petalmail.com`
- 密码：`Hym465964665`

**推荐方式**：浏览器访问 `http://124.223.1.67:1337/admin`，首次访问引导创建（简单可靠，避免 seed 脚本注入时的密码哈希问题）。

#### 步骤 7：Agent 注册到 Central

```bash
cd /opt/customer-site/agent
sudo docker compose -f docker-compose.yml -f scripts/agent-compose.yml run --rm agent \
  npm run register -- --code <ENROLLMENT_CODE> --name "佑森测试服务器"
```

#### 步骤 8：启动 Agent

```bash
cd /opt/customer-site
sudo docker compose -f docker-compose.yml -f scripts/agent-compose.yml up -d agent
sudo docker logs agent --tail 20
```

### 6.5 部署后验证

#### 自动化验证

```bash
sudo docker compose ps                    # 所有容器 healthy
curl -s http://localhost:1337/_health     # {"status":"ok"}
curl -sI http://localhost:3001/           # HTTP/1.1 200
curl -sI http://localhost:1337/admin       # 200 或 302
```

Central 后台验证：
- 登录 https://central.tishensnoopy.cloud/servers
- 确认服务器状态为"在线"，心跳正常

#### 人工验证清单

| # | 功能 | 访问地址 | 期望 |
|---|---|---|---|
| 1 | 首页 | http://124.223.1.67:3001/ | 正常显示 |
| 2 | 课程列表 | /courses | 看到课程 |
| 3 | 课程详情 | /courses/[slug] | 详情正常 |
| 4 | 校区列表 | /campuses | 正常 |
| 5 | 新闻列表 | /news | 正常 |
| 6 | 教师列表 | /teachers | 正常 |
| 7 | FAQ | /faq | 正常 |
| 8 | 预约表单 | /appointment | 提交成功 |
| 9 | 联系表单 | /contact | 提交成功 |
| 10 | 多语言切换 | 右上角按钮 | 中英文切换 |
| 11 | AI 客服 | 右下角浮动按钮 | 正常回复 |
| 12 | 搜索 | 搜索框 | 返回结果 |
| 13 | Strapi Admin | /admin | 可登录 |
| 14 | Central 后台 | central.tishensnoopy.cloud | 服务器在线 |

### 6.6 域名配置提醒

部署完成后，**提醒用户**：
1. 在 DNS 控制台添加 A 记录：`yousen.tishensnoopy.cloud` → `124.223.1.67`
2. 在腾讯云安全组开放 3001 端口（如需外网访问）
3. （可选）申请 SSL 证书并配置 nginx 反向代理

### 6.7 错误处理与回滚

| 问题 | 原因 | 解决 |
|---|---|---|
| 前端构建失败 | 后端未启动 | 确保后端先 healthy |
| 后端启动失败 | postgres 未 healthy | 等待 healthy |
| Agent 无法连接 Central | 网络/token | 检查 `CENTRAL_WS_URL`、`AGENT_TOKEN` |
| 端口冲突 | 3001/1337 被占用 | `sudo lsof -i :3001` |
| 内存不足 | OOM | P1 已创建 swap，监控 `free -h` |

**回滚**：`cd /opt/customer-site && sudo docker compose down`（不影响 Central）

### 6.8 P4 产出物

- 客户业务系统运行在 124.223.1.67
- Agent 注册到 Central
- 人工测试清单全部通过

---

## 7. P5：三端同步与文档更新

### 7.1 三端同步范围

| 端 | 当前状态 | 目标状态 |
|---|---|---|
| **本地代码** | 有未提交修改 | 全部 commit |
| **GitHub** | 与 origin/main 同步 | 包含 P1-P4 所有 commit |
| **服务器代码** | /opt/central（rsync 同步） | /opt/customer-site 部署最新代码 |
| **记忆** | 缺失 DASHSCOPE_API_KEY 等 | 完整记录所有硬约束、密钥、经验 |
| **文档** | FULL-DEPLOY-GUIDE.md 不够"小白" | 重写为分步指南 |

### 7.2 代码同步策略

#### 本地 → GitHub

```bash
git log --oneline origin/main..HEAD  # 查看待推送 commit
git push origin main
```

#### GitHub → 服务器

rsync 模式（主路径，P4 已用）。

#### 服务器部署版本记录

```bash
# 在服务器上记录部署的 commit SHA
echo "<commit-sha>" | sudo tee /opt/customer-site/.deployed-commit
```

### 7.3 记忆同步

需要记录到 `project_memory.md` 的关键信息：

**硬约束补充**：
- Central 管理员账号：`tishensnoopy@petalmail.com`（与 Strapi 超级管理员共用）
- 客户业务系统部署目录：`/opt/customer-site/`
- 客户业务系统端口：3001（前端）、1337（后端）、5432（DB）、6379（Redis）、7700（MeiliSearch）
- 客户业务系统域名：`yousen.tishensnoopy.cloud`（用户待配置 DNS）
- DASHSCOPE_API_KEY：`<用户提供的值>`（明文存储，因为有 Strapi Admin 修改入口）
- 服务器 swap：2G（P1 创建）
- Central cron 备份：每天 3 点执行，保留 7 天
- AI 配置修改入口：Strapi Admin → Content Manager → Ai Config

**Lessons Learned 补充**：
- central-nginx healthcheck 用 `wget --spider` 检测 80 端口会因 301 重定向失败，需在 nginx.conf 添加 `/healthz` 路径
- 服务器 3.6G 内存同时跑 Central + 客户业务需要 2G swap
- DASHSCOPE_API_KEY 必须记录到记忆，避免重复询问用户
- AI 配置修改入口已存在（Strapi Admin → Content Manager → Ai Config），用户可自行修改

### 7.4 文档同步

#### 文档 1：重写 `docs/FULL-DEPLOY-GUIDE.md`（小白版）

**改进方向**：
1. 每个命令都加"预期输出"
2. 每个步骤加"为什么"
3. 故障排查决策树
4. 分场景指南
5. 检查清单

**重写结构**：
```
第一部分：准备阶段
  1. 服务器要求
  2. 必备工具安装
  3. 域名和 SSL 准备

第二部分：部署 Central 管理后台
  1. 同步代码
  2. 配置 .env
  3. 启动服务
  4. 创建超级管理员
  5. 配置 SSL
  6. 配置自动备份

第三部分：部署客户业务系统
  1. 在 Central 后台创建客户
  2. 同步代码
  3. 配置 .env
  4. 分步启动服务
  5. 创建 Strapi 超级管理员
  6. Agent 注册
  7. 配置域名

第四部分：验证与测试
  1. 自动化验证命令
  2. 人工测试清单
  3. Central 后台验证

第五部分：日常维护
  1. 查看日志
  2. 重启服务
  3. 更新代码
  4. 备份与恢复

附录
  A. 故障排查决策树
  B. 端口对照表
  C. 重要文件说明
  D. 常见问题 FAQ
  E. 命令速查表
```

**每步格式**：
- 操作目的
- 具体命令
- 预期输出
- 失败处理
- 完成标志

#### 文档 2：新增 `docs/AUDIT-REPORT.md`

P2 阶段的 8 维度审查报告。

#### 文档 3：新增 `docs/TEST-REPORT.md`

P3 阶段的测试报告。

#### 文档 4：更新 `docs/DEPLOY-RUNBOOK.md`

补充 Central 同机部署场景。

### 7.5 P5 执行步骤

1. 本地 commit 所有 P1-P4 修改（按功能拆分）
2. git push origin main
3. 服务器记录部署 commit SHA
4. 更新 project_memory.md
5. 重写 docs/FULL-DEPLOY-GUIDE.md（小白版）
6. 新增 docs/AUDIT-REPORT.md
7. 新增 docs/TEST-REPORT.md
8. 更新 docs/DEPLOY-RUNBOOK.md
9. commit 文档变更
10. git push 文档

### 7.6 验收标准

- ✅ 本地所有修改已 commit
- ✅ GitHub 与本地同步
- ✅ 服务器代码与本地一致
- ✅ project_memory.md 包含所有部署信息
- ✅ 部署指南重写完成，每步有"预期输出"
- ✅ 审查报告 + 测试报告归档

---

## 8. 执行顺序与依赖

```
P1 (服务器修复)
  ↓
P2 (审查 + 功能补全)
  ↓
P3 (严格测试)
  ↓ (绿牌)
P4 (客户业务部署)
  ↓
P5 (三端同步 + 文档)
```

每个阶段完成后回到检查点，决定是否继续。

---

## 9. 整体验收标准

- ✅ central-nginx healthy
- ✅ Central cron 自动备份已配置
- ✅ 服务器 swap 已创建
- ✅ P2 八维度审查报告完成
- ✅ admins 用户管理扩展完成（角色/密码重置/锁定）
- ✅ 预约/反馈 API 开放 + RBAC
- ✅ 数据统计 + CSV 导出完成
- ✅ 知识库文档管理 UI 可用
- ✅ npm audit 所有漏洞修复
- ✅ 所有单元测试通过
- ✅ 所有 E2E 测试通过（0 flaky）
- ✅ 所有子项目 build + lint 通过
- ✅ 客户业务系统部署到服务器
- ✅ Agent 注册到 Central
- ✅ 人工测试清单全部通过
- ✅ 代码已 commit + push 到 GitHub
- ✅ 服务器部署 commit SHA 已记录
- ✅ project_memory.md 已更新
- ✅ 部署指南重写完成（小白版）
- ✅ 审查报告 + 测试报告归档

---

## 10. 关键决策记录

1. **客户管理员后台架构**：继续用 Strapi Admin，不开发独立后台
2. **漏洞修复范围**：所有 high/medium/low 都修
3. **非阻断问题**：立即修复，不延后
4. **E2E 测试**：必须全绿，0 flaky
5. **测试覆盖率**：不设阈值，全覆盖
6. **历史环境依赖测试**：标记 skip + 记录 known-issues，不阻断
7. **Strapi 超级管理员**：与 Central 管理员共用账号（tishensnoopy@petalmail.com）
8. **DASHSCOPE_API_KEY**：明文记录到 project_memory（有 Strapi Admin 修改入口）
9. **域名**：用户配置 yousen.tishensnoopy.cloud 指向 3001，部署完成时提醒
10. **服务器部署 commit SHA**：需要记录

---

**文档版本**：2026-07-16
**作者**：brainstorming skill
**状态**：待用户审查
