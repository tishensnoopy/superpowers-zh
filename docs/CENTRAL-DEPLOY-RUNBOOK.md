# 佑森中央管理后台 部署 Runbook

> **适用范围：** Central 管理后台独立服务器部署（postgres + central-app + nginx）。
> **前置条件：** A 块（多租户中央控制）已完成；域名已解析到服务器 IP。
> **与客户部署的关系：** 客户服务器部署见 [DEPLOY-RUNBOOK.md](./DEPLOY-RUNBOOK.md)。Central 部署在独立服务器，不与客户业务混部。

---

## 1. 前置准备

### 1.1 服务器要求

- Ubuntu 22.04 LTS 或 Debian 12
- 2 核 CPU / 4GB 内存 / 40GB 磁盘（最低）
- Docker 24+ 和 Docker Compose v2
- 公网 IP（入站开放 80、443、22 端口）
- **域名已解析到服务器 IP**（central 要求 HTTPS，不支持 IP 访问）
- 出站能访问 GitHub（拉代码）和客户服务器（Agent WebSocket 连入）

### 1.2 SSH key 配置

**GitHub Actions 专用部署 key（不是个人 key）：**

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy-central@yousen" -f ~/.ssh/yousen-central-deploy
ssh-copy-id -i ~/.ssh/yousen-central-deploy.pub root@<CENTRAL_SERVER_IP>
ssh -i ~/.ssh/yousen-central-deploy root@<CENTRAL_SERVER_IP> "echo OK"
```

### 1.3 GitHub Secrets 配置

在 GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret：

| Secret 名 | 值 | 必填 |
|-----------|-----|------|
| `CENTRAL_SSH_PRIVATE_KEY` | `~/.ssh/yousen-central-deploy` 文件内容（含 BEGIN/END 行） | ✅ |
| `CENTRAL_SERVER_IP` | central 服务器公网 IP | ✅ |
| `CENTRAL_DEPLOY_PATH` | `/opt/central` | ✅ |
| `CENTRAL_DEPLOY_SSH_PORT` | `22`（如非 22 才填） | 可选 |
| `CENTRAL_DEPLOY_USER` | `root`（如非 root 才填） | 可选 |

> **注意：** central 部署的 secrets 使用 `CENTRAL_` 前缀，与客户部署的 secrets（`SSH_PRIVATE_KEY` / `SERVER_IP` / `DEPLOY_PATH`）独立，同一仓库可同时配置两套部署目标。

> **敏感变量隔离原则：** `DATABASE_PASSWORD`、`JWT_SECRET`、`AES_KEY`、`ADMIN_JWT_SECRET`、`INITIAL_ADMIN_PASSWORD` 等密钥**不进 GitHub Secrets**，仅在服务器 `.env` 维护。`AES_KEY` 尤其重要——丢失则所有客户加密配置不可解密。

### 1.4 域名 DNS 配置

在域名服务商控制台添加 A 记录：
```
central.yousen.example.com  A  <CENTRAL_SERVER_IP>
```

验证解析：
```bash
dig +short central.yousen.example.com
# 应输出服务器 IP
```

---

## 2. 首次部署

### 2.1 服务器初始化

```bash
ssh root@<CENTRAL_SERVER_IP>

# 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# 验证
docker --version
docker compose version

# 安装 certbot（申请 SSL 证书用）
sudo apt update
sudo apt install -y certbot
```

### 2.2 拉取项目代码

```bash
mkdir -p /opt && cd /opt
git clone https://github.com/<your-org>/yousen.git /opt/central
cd /opt/central/central
```

> **注：** 首次 clone 可以从 GitHub 拉，也可以从 Gitee/CNB 国内镜像拉。后续部署由 GitHub Actions rsync 同步，不依赖服务器连 GitHub。

### 2.3 申请 SSL 证书（首次必做）

Central 要求 HTTPS，首次部署前必须先申请证书：

```bash
# 临时启动 postgres + central（不带 nginx），让 central 在 3000 端口可用
cd /opt/central/central
cp .env.example .env
# 先编辑 .env，至少填入 CENTRAL_DOMAIN、DATABASE_PASSWORD、JWT_SECRET、AES_KEY
nano .env

