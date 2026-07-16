# 发布检查清单

> **生成时间：** 2026-07-16
> **当前状态：** `feat/multi-tenant-central-control` 已 fast-forward 合并到 `main`（`d547174`）
> **项目阶段：** 6 个子项目 + A/B/C 三块 + Central 部署全部完成，等待人工测试与生产部署

---

## 1. 代码仓库收尾

### 1.1 合并状态（已完成 ✓）

- [x] `feat/multi-tenant-central-control` 已 fast-forward 合并到 `main`
- [x] 合并后 main HEAD：`d547174`（139 files, +16904 行）
- [x] 所有 11 个 tag 都在 main 上
- [x] 工作区干净（仅 `.npmrc` 本地镜像配置未跟踪，不影响发布）

### 1.2 推送到远程（待执行）

- [ ] **推送 main 分支**（领先 origin/main 90 commit）
  ```bash
  git push origin main
  ```
- [ ] **推送所有 tag**（本地 11 个，远程 0 个）
  ```bash
  git push origin --tags
  ```
- [ ] **（可选）删除已合并的 feat 分支**
  ```bash
  git branch -d feat/multi-tenant-central-control        # 本地
  git push origin --delete feat/multi-tenant-central-control  # 远程（如已推送过）
  ```

### 1.3 Tag 清单（确认完整性）

| Tag | Commit | 里程碑 |
|-----|--------|--------|
| `v5-migration-complete` | `58582ab` | 子项目 1：Strapi v5 迁移 |
| `nextjs-skeleton-complete` | `4709e7a` | 子项目 2：Next.js 骨架 |
| `nextjs-content-complete` | `1658131` | 子项目 2：Next.js 内容 |
| `m1-complete` | `35efcea` | A 块 M1：多租户基础 |
| `m2-complete` | `f84e6a0` | A 块 M2：Agent 连接 |
| `m3-complete` | `a3da779` | A 块 M3：Agent 命令 |
| `m4-complete` | `4415934` | A 块 M4：部署 + SSE |
| `m5-complete` | `6f20157` | A 块 M5：安全 + E2E |
| `multi-tenant-complete` | `6f20157` | A 块整体完成 |
| `c-complete` | `cfe5cf7` | C 块：客户服务器部署 |
| `central-deploy-complete` | `d547174` | Central 管理后台部署 |

---

## 2. 人工测试清单

### 2.1 Central 管理后台单元测试

```bash
cd central
npm ci                    # 安装依赖（首次）
npm test                  # vitest run，预期全部通过
```

- [ ] `central/__tests__/` 下 18 个测试文件全部 PASS
- [ ] 重点确认：`encryption.test.ts`、`rate-limit.test.ts`、`agent-auth.test.ts`

### 2.2 Central E2E 测试（需要 Docker）

```bash
cd central
npx playwright install --with-deps   # 首次安装浏览器
# 启动测试环境（postgres + central-app）
docker compose -f docker-compose.yml up -d postgres central
sleep 30  # 等待启动
npx playwright test                  # 运行 E2E
```

- [ ] `e2e/full-flow.spec.ts` — 完整生命周期（客户→服务器→配置→部署）PASS
- [ ] `e2e/security.spec.ts` — 安全测试（token 无效/重放/IP 锁定）PASS
- [ ] `e2e/reconnect.spec.ts` — Agent 重连测试 PASS

### 2.3 Agent 单元测试

```bash
cd agent
npm ci
npm test
```

- [ ] `agent/__tests__/` 下 13 个测试文件全部 PASS

### 2.4 前端（frontend-next）测试

```bash
cd frontend-next
npm ci
npm run test           # vitest 单元测试
npm run test:e2e       # Playwright E2E（需先启动 Strapi + 前端）
```

- [ ] 单元测试 PASS
- [ ] E2E 测试 PASS（含 SEO 结构化数据、llms.txt、视觉回归基线）

### 2.5 后端（backend Strapi）测试

```bash
cd backend
npm ci
npm run test
```

- [ ] Strapi 测试 PASS

---

## 3. Central 服务器部署清单

> **详细步骤见：** [docs/CENTRAL-DEPLOY-RUNBOOK.md](./CENTRAL-DEPLOY-RUNBOOK.md)

### 3.1 服务器准备

- [ ] 准备 Ubuntu 22.04 / Debian 12 服务器（2C4G40G 最低）
- [ ] 公网 IP，入站开放 80、443、22
- [ ] 安装 Docker 24+ 和 Docker Compose v2
- [ ] 安装 certbot（`sudo apt install -y certbot`）

### 3.2 DNS + 域名

- [ ] 域名 A 记录解析到服务器 IP（如 `central.yousen.example.com`）
- [ ] `dig +short central.yousen.example.com` 验证解析

### 3.3 GitHub Secrets 配置

在仓库 Settings → Secrets → Actions 配置（`CENTRAL_` 前缀）：

- [ ] `CENTRAL_SSH_PRIVATE_KEY` — GitHub Actions 部署 SSH 私钥
- [ ] `CENTRAL_SERVER_IP` — Central 服务器 IP
- [ ] `CENTRAL_DEPLOY_PATH` — `/opt/central`
- [ ] （可选）`CENTRAL_DEPLOY_SSH_PORT` — SSH 端口（默认 22）
- [ ] （可选）`CENTRAL_DEPLOY_USER` — SSH 用户（默认 root）

### 3.4 首次部署

