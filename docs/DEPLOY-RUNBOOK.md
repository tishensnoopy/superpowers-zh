# 佑森小课堂 客户服务器部署 Runbook

> **适用范围：** 单台客户服务器（业务 + Agent）。central 管理后台部署另立文档。
> **前置条件：** A 块（多租户中央控制）已完成；agent 镜像 `registry.cn-hangzhou.aliyuncs.com/yousen/agent:latest` 已推送到阿里云镜像仓库。

---

## 1. 前置准备

### 1.1 服务器要求

- Ubuntu 22.04 LTS 或 Debian 12
- 2 核 CPU / 4GB 内存 / 40GB 磁盘（最低）
- Docker 24+ 和 Docker Compose v2
- 公网 IP（入站开放 80、443、22 端口）
- 出站能访问 `registry.cn-hangzhou.aliyuncs.com`（拉镜像）和 central 服务器（WebSocket 长连接）

### 1.2 SSH key 配置

**在 GitHub Actions 用的部署 key（不是个人 key）：**

```bash
# 在本地生成专用部署 key
ssh-keygen -t ed25519 -C "github-actions-deploy@yousen" -f ~/.ssh/yousen-deploy

# 将公钥追加到客户服务器
ssh-copy-id -i ~/.ssh/yousen-deploy.pub root@<SERVER_IP>

# 测试登录
ssh -i ~/.ssh/yousen-deploy root@<SERVER_IP> "echo OK"
```

### 1.3 GitHub Secrets 配置

在 GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret：

| Secret 名 | 值 | 必填 |
|-----------|-----|------|
| `SSH_PRIVATE_KEY` | `~/.ssh/yousen-deploy` 文件内容（含 BEGIN/END 行） | ✅ |
| `SERVER_IP` | 客户服务器公网 IP | ✅ |
| `DEPLOY_PATH` | `/opt/yousen` | ✅ |
| `DEPLOY_SSH_PORT` | `22`（如非 22 才填） | 可选 |
| `DEPLOY_USER` | `root`（如非 root 才填） | 可选 |

> **敏感变量隔离原则：** `DATABASE_PASSWORD`、`APP_KEYS`、`JWT_SECRET`、`DASHSCOPE_API_KEY`、`WECHAT_*` 等业务密钥**不进 GitHub Secrets**，仅在服务器 `.env` 维护。

---

## 2. 首次部署

### 2.1 服务器初始化

```bash
# SSH 登录服务器
ssh root@<SERVER_IP>

# 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# 验证
docker --version
docker compose version
```

### 2.2 拉取项目代码

```bash
mkdir -p /opt && cd /opt
git clone https://github.com/<your-org>/yousen.git /opt/yousen
cd /opt/yousen
```

> **注：** 首次 clone 可以从 GitHub 拉，也可以从 Gitee/CNB 国内镜像拉。后续部署由 GitHub Actions rsync 同步，不依赖服务器连 GitHub。

### 2.3 配置 .env

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

必填项（参考 [.env.example](../.env.example)）：

```env
DATABASE_PASSWORD=<openssl rand -base64 32>
APP_KEYS=<4 个逗号分隔的 base64 key>
API_TOKEN_SALT=<openssl rand -base64 32>
ADMIN_JWT_SECRET=<openssl rand -base64 32>
TRANSFER_TOKEN_SALT=<openssl rand -base64 32>
JWT_SECRET=<openssl rand -base64 32>
REDIS_PASSWORD=<openssl rand -base64 32>
MEILI_MASTER_KEY=<openssl rand -base64 32>
NEXT_PUBLIC_STRAPI_API_URL=http://<SERVER_IP>
NEXT_PUBLIC_SITE_URL=http://<SERVER_IP>
DASHSCOPE_API_KEY=<阿里云 DashScope key>
CENTRAL_WS_URL=wss://<CENTRAL_DOMAIN>/api/agent/ws
# AGENT_TOKEN 和 SERVER_ID 注册后自动填入
```

生成密钥命令：
```bash
for i in $(seq 1 4); do openssl rand -base64 32; done | paste -sd,
openssl rand -base64 32
```

### 2.4 配置 Docker 镜像加速器（首次必做）

```bash
cd /opt/yousen
sudo ./deploy.sh --configure-mirrors
```

### 2.5 首次启动业务