# 启动 postgres + central（不启动 nginx，释放 80 端口给 certbot）
docker compose -f docker-compose.yml up -d postgres central
# 等待 central 启动（约 30 秒）
sleep 30

# 申请 Let's Encrypt 证书（standalone 模式，临时占用 80 端口）
sudo certbot certonly --standalone -d central.yousen.example.com

# 验证证书
sudo ls /etc/letsencrypt/live/central.yousen.example.com/
# 应看到 fullchain.pem  privkey.pem
```

### 2.4 配置 .env

```bash
cd /opt/central/central
cp .env.example .env
chmod 600 .env
nano .env
```

必填项（参考 [.env.example](../central/.env.example)）：

```env
# 数据库
DATABASE_PASSWORD=<openssl rand -base64 32>

# Central 应用
JWT_SECRET=<openssl rand -base64 32>
AES_KEY=<openssl rand -base64 32>
ADMIN_JWT_SECRET=<openssl rand -base64 32>
INITIAL_ADMIN_PASSWORD=<首次登录密码，登录后强制修改>

# 域名
CENTRAL_DOMAIN=central.yousen.example.com

# 备份
BACKUP_DIR=/opt/central/central/backups
BACKUP_RETENTION_DAYS=7
```

生成密钥命令：
```bash
for i in $(seq 1 4); do openssl rand -base64 32; done
```

> **⚠️ AES_KEY 备份：** AES_KEY 丢失意味着所有客户的加密配置（dashscopeKey / wechatAppSecret / DATABASE_PASSWORD 等）无法解密。**立即将 .env 备份到密码管理器**（如 1Password / Bitwarden），不要仅存在服务器上。

### 2.5 首次启动

```bash
cd /opt/central/central
./deploy.sh -d
```

等待分阶段健康检查完成（postgres → central-app → nginx，约 2-3 分钟）。看到 `✅ Central 部署完成！` 即成功。

### 2.6 初始化数据库 seed（仅首次）

首次部署后，手动执行 seed 创建默认管理员：

```bash
docker exec central-app npx tsx db/seed.ts
```

默认管理员账号：
- email: `admin@yousen.local`
- password: 由 `.env` 中 `INITIAL_ADMIN_PASSWORD` 决定

### 2.7 验证

- 访问 `https://central.yousen.example.com/login` → 应看到登录页
- 用 `admin@yousen.local` + `INITIAL_ADMIN_PASSWORD` 登录
- 登录后强制修改密码
- 证书验证：浏览器地址栏应显示安全锁

---

## 3. 更新部署

### 3.1 自动部署（推荐）

push 代码到 `main` 分支（触及 `central/` 路径），GitHub Actions 自动触发：

1. Runner checkout 代码
2. rsync 同步到服务器（排除 .env/node_modules/.next/backend/frontend-next/agent/backups）
3. SSH 远程执行 `cd /opt/central/central && ./deploy.sh --no-pull -d`
4. 失败时上传 deploy.log artifact

在 GitHub 仓库 → Actions 标签页查看执行状态。

### 3.2 手动部署（GitHub Actions 不可用时）

```bash
# 从本地 rsync + ssh（exclude 列表与 .github/workflows/deploy-central.yml 保持一致）
rsync -avz --delete \
  --exclude='.git/' --exclude='node_modules/' --exclude='.next/' \
  --exclude='dist/' --exclude='build/' \
  --exclude='.env' --exclude='*.log' --exclude='data/' \
  --exclude='.cache/' --exclude='.npmrc' \
  --exclude='backend/' --exclude='frontend-next/' --exclude='agent/' \
  --exclude='central/backups/' \
  -e ssh \
  ./ root@<CENTRAL_SERVER_IP>:/opt/central/

ssh root@<CENTRAL_SERVER_IP> "cd /opt/central/central && ./deploy.sh --no-pull -d"
```

### 3.3 手动触发 workflow