- [ ] 服务器上 `git clone` 项目到 `/opt/central`
- [ ] `cd /opt/central/central && cp .env.example .env && chmod 600 .env`
- [ ] 生成密钥：`for i in $(seq 1 4); do openssl rand -base64 32; done`
- [ ] 编辑 `.env` 填入：`DATABASE_PASSWORD`、`JWT_SECRET`、`AES_KEY`、`ADMIN_JWT_SECRET`、`INITIAL_ADMIN_PASSWORD`、`CENTRAL_DOMAIN`
- [ ] **⚠️ 备份 AES_KEY 到密码管理器**（丢失则所有客户加密配置不可解密）
- [ ] 启动 postgres + central（不带 nginx）：`docker compose -f docker-compose.yml up -d postgres central`
- [ ] 申请 SSL 证书：`sudo certbot certonly --standalone -d <域名>`
- [ ] 完整启动：`./deploy.sh -d`
- [ ] 初始化数据库：`docker exec central-app npx tsx db/seed.ts`

### 3.5 首次部署验证

- [ ] 访问 `https://<域名>/login` 显示登录页
- [ ] 用 `admin@yousen.local` + `INITIAL_ADMIN_PASSWORD` 登录成功
- [ ] 浏览器地址栏显示安全锁（HTTPS 有效）
- [ ] `./deploy.sh --status` 三个服务（postgres/central/nginx）都 healthy

### 3.6 配置自动维护

- [ ] SSL 续期 cron：`0 3 * * * certbot renew --quiet --post-hook "docker compose -f ... restart nginx"`
- [ ] 数据库备份 cron：`0 2 * * * cd /opt/central/central && ./scripts/backup.sh >> /var/log/central-backup.log 2>&1`

---

## 4. 客户服务器部署清单

> **详细步骤见：** [docs/DEPLOY-RUNBOOK.md](./DEPLOY-RUNBOOK.md)

### 4.1 服务器准备

- [ ] 准备客户服务器（Ubuntu 22.04，2C4G40G 最低）
- [ ] 安装 Docker 24+ 和 Docker Compose v2
- [ ] 公网 IP，入站开放 80、443、22

### 4.2 GitHub Secrets 配置（客户部署，无前缀）

- [ ] `SSH_PRIVATE_KEY` — 客户部署 SSH 私钥
- [ ] `SERVER_IP` — 客户服务器 IP
- [ ] `DEPLOY_PATH` — `/opt/yousen`
- [ ] （可选）`DEPLOY_SSH_PORT`、`DEPLOY_USER`

### 4.3 首次部署

- [ ] 服务器 `git clone` 到 `/opt/yousen`
- [ ] 配置 `backend/.env`、`frontend-next/.env`（含 Strapi、MeiliSearch、PostgreSQL、微信等变量）
- [ ] `cd /opt/yousen && ./deploy.sh -d`
- [ ] 等待 Strapi + 前端 + MeiliSearch 启动完成

### 4.4 客户服务器验证

- [ ] 访问 `https://<客户域名>` 显示首页
- [ ] Strapi 管理后台 `https://<域名>:1337/admin` 可访问
- [ ] 产品搜索、筛选功能正常
- [ ] AI 客服对话功能正常
- [ ] （如启用）微信 JSSDK 分享功能正常

### 4.5 启用 Agent（连接 Central）

- [ ] 在 Central 管理后台创建客户记录 + 服务器记录
- [ ] 生成 enrollment code，在客户服务器执行 Agent 注册
- [ ] 验证 Central → Agent WebSocket 连接成功
- [ ] 在 Central 触发一次测试部署，确认 SSE 日志流正常

---

## 5. 上线后监控

### 5.1 Central 服务器

- [ ] 配置证书到期监控（证书过期前 7 天告警）
- [ ] 配置 `central-app` 容器重启告警
- [ ] 定期检查 `./deploy.sh --logs` 无异常错误
- [ ] 定期检查数据库备份文件生成（`/opt/central/central/backups/`）

### 5.2 客户服务器

- [ ] 配置 Strapi 健康检查告警
- [ ] 配置前端可用性监控
- [ ] （如启用）配置微信回调监控

---

## 6. 应急预案

### 6.1 Central 不可用

- **影响：** 无法管理客户服务器、无法触发部署
- **应急：** 客户服务器独立运行不受影响（Agent 断线会自动重连）
- **恢复：** 按 [CENTRAL-DEPLOY-RUNBOOK.md §4](./CENTRAL-DEPLOY-RUNBOOK.md) 回滚

### 6.2 客户服务器不可用

- **影响：** 该客户网站不可访问
- **应急：** 按 [DEPLOY-RUNBOOK.md §4](./DEPLOY-RUNBOOK.md) 回滚到上一个 commit/tag

### 6.3 AES_KEY 丢失

- **影响：** 所有客户加密配置（dashscopeKey、wechatAppSecret、DATABASE_PASSWORD 等）无法解密
- **应急：** 从密码管理器恢复 .env 备份；若无备份需重新录入所有客户密钥
- **预防：** .env 必须多重备份（密码管理器 + 离线存储）

### 6.4 数据库损坏

- **影响：** Central 或客户数据丢失
- **应急：** 按 [CENTRAL-DEPLOY-RUNBOOK.md §6.3](./CENTRAL-DEPLOY-RUNBOOK.md) 从备份恢复
- **预防：** 确认 cron 备份正常执行，定期验证备份可恢复

---

## 7. 发布签字

| 角色 | 状态 | 日期 |
|------|------|------|
| 代码合并 | ✓ 已完成（`d547174`） | 2026-07-16 |
| 单元测试 | ☐ 待执行 | |
| E2E 测试 | ☐ 待执行 | |
| Central 部署 | ☐ 待执行 | |
| 客户部署 | ☐ 待执行 | |
| 上线监控 | ☐ 待配置 | |
| **正式发布** | ☐ 待签字 | |