```bash
./deploy.sh --nginx -d
```

等待分阶段健康检查完成（postgres → backend → frontend → nginx，约 3-5 分钟）。看到 `✅ 部署完成！` 即成功。

访问 `http://<SERVER_IP>` 验证前端，`http://<SERVER_IP>/admin` 验证 Strapi 后台。

### 2.6 Agent 注册

**前提：** central 已部署并运行，且已为该客户颁发了 enrollment code。

在客户服务器执行（参考 [agent/README.md](../agent/README.md)）：

```bash
# 拉取 Agent 镜像
docker pull registry.cn-hangzhou.aliyuncs.com/yousen/agent:latest

# 注册（用 enrollment code 换取长期 token）
docker run --rm \
  -v /opt/yousen/.env:/app/agent.env \
  -e CENTRAL_API_URL=https://<CENTRAL_DOMAIN> \
  registry.cn-hangzhou.aliyuncs.com/yousen/agent:latest \
  register --enrollment-code <你的code>

# 验证 .env 已写入 AGENT_TOKEN 和 SERVER_ID
grep -E '^(AGENT_TOKEN|SERVER_ID)=' /opt/yousen/.env
```

### 2.7 后续部署带 Agent

```bash
cd /opt/yousen
./deploy.sh --nginx -d --agent
```

此命令同时启动业务容器 + Agent 容器。Agent 会自动连上 central。

---

## 3. 更新部署

### 3.1 自动部署（推荐）

push 代码到 `main` 分支（触及 `backend/`、`frontend-next/`、`nginx/`、`deploy.sh`、`docker-compose.yml` 等路径），GitHub Actions 自动触发：

1. Runner checkout 代码
2. rsync 同步到服务器（排除 .env/node_modules/.git/central/agent）
3. SSH 远程执行 `./deploy.sh --no-pull --nginx -d`
4. 失败时上传 deploy.log artifact

在 GitHub 仓库 → Actions 标签页查看执行状态。

### 3.2 手动部署（GitHub Actions 不可用时）

```bash
# 从本地 rsync + ssh（exclude 列表与 .github/workflows/deploy-customer.yml 保持一致）
rsync -avz --delete \
  --exclude='.git/' --exclude='node_modules/' --exclude='.next/' \
  --exclude='dist/' --exclude='build/' \
  --exclude='.env' --exclude='*.log' --exclude='data/' \
  --exclude='strapi_uploads/' --exclude='strapi_pg_data/' \
  --exclude='strapi_redis_data/' --exclude='strapi_meili_data/' \
  --exclude='.cache/' --exclude='.npmrc' \
  --exclude='central/' --exclude='agent/' \
  -e ssh \
  ./ root@<SERVER_IP>:/opt/yousen/

ssh root@<SERVER_IP> "cd /opt/yousen && ./deploy.sh --no-pull --nginx -d"
```

### 3.3 手动触发 workflow（带 Agent 重启）

在 GitHub 仓库 → Actions → "Deploy customer site" → Run workflow → 勾选 `restart_agent` → Run。

---

## 4. 回滚

### 4.1 回滚到上一个 commit

```bash
ssh root@<SERVER_IP>
cd /opt/yousen
git log --oneline -5  # 找到上一个 commit
git checkout <previous-commit-sha>
./deploy.sh --nginx -d --no-build  # 用已有镜像，不重新构建
```

### 4.2 回滚到上一个 tag

```bash
ssh root@<SERVER_IP>
cd /opt/yousen
git tag --list | sort -V | tail -5
git checkout <previous-tag>
./deploy.sh --nginx -d --no-build
```

> **注：** 回滚数据库 schema 不自动处理。如果回滚涉及数据库迁移，需要手动 `docker compose exec backend npm run strapi migration:down`。

---

## 5. Agent 管理

### 5.1 启动 Agent

```bash
cd /opt/yousen
./deploy.sh --nginx -d --agent
# 或仅启动 agent（业务已运行）
# 注意：agent-compose.yml 用 ${DEPLOY_PATH} 占位，需通过环境变量传入实际部署路径
DEPLOY_PATH=/opt/yousen docker compose -f scripts/agent-compose.yml up -d
```

### 5.2 停止 Agent

```bash
docker stop yousen-agent
```

### 5.3 查看日志