在 GitHub 仓库 → Actions → "Deploy central" → Run workflow → Run。

---

## 4. 回滚

### 4.1 回滚到上一个 commit

```bash
ssh root@<CENTRAL_SERVER_IP>
cd /opt/central
git log --oneline -5  # 找到上一个 commit
git checkout <previous-commit-sha>
cd central
./deploy.sh -d --no-build  # 用已有镜像，不重新构建
```

### 4.2 回滚到上一个 tag

```bash
ssh root@<CENTRAL_SERVER_IP>
cd /opt/central
git tag --list | sort -V | tail -5
git checkout <previous-tag>
cd central
./deploy.sh -d --no-build
```

> **注：** 回滚数据库 schema 不自动处理。如果回滚涉及数据库迁移，需要手动 `docker exec central-app npx tsx db/migrate.ts` 或 `docker exec central-app npx tsx db/migrate.ts --down`。

---

## 5. SSL 证书续期

### 5.1 配置自动续期 cron

```bash
sudo crontab -e
# 追加：每天凌晨 3 点检查续期，续期成功后重启 nginx
0 3 * * * certbot renew --quiet --post-hook "docker compose -f /opt/central/central/docker-compose.yml -f /opt/central/central/docker-compose.nginx.yml restart nginx"
```

### 5.2 手动续期

```bash
# 检查证书到期时间
sudo certbot certificates

# 手动续期（需临时停 nginx 释放 80 端口）
cd /opt/central/central
docker compose -f docker-compose.yml -f docker-compose.nginx.yml stop nginx
sudo certbot renew
docker compose -f docker-compose.yml -f docker-compose.nginx.yml start nginx
```

### 5.3 证书过期告警

建议在服务器上配置证书到期监控（如 `ssl-cert-check` 或 Prometheus blackbox exporter），证书过期前 7 天告警。

---

## 6. 备份与恢复

### 6.1 自动备份（cron）

```bash
sudo crontab -e
# 追加：每天凌晨 2 点执行数据库备份，保留 7 天
0 2 * * * cd /opt/central/central && ./scripts/backup.sh >> /var/log/central-backup.log 2>&1
```

备份文件存储在 `/opt/central/central/backups/`，命名格式 `control_db_YYYYMMDD_HHMMSS.sql.gz`。

### 6.2 手动备份

```bash
cd /opt/central/central
./deploy.sh --backup
# 或直接调用
./scripts/backup.sh
```

### 6.3 恢复数据库

```bash
# 停止 central-app（避免恢复时有写入）
cd /opt/central/central
docker compose -f docker-compose.yml -f docker-compose.nginx.yml stop central

# 恢复
gunzip -c /opt/central/central/backups/control_db_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i central-postgres psql -U central control_db

# 重启
docker compose -f docker-compose.yml -f docker-compose.nginx.yml start central
```

### 6.4 AES_KEY 管理

- **存储：** AES_KEY 必须备份到密码管理器（1Password / Bitwarden），不要仅存在服务器 .env 中
- **轮换：** 生成新 key → 在 .env 中设置 `AES_KEY=<新key>` 和 `AES_KEY_PREVIOUS=<旧key>` → 重启 central-app → 旧 key 保留 30 天后可移除
- **丢失：** 如果 AES_KEY 丢失且无备份，所有客户的加密配置无法解密，需要重新录入所有客户密钥

---

## 7. 故障排查

### 7.1 GitHub Actions 失败

**查看日志：** GitHub 仓库 → Actions → 失败的 run → 展开失败步骤

**常见原因：**

| 错误 | 排查 |
|------|------|
| `Permission denied (publickey)` | CENTRAL_SSH_PRIVATE_KEY 未配置或与服务器公钥不匹配 |
| `rsync: connection unexpectedly closed` | 服务器 SSH 端口不对；检查 CENTRAL_DEPLOY_SSH_PORT |
| `./deploy.sh: No such file` | CENTRAL_DEPLOY_PATH 路径不对；首次需手动 `git clone` |
| `deploy.sh exited with code 1` | 容器启动失败；SSH 上服务器看 `docker compose logs` |

