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