```bash
docker logs -f yousen-agent
# 或
docker logs --tail 100 yousen-agent
```

### 5.4 升级 Agent

```bash
cd /opt/yousen
docker compose -f scripts/agent-compose.yml pull
# 注意：up 需要 DEPLOY_PATH 环境变量替换 compose 模板中的占位符
DEPLOY_PATH=/opt/yousen docker compose -f scripts/agent-compose.yml up -d
```

Agent 镜像升级后自动重连 central，无需重新注册（token 不变）。

### 5.5 重新注册（token 被吊销时）

1. 在 central 管理后台点"吊销 Token"
2. 重新颁发 enrollment code
3. 在客户服务器执行 [2.6 Agent 注册](#26-agent-注册) 步骤
4. `./deploy.sh --nginx -d --agent` 重启

---

## 6. SSL 启用（配域名后）

> **前提：** 已有域名，DNS 解析到服务器 IP。

### 6.1 申请 Let's Encrypt 证书

```bash
# 安装 certbot
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# 申请证书（需要临时停 nginx，因为 certbot 会用 80 端口验证）
sudo docker compose -f /opt/yousen/docker-compose.yml -f /opt/yousen/docker-compose.nginx.yml stop nginx
sudo certbot certonly --standalone -d your-domain.com
sudo docker compose -f /opt/yousen/docker-compose.yml -f /opt/yousen/docker-compose.nginx.yml start nginx
```

### 6.2 启用 nginx HTTPS

编辑 `/opt/yousen/nginx/nginx.conf`，取消注释 HTTPS server 块，将 `your-domain.com` 替换为实际域名。

**同时需要把证书路径挂载进 nginx 容器**。编辑 `docker-compose.nginx.yml`，在 nginx 服务的 volumes 中追加：

```yaml
volumes:
  - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
  - /etc/letsencrypt:/etc/letsencrypt:ro  # 追加这行
```

### 6.3 重启 nginx

```bash
cd /opt/yousen
docker compose -f docker-compose.yml -f docker-compose.nginx.yml restart nginx
```

### 6.4 配置自动续期

```bash
sudo crontab -e
# 追加：每天凌晨 3 点检查续期
0 3 * * * certbot renew --quiet --post-hook "docker compose -f /opt/yousen/docker-compose.yml -f /opt/yousen/docker-compose.nginx.yml restart nginx"
```

### 6.5 更新 .env

```bash
# 修改 NEXT_PUBLIC_SITE_URL 和 NEXT_PUBLIC_STRAPI_API_URL 为 HTTPS
sed -i 's|http://<SERVER_IP>|https://your-domain.com|g' /opt/yousen/.env

# 重新部署（重建前端以使 NEXT_PUBLIC_* 变量生效）
./deploy.sh --nginx -d
```

---

## 7. 微信回调启用（配域名 + SSL 后）

> **前提：** 已完成 [第 6 节 SSL 启用](#6-ssl-启用配域名后)；已有微信公众号 AppID/AppSecret。

### 7.1 填入微信凭证

编辑 `/opt/yousen/.env`：

```env
WECHAT_APP_ID=wx你的appid
WECHAT_APP_SECRET=你的appsecret
WECHAT_TOKEN=你在公众号后台设置的 webhook token
```

### 7.2 重启后端

```bash
cd /opt/yousen
docker compose restart backend
```

### 7.3 微信公众号后台配置

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 开发 → 基本配置 → 服务器配置
3. URL: `https://your-domain.com/api/wechat/webhook`
4. Token: 与 .env 中 `WECHAT_TOKEN` 一致
5. EncodingAESKey: 随机生成（当前用明文模式，可留空）
6. 消息加解密方式：明文模式
7. 提交（微信会调用 GET 验证签名）

### 7.4 验证

在微信公众号发一条消息，应收到 AI 客服回复。

---

## 8. 故障排查

### 8.1 GitHub Actions 失败

**查看日志：** GitHub 仓库 → Actions → 失败的 run → 展开失败步骤

**常见原因：**

| 错误 | 排查 |
|------|------|
| `Permission denied (publickey)` | SSH_PRIVATE_KEY 未配置或与服务器公钥不匹配；用 `ssh -i <key> root@IP` 本地验证 |
| `rsync: connection unexpectedly closed` | 服务器 SSH 端口不对；检查 DEPLOY_SSH_PORT |
| `rsync: failed to set times` | 服务器目录权限问题；`chown -R root:root /opt/yousen` |
| `./deploy.sh: No such file` | DEPLOY_PATH 路径不对；首次需手动 `git clone` |
| `deploy.sh exited with code 1` | 业务容器启动失败；SSH 上服务器看 `docker compose logs` |

### 8.2 rsync 失败

```bash
# 本地手动测试 rsync
rsync -avz --dry-run \
  --exclude='.git/' --exclude='node_modules/' --exclude='.env' \
  -e ssh \
  ./ root@<SERVER_IP>:/opt/yousen/
```

`--dry-run` 模拟运行，不实际传输。

### 8.3 deploy.sh 各阶段失败

| 阶段 | 失败原因 | 排查命令 |
|------|---------|---------|
| 基础设施健康检查超时 | postgres/redis/meilisearch 启动慢 | `docker compose logs postgres redis meilisearch` |
| backend 健康检查超时 | Strapi 启动失败（DB 连接、APP_KEYS 错误） | `docker compose logs backend` |
| frontend 健康检查超时 | Next.js build 失败（NEXT_PUBLIC_STRAPI_API_URL 错误） | `docker compose logs frontend` |
| nginx 启动失败 | nginx.conf 语法错误 | `docker compose exec nginx nginx -t` |

### 8.4 Agent 连不上 central

```bash
# 查看 agent 日志
docker logs yousen-agent

# 常见错误
# "ECONNREFUSED" → central 服务器未运行或防火墙挡了 443
# "401 Unauthorized" → AGENT_TOKEN 已被吊销，需重新注册
# "404 Not Found" → CENTRAL_WS_URL 路径不对
# "ws close code 4001" → token 被吊销
```

验证 central 可达：
```bash
curl -I https://<CENTRAL_DOMAIN>/api/agent/ws
```

---

## 9. 手动离线部署（GitHub 完全不可用）

> **场景：** GitHub 宕机或被墙，GitHub Actions 无法触发。

### 9.1 本地打包代码

```bash
# 在本地项目根目录
tar --exclude='.git' --exclude='node_modules' --exclude='.next' \
    --exclude='dist' --exclude='build' \
    --exclude='.env' --exclude='*.log' --exclude='data' \
    --exclude='strapi_*' --exclude='.cache' --exclude='.npmrc' \
    --exclude='central' --exclude='agent' \
    -czf /tmp/yousen-deploy.tar.gz .

# 验证包大小
ls -lh /tmp/yousen-deploy.tar.gz
```

### 9.2 上传到服务器

```bash
scp /tmp/yousen-deploy.tar.gz root@<SERVER_IP>:/tmp/
```

### 9.3 服务器解压并部署

```bash
ssh root@<SERVER_IP>
cd /opt/yousen
# 备份当前代码（可选）
mv backend backend.bak.$(date +%s) 2>/dev/null || true
mv frontend-next frontend-next.bak.$(date +%s) 2>/dev/null || true

# 解压覆盖
tar -xzf /tmp/yousen-deploy.tar.gz -C /opt/yousen/

# 部署
./deploy.sh --no-pull --nginx -d

# 清理
rm /tmp/yousen-deploy.tar.gz
```

### 9.4 一键脚本

上述步骤已合并为 [scripts/offline-deploy.sh](../scripts/offline-deploy.sh)（本地执行）：

```bash
# 用法
./scripts/offline-deploy.sh <SERVER_IP> [DEPLOY_PATH]
# 示例
./scripts/offline-deploy.sh 1.2.3.4 /opt/yousen
```

脚本内容（供参考，实际使用仓库中的 [scripts/offline-deploy.sh](../scripts/offline-deploy.sh)）：

```bash
#!/bin/bash
# 用法：./scripts/offline-deploy.sh <SERVER_IP> [DEPLOY_PATH]
set -euo pipefail
SERVER_IP="${1:?Usage: $0 <SERVER_IP> [DEPLOY_PATH]}"
DEPLOY_PATH="${2:-/opt/yousen}"

echo "[1/4] 打包代码..."
tar --exclude='.git' --exclude='node_modules' --exclude='.next' \
    --exclude='dist' --exclude='build' \
    --exclude='.env' --exclude='*.log' --exclude='data' \
    --exclude='strapi_*' --exclude='.cache' --exclude='.npmrc' \
    --exclude='central' --exclude='agent' \
    -czf /tmp/yousen-deploy.tar.gz .

echo "[2/4] 上传到 $SERVER_IP:$DEPLOY_PATH..."
scp /tmp/yousen-deploy.tar.gz root@$SERVER_IP:/tmp/

echo "[3/4] 远程解压..."
ssh root@$SERVER_IP "cd $DEPLOY_PATH && tar -xzf /tmp/yousen-deploy.tar.gz && rm /tmp/yousen-deploy.tar.gz"

echo "[4/4] 远程部署..."
ssh root@$SERVER_IP "cd $DEPLOY_PATH && ./deploy.sh --no-pull --nginx -d"

echo "✅ 离线部署完成"
```

---

## 10. Central + 客户业务同机部署运维

> **适用场景**：Central 管理后台与客户业务系统部署在同一台服务器（如当前 `124.223.1.67`），需要统一运维管理。
> **当前部署**：
> - Central：`/opt/central/`（3 容器：central-postgres / central-app / central-nginx）
> - 客户业务：`/opt/customer-site/`（6 容器：yousen-postgres / yousen-redis / yousen-meilisearch / yousen-backend / yousen-frontend / agent）
> - 共 9 个 Docker 容器同时运行

### 10.1 资源监控

同机部署需关注内存、CPU、磁盘三项资源，避免因资源耗尽导致 OOM 或服务降级。

#### 10.1.1 实时资源查看

```bash
# 内存（关注 available，应保持 ≥ 500MB）
free -h

# CPU 负载（关注 1/5/15 分钟平均负载，应 < CPU 核数 × 2）
uptime

# 磁盘使用（关注 / 分区，应保持 ≥ 20% 可用）
df -h

# Docker 容器资源占用（实时刷新）
docker stats --no-stream
```

#### 10.1.2 容器内存占用排序

```bash
# 按内存占用从高到低列出所有容器
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.CPUPerc}}" | sort -k2 -h -r
```

#### 10.1.3 资源告警阈值

| 指标 | 告警阈值 | 处理方式 |
|------|---------|---------|
| 可用内存 | < 300MB | 见 10.1.4 内存不足处理 |
| CPU 15 分钟负载 | > 4.0 | 排查高负载容器：`docker stats` |
| 磁盘可用 | < 10GB | 清理：`docker system prune -f` + 清理日志 |
| Swap 使用率 | > 50% | 检查内存压力，考虑加 swap |

#### 10.1.4 内存不足处理

```bash
# 1. 查看是否有 OOM 记录
dmesg | grep -i 'killed process' | tail -20

# 2. 清理无用镜像/构建缓存
docker system prune -f

# 3. 重启内存占用高的容器（如 Strapi 长期运行内存增长）
docker restart yousen-backend
sleep 60
docker compose -f /opt/customer-site/docker-compose.yml ps

# 4. 增加 swap（如尚未配置 2G）
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 5. 限制容器内存（编辑 docker-compose.yml）
#   backend 服务追加：
#   deploy:
#     resources:
#       limits:
#         memory: 1G
```

#### 10.1.5 磁盘清理

```bash
# 清理停止的容器、无用网络、悬空镜像
docker system prune -f

# 清理无用的卷（谨慎！会删除未被任何容器使用的卷）
# 先查看有哪些卷：
docker volume ls -f dangling=true
# 确认无用后再删除：
docker volume prune -f

# 清理 Central 日志（保留最近 7 天）
find /var/log/central-backup.log* -mtime +7 -delete 2>/dev/null || true

# 清理 Docker 容器日志（限制单个日志文件大小）
# 编辑 /etc/docker/daemon.json 追加：
#   "log-opts": { "max-size": "50m", "max-file": "3" }
# 重启 Docker：systemctl restart docker（注意：会重启所有容器）
```

### 10.2 端口冲突排查

#### 10.2.1 端口规划（当前配置）

| 服务 | 端口 | 容器名 | 说明 |
|------|------|--------|------|
| Central Nginx | 80, 443 | central-nginx | 已占用 |
| Central App | 3000（容器内） | central-app | 不映射宿主机 |
| Central PostgreSQL | 仅容器内部 | central-postgres | 不映射宿主机 |
| 客户 PostgreSQL | 5432 | yousen-postgres | 不冲突 |
| 客户 Redis | 6379 | yousen-redis | 不冲突 |
| 客户 MeiliSearch | 7700 | yousen-meilisearch | 不冲突 |
| 客户 Strapi | 1337 | yousen-backend | 不冲突 |
| 客户 Next.js | 3001 | yousen-frontend | 不冲突（Central 3000 不映射宿主） |
| Agent | 无外部端口 | agent | WebSocket 连 Central |

> **关键**：客户业务 `FRONTEND_PORT=3001` 而非 3000，避免与 Central 容器内的 3000 端口冲突。

#### 10.2.2 端口占用排查

```bash
# 查看所有容器端口映射
docker ps --format "table {{.Names}}\t{{.Ports}}"

# 排查某端口占用（以 3001 为例）
sudo lsof -i :3001
sudo lsof -i :1337
sudo lsof -i :80
sudo lsof -i :443

# 或使用 netstat
sudo netstat -tulpn | grep -E ':(3001|1337|80|443|5432|6379|7700)'

# 测试端口连通性
curl -I http://localhost:3001/
curl http://localhost:1337/_health
curl -I https://central.tishensnoopy.cloud/
```

#### 10.2.3 端口冲突解决

如果 `docker compose up` 报 `port is already allocated`：

```bash
# 1. 找出占用进程
sudo lsof -i :<端口号>

# 2a. 如果是其他 Docker 容器占用
docker ps -a | grep <端口号>
docker stop <容器名>

# 2b. 如果是宿主机进程占用
sudo kill <PID>

# 3. 如果需要修改客户业务端口（编辑 /opt/customer-site/.env）
nano /opt/customer-site/.env
# 修改 FRONTEND_PORT=3002 或 BACKEND_PORT=1338

# 4. 重新启动
cd /opt/customer-site
docker compose up -d frontend
```

### 10.3 Docker 容器统一管理

#### 10.3.1 查看所有容器（Central + 客户业务）

```bash
# 查看所有运行中的容器（跨 compose 项目）
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 查看所有容器（含已停止）
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 按名称前缀过滤
docker ps -a --filter "name=central-" --format "table {{.Names}}\t{{.Status}}"
docker ps -a --filter "name=yousen-" --format "table {{.Names}}\t{{.Status}}"
docker ps -a --filter "name=^agent$" --format "table {{.Names}}\t{{.Status}}"
```

#### 10.3.2 分组管理命令

```bash
# === Central 容器组 ===
cd /opt/central
docker compose ps              # 查看状态
docker compose restart         # 全量重启 Central
docker compose restart app     # 仅重启 app
docker compose down            # 停止全部 Central 容器
docker compose up -d           # 启动全部 Central 容器

# === 客户业务容器组 ===
cd /opt/customer-site
docker compose ps
docker compose restart
docker compose restart backend
docker compose down
docker compose up -d

# === Agent 单独管理 ===
docker restart agent           # 重启
docker stop agent              # 停止
DEPLOY_PATH=/opt/customer-site docker compose -f /opt/customer-site/scripts/agent-compose.yml up -d  # 启动
```

#### 10.3.3 容器健康检查

```bash
# 查看所有容器健康状态
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -v "^NAMES"

# 单独检查
docker inspect --format='{{.Name}}: {{.State.Health.Status}}' $(docker ps -q)
```

### 10.4 备份策略

#### 10.4.1 备份规划

| 系统 | 备份对象 | 频率 | 保留 | 备份方式 |
|------|---------|------|------|---------|
| Central | PostgreSQL 数据 | 每天 3:00 | 7 天 | crontab + `scripts/backup.sh`（已配置） |
| Central | SSL 证书 | 一次性 + 续期时 | 永久 | `/etc/letsencrypt/` |
| 客户业务 | PostgreSQL 数据 | 建议每天 3:30 | 7 天 | crontab + `pg_dump` |
| 客户业务 | Strapi 上传文件 | 建议每周 | 4 周 | tar 打包 uploads 卷 |
| 客户业务 | .env 配置 | 变更时 | 永久 | 手动备份 |

#### 10.4.2 Central 备份（已配置）

```bash
# 查看 Central 备份任务
crontab -l | grep central

# 手动触发 Central 备份
cd /opt/central && bash scripts/backup.sh

# 查看备份日志
tail -50 /var/log/central-backup.log

# 查看备份文件
ls -lh /opt/central/backups/ 2>/dev/null || ls -lh /opt/backups/ 2>/dev/null
```

#### 10.4.3 客户业务备份（需配置）

```bash
# 创建备份目录
mkdir -p /opt/backups/customer-site

# 手动备份客户业务数据库
docker compose -f /opt/customer-site/docker-compose.yml exec -T postgres \
  pg_dump -U strapi strapi > /opt/backups/customer-site/customer_$(date +%Y%m%d_%H%M%S).sql

# 配置自动备份（每天 3:30，保留 7 天）
crontab -e
# 追加以下内容：
30 3 * * * docker exec yousen-postgres pg_dump -U strapi strapi | gzip > /opt/backups/customer-site/customer_$(date +\%Y\%m\%d).sql.gz && find /opt/backups/customer-site/ -name 'customer_*.sql.gz' -mtime +7 -delete

# 验证 crontab
crontab -l | grep customer

# 备份 Strapi 上传文件（建议每周日 4:00）
0 4 * * 0 tar czf /opt/backups/customer-site/uploads_$(date +\%Y\%m\%d).tar.gz -C /var/lib/docker/volumes/ uploads/_data 2>/dev/null && find /opt/backups/customer-site/ -name 'uploads_*.tar.gz' -mtime +28 -delete
```

#### 10.4.4 备份恢复

```bash
# === 恢复 Central 数据库 ===
cd /opt/central
docker compose cp /opt/central/backups/<backup-file>.sql central-postgres:/tmp/
docker compose exec central-postgres psql -U central -d central -f /tmp/<backup-file>.sql

# === 恢复客户业务数据库 ===
cd /opt/customer-site
gunzip < /opt/backups/customer-site/<backup-file>.sql.gz | docker compose exec -T postgres psql -U strapi -d strapi
```

### 10.5 故障恢复

#### 10.5.1 单个容器重启

```bash
# Central 容器
docker restart central-postgres
docker restart central-app
docker restart central-nginx

# 客户业务容器
docker restart yousen-postgres
docker restart yousen-redis
docker restart yousen-meilisearch
docker restart yousen-backend
docker restart yousen-frontend
docker restart agent
```

#### 10.5.2 全量重启（按系统）

```bash
# 重启整个 Central
cd /opt/central
docker compose restart

# 重启整个客户业务
cd /opt/customer-site
docker compose restart

# 重启所有 9 个容器（一条命令）
docker restart central-postgres central-app central-nginx \
  yousen-postgres yousen-redis yousen-meilisearch \
  yousen-backend yousen-frontend agent
```

#### 10.5.3 容器降级/回滚

```bash
# === Central 回滚 ===
cd /opt/central
# 查看镜像历史（如果有多个版本）
docker images | grep central-app

# 回滚到上一个镜像版本（假设有 tag）
docker compose down app
docker tag central-app:previous central-app:latest
docker compose up -d app

# === 客户业务回滚 ===
cd /opt/customer-site
# 回滚到上一个 commit
git log --oneline -5
git checkout <previous-commit-sha>
docker compose up -d --build --no-deps backend frontend

# === 数据库回滚（如涉及 schema 变更）===
docker compose exec backend npm run strapi migration:down
```

#### 10.5.4 全量重启后的健康检查流程

```bash
# 1. 等待 60 秒让所有容器启动
sleep 60

# 2. 查看所有容器状态
docker ps --format "table {{.Names}}\t{{.Status}}"

# 3. 验证 Central
curl -I https://central.tishensnoopy.cloud/

# 4. 验证客户业务
curl http://localhost:1337/_health
curl -I http://localhost:3001/

# 5. 验证 Agent 连接
docker logs --tail 20 agent | grep -i 'connected\|error'

# 6. 验证 Central 后台能看到 Agent 在线
# 浏览器登录 https://central.tishensnoopy.cloud → 服务器管理
```

### 10.6 日志查看

#### 10.6.1 Central 日志

```bash
# === 实时查看所有 Central 日志 ===
cd /opt/central
docker compose logs -f

# === 查看 Central app 日志（最近 100 行）===
docker compose logs --tail 100 app

# === 查看 Central nginx 访问日志 ===
docker compose exec nginx tail -f /var/log/nginx/access.log

# === 查看 Central nginx 错误日志 ===
docker compose exec nginx tail -f /var/log/nginx/error.log

# === 查看 Central PostgreSQL 慢查询日志 ===
docker compose exec postgres tail -f /var/lib/postgresql/data/log/*.log 2>/dev/null || \
  docker compose logs --tail 100 postgres
```

#### 10.6.2 客户业务日志

```bash
# === 实时查看所有客户业务日志 ===
cd /opt/customer-site
docker compose logs -f

# === 查看 Strapi backend 日志（最近 200 行）===
docker compose logs --tail 200 backend

# === 查看 Next.js frontend 日志 ===
docker compose logs --tail 100 frontend

# === 查看 PostgreSQL 日志 ===
docker compose logs --tail 100 postgres

# === 查看 Redis 日志 ===
docker compose logs --tail 50 redis

# === 查看 MeiliSearch 日志 ===
docker compose logs --tail 50 meilisearch

# === 查看 Agent 日志（连接 Central 的 WebSocket）===
docker logs --tail 100 agent
docker logs -f agent
```

#### 10.6.3 日志聚合查看

```bash
# 同时查看 Central app + 客户业务 backend 的最近日志
docker logs --tail 50 central-app
docker logs --tail 50 yousen-backend

# 查看 Agent 与 Central 的连接日志
docker logs agent 2>&1 | grep -iE 'connect|disconnect|error|heartbeat'

# 查看所有容器的最近错误日志
for c in central-postgres central-app central-nginx \
         yousen-postgres yousen-redis yousen-meilisearch \
         yousen-backend yousen-frontend agent; do
  echo "=== $c ==="
  docker logs --tail 20 "$c" 2>&1 | grep -iE 'error|fail|fatal' | tail -5
done
```

#### 10.6.4 日志轮转配置

避免日志撑爆磁盘，建议配置 Docker 日志轮转：

```bash
# 编辑 /etc/docker/daemon.json（追加 log-opts）
cat /etc/docker/daemon.json

# 修改为（在原有配置基础上追加 log-opts）：
tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me",
    "https://docker.m.daocloud.io"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  }
}
EOF

# 重启 Docker 生效（注意：会重启所有容器）
systemctl daemon-reload
systemctl restart docker
```

### 10.7 同机部署运维速查

| 任务 | 命令 |
|------|------|
| 查看所有 9 个容器 | `docker ps --format "table {{.Names}}\t{{.Status}}"` |
| 查看内存 | `free -h` |
| 查看磁盘 | `df -h` |
| 查看 CPU 负载 | `uptime` |
| 容器资源占用 | `docker stats --no-stream` |
| Central 日志 | `cd /opt/central && docker compose logs -f app` |
| 客户业务日志 | `cd /opt/customer-site && docker compose logs -f backend` |
| Agent 日志 | `docker logs -f agent` |
| 重启单个容器 | `docker restart <容器名>` |
| 重启 Central | `cd /opt/central && docker compose restart` |
| 重启客户业务 | `cd /opt/customer-site && docker compose restart` |
| Central 备份 | `cd /opt/central && bash scripts/backup.sh` |
| 客户业务备份 | `docker exec yousen-postgres pg_dump -U strapi strapi \| gzip > /opt/backups/customer-site/customer_$(date +%Y%m%d).sql.gz` |
| 验证 Central | `curl -I https://central.tishensnoopy.cloud/` |
| 验证客户前端 | `curl -I http://localhost:3001/` |
| 验证客户后端 | `curl http://localhost:1337/_health` |
| 验证 Agent | `docker logs --tail 20 agent \| grep -i connected` |

---

## 附录：密钥生成速查

```bash
# 生成 32 字节 base64 随机字符串
openssl rand -base64 32

# 生成 4 个 APP_KEYS（逗号分隔）
for i in $(seq 1 4); do openssl rand -base64 32; done | paste -sd,

# 生成 ed25519 SSH key
ssh-keygen -t ed25519 -C "github-actions-deploy@yousen" -f ~/.ssh/yousen-deploy

# 生成 32 位 enrollment code（在 central 后台点按钮即可，无需手动）
```