### 7.2 SSL 证书问题

```bash
# 检查证书状态
sudo certbot certificates

# 检查 nginx 是否正确加载证书
docker exec central-nginx nginx -t

# 常见错误
# "cannot load certificate" → 证书路径不对，检查 /etc/letsencrypt/live/<domain>/
# "certificate has expired" → 执行 sudo certbot renew
```

### 7.3 Agent 连不上 central

```bash
# 查看 central-app 日志
docker logs central-app --tail 100

# 检查 WebSocket 端点
curl -I -H "Upgrade: websocket" -H "Connection: Upgrade" https://central.yousen.example.com/api/agent/ws

# 常见错误
# "502 Bad Gateway" → central-app 未启动或崩溃
# "400 Bad Request" → Agent 未传 token 或 token 无效
# "401 Unauthorized" → Agent token 已被吊销
```

### 7.4 数据库连接失败

```bash
# 检查 postgres 状态
docker compose -f /opt/central/central/docker-compose.yml ps postgres

# 检查 central-app 能否连数据库
docker exec central-app sh -c "echo 'SELECT 1' | npx tsx -e 'import pg from \"pg\"; const pool = new pg.Pool({connectionString: process.env.DATABASE_URL}); pool.query(\"SELECT 1\").then(r => {console.log(\"DB OK\"); process.exit(0)}).catch(e => {console.error(e); process.exit(1)})'"

# 常见错误
# "password authentication failed" → .env 中 DATABASE_PASSWORD 与 docker-compose.yml 不一致
# "database control_db does not exist" → postgres 未初始化，重启 postgres 容器
```

### 7.5 deploy.sh 各阶段失败

| 阶段 | 失败原因 | 排查命令 |
|------|---------|---------|
| postgres 健康检查超时 | postgres 启动失败 | `docker compose -f docker-compose.yml logs postgres` |
| central-app 健康检查超时 | Next.js 启动失败（DB 连接、JWT_SECRET 缺失） | `docker compose -f docker-compose.yml logs central` |
| nginx 启动失败 | nginx.conf 语法错误或证书路径不对 | `docker exec central-nginx nginx -t` |

---

## 8. 手动离线部署（GitHub 完全不可用）

> **场景：** GitHub 宕机或被墙，GitHub Actions 无法触发。

### 8.1 本地打包代码

```bash
# 在本地项目根目录
tar --exclude='.git' --exclude='node_modules' --exclude='.next' \
    --exclude='dist' --exclude='build' \
    --exclude='.env' --exclude='*.log' --exclude='data' \
    --exclude='.cache' --exclude='.npmrc' \
    --exclude='backend' --exclude='frontend-next' --exclude='agent' \
    --exclude='central/backups' \
    -czf /tmp/central-deploy.tar.gz .

ls -lh /tmp/central-deploy.tar.gz
```

### 8.2 上传到服务器

```bash
scp /tmp/central-deploy.tar.gz root@<CENTRAL_SERVER_IP>:/tmp/
```

### 8.3 服务器解压并部署

```bash
ssh root@<CENTRAL_SERVER_IP>
cd /opt/central
tar -xzf /tmp/central-deploy.tar.gz -C /opt/central/
cd central
./deploy.sh --no-pull -d
rm /tmp/central-deploy.tar.gz
```

---

## 附录：密钥生成速查

```bash
# 生成 32 字节 base64 随机字符串（用于 JWT_SECRET / AES_KEY / ADMIN_JWT_SECRET / DATABASE_PASSWORD）
openssl rand -base64 32

# 一次性生成 4 个密钥
for i in $(seq 1 4); do openssl rand -base64 32; done

# 生成 ed25519 SSH key（GitHub Actions 部署用）
ssh-keygen -t ed25519 -C "github-actions-deploy-central@yousen" -f ~/.ssh/yousen-central-deploy

# 查看 SSL 证书到期时间
echo | openssl s_client -connect central.yousen.example.com:443 2>/dev/null | openssl x509 -noout -dates
```
