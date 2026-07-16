# 完整部署指南（小白版）

> **本文档面向非技术用户**。每一个操作步骤都包含 5 个要素：
> 1. **操作目的**：为什么做这一步
> 2. **具体命令**：可直接复制执行的命令
> 3. **预期输出**：看到什么表示成功
> 4. **失败处理**：出错了怎么办
> 5. **完成标志**：如何确认这一步完成
>
> **当前部署成果（2026-07-16）**：
> - Central 管理后台：https://central.tishensnoopy.cloud ✅
> - 客户业务系统：http://124.223.1.67:3001 ✅（6 个 Docker 容器全部运行）
> - Strapi v5.50.1 + Next.js 15.5.20 + Agent（已连接 Central）
> - 部署 commit：`4cc6f16`

---

## 目录

- [第一部分：部署前准备](#第一部分部署前准备)
  - [1.1 服务器要求](#11-服务器要求)
  - [1.2 域名规划](#12-域名规划)
  - [1.3 SSH 登录信息](#13-ssh-登录信息)
- [第二部分：Central 管理后台部署](#第二部分central-管理后台部署)
  - [2.1 服务器初始化](#21-服务器初始化)
  - [2.2 配置 Docker 镜像加速](#22-配置-docker-镜像加速)
  - [2.3 部署 Central 服务](#23-部署-central-服务)
  - [2.4 配置域名 DNS](#24-配置域名-dns)
  - [2.5 申请 SSL 证书](#25-申请-ssl-证书)
  - [2.6 Central 初始化与备份](#26-central-初始化与备份)
- [第三部分：客户业务系统部署](#第三部分客户业务系统部署)
  - [3.1 在 Central 创建客户记录](#31-在-central-创建客户记录)
  - [3.2 同步代码到服务器](#32-同步代码到服务器)
  - [3.3 移动文件到部署目录](#33-移动文件到部署目录)
  - [3.4 配置 .env 环境变量](#34-配置-env-环境变量)
  - [3.5 分步启动 Docker 容器](#35-分步启动-docker-容器)
  - [3.6 初始化 Strapi 超级管理员](#36-初始化-strapi-超级管理员)
  - [3.7 注册 Agent 到 Central](#37-注册-agent-到-central)
- [第四部分：部署后验证](#第四部分部署后验证)
  - [4.1 容器健康检查](#41-容器健康检查)
  - [4.2 端口连通性验证](#42-端口连通性验证)
  - [4.3 功能验证清单](#43-功能验证清单)
  - [4.4 Central 后台验证](#44-central-后台验证)
- [第五部分：常见问题排查](#第五部分常见问题排查)
  - [5.1 容器不启动](#51-容器不启动)
  - [5.2 前端构建失败](#52-前端构建失败)
  - [5.3 Agent 连接 Central 失败](#53-agent-连接-central-失败)
  - [5.4 Docker 镜像拉取失败](#54-docker-镜像拉取失败)
  - [5.5 Strapi 后台无法访问](#55-strapi-后台无法访问)
  - [5.6 端口冲突](#56-端口冲突)
  - [5.7 内存不足导致 OOM](#57-内存不足导致-oom)
- [第六部分：速查表](#第六部分速查表)
  - [6.1 端口对照表](#61-端口对照表)
  - [6.2 目录结构](#62-目录结构)
  - [6.3 常用命令](#63-常用命令)
  - [6.4 账号信息](#64-账号信息)
  - [6.5 已知遗留问题](#65-已知遗留问题)

---

## 第一部分：部署前准备

### 1.1 服务器要求

**操作目的**：确认服务器配置满足部署要求，避免因资源不足导致部署失败。

**当前服务器配置（已验证可用）**：

| 项目 | 要求 | 当前配置 | 状态 |
|------|------|---------|------|
| 操作系统 | Ubuntu 22.04 LTS / Debian 12 | Ubuntu | ✅ |
| CPU | 至少 2 核 | 2 核 | ✅ |
| 内存 | 至少 3.5GB（含 swap） | 3.6G + 2G swap | ✅ |
| 磁盘 | 至少 40GB | 已验证 | ✅ |
| Docker | 24+ | 已安装 | ✅ |
| Docker Compose | v2 | 已安装 | ✅ |
| 公网入站端口 | 22 / 80 / 443 / 1337 / 3001 | 已开放（3001/1337 待开放）| ⚠️ |

**具体命令**（登录服务器后执行）：

```bash
ssh root@124.223.1.67

# 检查内存
free -h

# 检查磁盘
df -h

# 检查 Docker
docker --version
docker compose version
```

**预期输出**：

```
$ free -h
               total        used        free      shared  buff/cache   available
Mem:           3.6Gi       1.5Gi       500Mi        50Mi       1.6Gi       1.8Gi
Swap:          2.0Gi       100Mi       1.9Gi

$ docker --version
Docker version 24.x.x
$ docker compose version
Docker Compose version v2.x.x
```

**失败处理**：

- **内存不足**：添加 swap（参考：`fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`），并在 `/etc/fstab` 中追加 `/swapfile none swap sw 0 0` 持久化
- **Docker 未安装**：执行 `curl -fsSL https://get.docker.com | sh`
- **磁盘满**：执行 `docker system prune -a --volumes` 清理无用镜像和卷（**注意：会删除未使用的卷，确认无重要数据**）

**完成标志**：`free -h` 显示可用内存 ≥1GB；`docker --version` 输出非空。

---

### 1.2 域名规划

**操作目的**：明确每个域名指向哪个服务，避免后期 DNS 配置混乱。

**当前域名规划**：

| 域名 | 解析 IP | 服务 | 状态 |
|------|---------|------|------|
| `central.tishensnoopy.cloud` | 124.223.1.67 | Central 管理后台 | ✅ 已配置 + SSL |
| `yousen.tishensnoopy.cloud` | 124.223.1.67 | 客户业务系统（预留） | ⚠️ DNS 未配置 |

**具体命令**（在本地电脑验证 DNS）：

```bash
dig +short central.tishensnoopy.cloud
# 应返回 124.223.1.67

dig +short yousen.tishensnoopy.cloud
# 当前无返回（待配置）
```

**预期输出**：

```
124.223.1.67
```

**失败处理**：

- **DNS 不生效**：登录域名注册商控制台（Cloudflare/阿里云/腾讯云），添加 A 记录
  - 主机记录：`central` → 记录值：`124.223.1.67`
  - 主机记录：`yousen` → 记录值：`124.223.1.67`
- **DNS 缓存**：等待 5-30 分钟生效；本地可执行 `sudo systemd-resolve --flush-caches` 清缓存

**完成标志**：`dig +short central.tishensnoopy.cloud` 返回 `124.223.1.67`。

---

### 1.3 SSH 登录信息

**操作目的**：确认能登录服务器，并具备 root 权限（部署需要 root）。

**当前 SSH 信息**：

- 服务器 IP：`124.223.1.67`
- SSH 端口：`22`（默认）
- 登录用户：`root`（或 `ubuntu` 后 `sudo -i`）
- 认证方式：SSH key（推荐）或密码

**具体命令**（在本地电脑执行）：

```bash
ssh root@124.223.1.67
# 或
ssh ubuntu@124.223.1.67
sudo -i
```

**预期输出**：

```
Welcome to Ubuntu 22.04.x LTS
root@server:~#
```

**失败处理**：

- **Permission denied (publickey)**：本地 SSH key 未配置到服务器 `~/.ssh/authorized_keys`，用密码登录后执行 `ssh-copy-id root@124.223.1.67`
- **Connection timeout**：腾讯云安全组未开放 22 端口，登录控制台开放
- **密码登录**：`ssh root@124.223.1.67` 输入密码即可

**完成标志**：命令行提示符变为 `root@server:~#`。

---

## 第二部分：Central 管理后台部署

> **当前状态**：Central 已部署完成并稳定运行。本章记录的是部署过程，用于参考或重装时使用。

### 2.1 服务器初始化

**操作目的**：更新系统包，安装 Docker。

**具体命令**：

```bash
# 更新系统
apt-get update && apt-get upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 验证
docker --version
docker compose version
```

**预期输出**：

```
Docker version 24.x.x, build xxxxxxx
Docker Compose version v2.x.x
```

**失败处理**：

- **apt-get 失败**：检查 `/etc/apt/sources.list` 是否使用国内镜像源（推荐阿里云 `mirrors.aliyun.com` 或清华 `mirrors.tuna.tsinghua.edu.cn`）
- **Docker 安装失败**：参考官方文档 `https://docs.docker.com/engine/install/ubuntu/`

**完成标志**：`docker --version` 输出非空。

---

### 2.2 配置 Docker 镜像加速

**操作目的**：国内服务器访问 Docker Hub 受限，配置加速器避免拉镜像超时。

**具体命令**：

```bash
# 创建配置目录
mkdir -p /etc/docker

# 写入加速器配置
tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me",
    "https://docker.m.daocloud.io"
  ]
}
EOF

# 重新加载并重启 Docker
systemctl daemon-reload
systemctl restart docker

# 验证
docker info | grep -A5 "Registry Mirrors"
```

**预期输出**：

```
Registry Mirrors:
  https://docker.1ms.run/
  https://docker.xuanyuan.me/
  https://docker.m.daocloud.io/
```

**失败处理**：

- **加速器失效**：替换为最新可用的镜像源（参考 `https://github.com/dongyubin/docker-mirror`)
- **Docker 重启失败**：检查 `daemon.json` JSON 语法是否正确（`cat /etc/docker/daemon.json | python3 -m json.tool`）

**完成标志**：`docker info` 中能看到 Registry Mirrors 列表。

---

### 2.3 部署 Central 服务

**操作目的**：在服务器上启动 Central 的 3 个 Docker 容器（postgres + app + nginx）。

**当前部署目录**：`/opt/central/`

**具体命令**：

```bash
# 切换到 Central 部署目录
cd /opt/central

# 检查 .env 已配置（关键字段）
grep -E '^(INITIAL_ADMIN_PASSWORD|AES_KEY|DATABASE_URL|JWT_SECRET)=' .env

# 启动 Central
docker compose up -d

# 等待 30 秒后查看状态
sleep 30
docker compose ps
```

**预期输出**：

```
NAME                 IMAGE                COMMAND                  STATUS                    PORTS
central-postgres     postgres:16-alpine   "docker-entrypoint.s…"   Up 30 seconds (healthy)   5432/tcp
central-app          central-app          "docker-entrypoint.s…"   Up 25 seconds (healthy)   3000/tcp
central-nginx        nginx:alpine         "nginx -g 'daemon off"   Up 20 seconds             0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

**失败处理**：

- **postgres 启动失败**：检查 `.env` 中 `DATABASE_PASSWORD` 是否与原数据卷密码一致；首次部署需初始化数据卷
- **app 启动失败**：查看日志 `docker compose logs app`，常见原因：`AES_KEY` 长度不对（必须 base64 解码后 32 字节）
- **nginx 端口占用**：80/443 已被占用，执行 `docker ps | grep -E ':80|:443'` 找出占用容器并停止

**完成标志**：`docker compose ps` 显示 3 个容器状态为 `Up`（postgres 和 app 应为 `healthy`）。

---

### 2.4 配置域名 DNS

**操作目的**：让 `central.tishensnoopy.cloud` 指向服务器 IP，外部才能访问。

**具体操作**（在域名注册商控制台）：

1. 登录域名注册商控制台（如 Cloudflare、阿里云、腾讯云）
2. 找到 DNS 解析设置
3. 添加 A 记录：
   - 主机记录：`central`
   - 记录类型：`A`
   - 记录值：`124.223.1.67`
   - TTL：默认（600 秒）

**验证命令**（5-30 分钟后执行）：

```bash
dig +short central.tishensnoopy.cloud
```

**预期输出**：

```
124.223.1.67
```

**失败处理**：

- **dig 无返回**：DNS 未生效，再等 10 分钟；或检查记录是否填错
- **返回错误 IP**：CDN 代理（如 Cloudflare 橙色云）会导致解析到 CDN IP，不影响后续 SSL

**完成标志**：dig 返回 `124.223.1.67`（或 CDN 代理 IP）。

---

### 2.5 申请 SSL 证书

**操作目的**：让 Central 支持 HTTPS 访问（浏览器不再提示"不安全"）。

**具体命令**：

```bash
# 安装 certbot
apt-get install -y certbot

# 先临时停止 nginx（80 端口给 certbot 用）
docker compose -f /opt/central/docker-compose.yml stop nginx

# 申请证书（standalone 模式）
certbot certonly --standalone \
  -d central.tishensnoopy.cloud \
  --non-interactive --agree-tos \
  -m tishensnoopy@petalmail.com

# 重启 nginx
docker compose -f /opt/central/docker-compose.yml start nginx

# 验证证书
ls /etc/letsencrypt/live/central.tishensnoopy.cloud/
```

**预期输出**：

```
Saving full chain to /etc/letsencrypt/live/central.tishensnoopy.cloud/fullchain.pem
...
- Congratulations! Your certificate and chain have been saved at:
  /etc/letsencrypt/live/central.tishensnoopy.cloud/fullchain.pem
  /etc/letsencrypt/live/central.tishensnoopy.cloud/privkey.pem

$ ls /etc/letsencrypt/live/central.tishensnoopy.cloud/
cert.pem  chain.pem  fullchain.pem  privkey.pem  README
```

**失败处理**：

- **端口 80 被占用**：先停 nginx（见上方命令），申请完再启动
- **DNS 未生效**：先确认 2.4 已完成
- **证书签发失败**：检查防火墙是否放行 80 端口；或用 `--staging` 先测试（避免触发限流）

**完成标志**：`ls /etc/letsencrypt/live/central.tishensnoopy.cloud/` 能看到 `fullchain.pem` 和 `privkey.pem`。

---

### 2.6 Central 初始化与备份

**操作目的**：创建超级管理员账号，配置自动备份避免数据丢失。

**具体命令**：

```bash
cd /opt/central

# 1. 初始化数据库 schema + seed 超级管理员
docker compose exec app npm run db:seed

# 2. 配置每天凌晨 3 点自动备份
crontab -e
# 在文件末尾追加（保留 7 天）：
0 3 * * * cd /opt/central && bash scripts/backup.sh >> /var/log/central-backup.log 2>&1
```

**预期输出**（db:seed 成功）：

```
✅ Database seeded successfully
✅ Super admin created: tishensnoopy@petalmail.com
```

**失败处理**：

- **seed 失败**：检查 `.env` 中 `INITIAL_ADMIN_PASSWORD` 是否设置；`AES_KEY` 是否为 32 字节 base64
- **无法登录 Central**：浏览器访问 `https://central.tishensnoopy.cloud/login`，账号 `tishensnoopy@petalmail.com` / 密码 `Hym465964665`

**完成标志**：
1. `db:seed` 命令输出 `✅ Database seeded successfully`
2. 浏览器能访问 `https://central.tishensnoopy.cloud/login` 并登录成功
3. `crontab -l` 能看到备份任务

---

## 第三部分：客户业务系统部署

> **当前状态**：客户业务系统已部署完成，6 个容器全部运行。本章记录部署全过程。

### 3.1 在 Central 创建客户记录

**操作目的**：在 Central 后台注册一个客户，生成 Agent 注册所需的 enrollment code。

**具体操作**（浏览器操作）：

1. 登录 `https://central.tishensnoopy.cloud/login`
   - 账号：`tishensnoopy@petalmail.com`
   - 密码：`Hym465964665`

2. 左侧菜单 →「客户管理」→「新建客户」
   - 客户名称：`佑森小课堂`
   - 域名：`yousen.tishensnoopy.cloud`（或留空）
   - 保存

3. 进入客户详情页 → 点击「生成注册码」
   - 记录注册码（格式：`ABCD1234EFGH5678`）
   - **有效期 24 小时**，过期需重新生成

4. 左侧菜单 →「配置管理」→ 为该客户创建配置版本
   - 填写必要参数（域名、数据库密码等）
   - 点击「发布」

**预期输出**：客户详情页显示「在线」状态；配置版本为 `v1 published`。

**失败处理**：

- **登录 401**：执行 `cd /opt/central && docker compose exec app npm run db:seed` 重新初始化管理员
- **生成注册码报错**：检查 `AES_KEY` 是否正确（参考 2.6 失败处理）

**完成标志**：
1. Central 后台能看到「佑森小课堂」客户
2. 已生成并记录 enrollment code
3. 客户配置已发布

---

### 3.2 同步代码到服务器

**操作目的**：将本地代码同步到服务器，供 Docker 构建使用。

**具体命令**（在**本地电脑**执行，不是服务器）：

```bash
cd /home/tishensnoopy/project/superpowers-zh

# rsync 同步到服务器 /tmp/customer-site/
rsync -avz --progress \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.env*' \
  --exclude='.next/' \
  --exclude='test-results/' \
  --exclude='central/' \
  ./ root@124.223.1.67:/tmp/customer-site/

# 重要：单独补传 .env.example（避免被 --exclude='.env*' 误排除）
rsync -avz .env.example root@124.223.1.67:/tmp/customer-site/.env.example
```

**预期输出**：

```
sending incremental file list
...
sent 12.34M bytes  received 1.23K bytes  3.45M bytes/sec
total size: 56.78M  speedup is 4.61
```

**失败处理**：

- **rsync 报错 `permission denied`**：检查 SSH key 或用密码登录 `ssh root@124.223.1.67`
- **rsync 报错 `connection closed`**：网络问题，重试；或先压缩后传输 `tar czf /tmp/site.tar.gz --exclude=node_modules . && scp /tmp/site.tar.gz root@124.223.1.67:/tmp/`
- **遗漏 .env.example**：必须执行第 2 条 rsync 命令补传，否则后续 `cp .env.example .env` 会失败

**完成标志**：
1. 本地执行 `ssh root@124.223.1.67 "ls /tmp/customer-site/ | head"` 能看到 `backend/`、`frontend-next/`、`agent/`、`docker-compose.yml`、`.env.example`

---

### 3.3 移动文件到部署目录

**操作目的**：将临时目录的代码移动到正式部署目录 `/opt/customer-site/`。

**具体命令**（SSH 登录服务器后执行）：

```bash
ssh root@124.223.1.67

# 创建部署目录
mkdir -p /opt/customer-site

# 移动文件（包含隐藏文件 .env.example）
cp -r /tmp/customer-site/. /opt/customer-site/

# 修改属主
chown -R root:root /opt/customer-site

# 清理临时目录
rm -rf /tmp/customer-site

# 切换到部署目录
cd /opt/customer-site

# 验证关键文件存在
ls -la .env.example docker-compose.yml deploy.sh backend/ frontend-next/ agent/
```

**预期输出**：

```
.env.example
docker-compose.yml
deploy.sh
backend/
frontend-next/
agent/
```

**失败处理**：

- **`cp` 报错 `No such file`**：rsync 未成功，回到 3.2 重新同步
- **`.env.example` 缺失**：rsync 被误排除，执行 `rsync -avz .env.example root@124.223.1.67:/tmp/customer-site/.env.example` 补传

**完成标志**：`ls -la /opt/customer-site/` 显示 `.env.example`、`docker-compose.yml`、`backend/`、`frontend-next/`、`agent/` 均存在。

---

### 3.4 配置 .env 环境变量

**操作目的**：为 Docker 容器提供运行所需的配置（数据库密码、端口、域名等）。

**具体命令**：

```bash
cd /opt/customer-site

# 复制模板
cp .env.example .env

# 生成所需的密钥（一次性生成所有，记录下来）
echo "=== APP_KEYS (4 个) ==="
for i in $(seq 1 4); do openssl rand -base64 32; done | paste -sd,
echo "=== 其他密钥 ==="
echo "API_TOKEN_SALT=$(openssl rand -base64 32)"
echo "ADMIN_JWT_SECRET=$(openssl rand -base64 32)"
echo "TRANSFER_TOKEN_SALT=$(openssl rand -base64 32)"
echo "JWT_SECRET=$(openssl rand -base64 32)"

# 编辑 .env
nano .env
```

**`.env` 关键配置（参考）**：

```env
# === 端口（与 Central 同机部署：前端用 3001 避免冲突）===
FRONTEND_PORT=3001
BACKEND_PORT=1337
POSTGRES_PORT=5432

# === 数据库 ===
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=YourStrongDbPassword2026!
DATABASE_SSL=false

# === Redis ===
REDIS_PASSWORD=YourStrongRedisPassword2026!

# === MeiliSearch ===
MEILI_MASTER_KEY=YourStrongMeiliKey2026!
MEILI_ENV=production

# === Strapi 安全密钥（用上面命令生成的值替换）===
APP_KEYS=<4 个 base64 密钥，逗号分隔>
API_TOKEN_SALT=<上面的值>
ADMIN_JWT_SECRET=<上面的值>
TRANSFER_TOKEN_SALT=<上面的值>
JWT_SECRET=<上面的值>

# === 前端 URL ===
NEXT_PUBLIC_STRAPI_API_URL=http://124.223.1.67:1337
NEXT_PUBLIC_SITE_URL=http://124.223.1.67:3001
STRAPI_API_URL_SSR=http://backend:1337

# === Agent（连接 Central）===
CENTRAL_WS_URL=wss://central.tishensnoopy.cloud/api/agent/ws
CENTRAL_API_URL=https://central.tishensnoopy.cloud
AGENT_TOKEN=
SERVER_ID=

# === AI 客服（占位符，需通过 Strapi Admin → Ai Config 配置真实 key）===
DASHSCOPE_API_KEY=sk-placeholder
```

**预期输出**：`cat .env` 显示所有字段已填写，无 `<placeholder>` 形式的密钥（除 `DASHSCOPE_API_KEY` 外）。

**失败处理**：

- **`openssl rand` 报错**：检查 `openssl` 是否安装：`apt-get install -y openssl`
- **nano 不会用**：用 `vim .env` 或 `vi .env`
- **APP_KEYS 格式错误**：必须是 4 个逗号分隔的 base64 字符串，形如 `key1,key2,key3,key4`

**完成标志**：
1. `grep -E '^(APP_KEYS|JWT_SECRET|DATABASE_PASSWORD)=' .env` 都有非空值
2. `FRONTEND_PORT=3001`（避免与 Central 冲突）
3. `CENTRAL_WS_URL=wss://central.tishensnoopy.cloud/api/agent/ws`

---

### 3.5 分步启动 Docker 容器

**操作目的**：分步启动 6 个容器，确保依赖关系正确（postgres 先启动 → backend 等 schema 建完 → frontend SSG 取数据）。

**具体命令**：

```bash
cd /opt/customer-site

# 步骤 1：启动基础设施（postgres + redis + meilisearch）
docker compose up -d postgres redis meilisearch

# 步骤 2：等待 30 秒让数据库健康
sleep 30
docker compose ps postgres redis meilisearch

# 步骤 3：构建并启动 backend（Strapi，约需 2-5 分钟首次构建）
docker compose up -d --build backend

# 步骤 4：等待 backend 健康（约 60 秒，Strapi 需要建表）
sleep 60
docker compose ps backend

# 步骤 5：构建并启动 frontend（Next.js SSG 需要后端数据）
docker compose up -d --build frontend

# 步骤 6：启动 Agent
docker compose -f docker-compose.yml -f scripts/agent-compose.yml up -d agent

# 步骤 7：查看所有容器状态
docker compose ps
```

**预期输出**（最后 `docker compose ps`）：

```
NAME                  STATUS                      PORTS
yousen-postgres       Up 2 minutes (healthy)      0.0.0.0:5432->5432/tcp
yousen-redis          Up 2 minutes (healthy)      0.0.0.0:6379->6379/tcp
yousen-meilisearch    Up 2 minutes (healthy)      0.0.0.0:7700->7700/tcp
yousen-backend        Up 1 minute (healthy)       0.0.0.0:1337->1337/tcp
yousen-frontend       Up 30 seconds (healthy)     0.0.0.0:3001->3000/tcp
agent                 Up 20 seconds              -
```

**失败处理**：

- **postgres 启动失败**：检查 `DATABASE_PASSWORD` 是否与已存在的数据卷密码一致；首次部署需 `docker volume rm pgdata` 后重启
- **backend 启动失败**：查看日志 `docker compose logs backend`
  - 报 `APP_KEYS error`：检查 .env 中 APP_KEYS 格式（4 个逗号分隔 base64）
  - 报 `ECONNREFUSED postgres:5432`：postgres 还没启动完，多等 30 秒再启动 backend
- **frontend 构建失败**：查看日志 `docker compose logs frontend`
  - 报 `SSG data fetch failed`：backend 未就绪，确认 `docker compose ps backend` 显示 healthy 后重新 `docker compose up -d --build frontend`
  - 报 `NEXT_PUBLIC_STRAPI_API_URL not set`：检查 .env 中该字段是否正确
- **构建超时**：内存不足，先 `docker system prune -f` 清理，或增加 swap

**完成标志**：`docker compose ps` 显示 6 个容器全部 `Up`，postgres/redis/meilisearch/backend/frontend 状态为 `(healthy)`。

---

### 3.6 初始化 Strapi 超级管理员

**操作目的**：首次访问 Strapi 后台需要创建超级管理员账号。

**具体操作**（浏览器）：

1. 访问 `http://124.223.1.67:1337/admin`
2. 首次进入会显示注册页面，填写：
   - 名：`Admin`
   - 姓：`Yousen`
   - 邮箱：`tishensnoopy@petalmail.com`
   - 密码：`Hym465964665`
   - 确认密码：同上
3. 点击「Let's start」按钮

**预期输出**：跳转到 Strapi 控制台首页，显示「Welcome to Strapi」。

**失败处理**：

- **页面打不开**：
  1. 确认 1337 端口已在腾讯云安全组开放
  2. 确认 `docker compose ps backend` 状态为 healthy
  3. 本地执行 `curl http://124.223.1.67:1337/_health` 返回 `OK`
- **已经被注册过**：说明之前已创建，直接用账号 `tishensnoopy@petalmail.com` / `Hym465964665` 登录
- **忘记密码**：进入容器手动重置：`docker compose exec backend npm run strapi admin:reset-password --email=tishensnoopy@petalmail.com --password=Hym465964665`

**完成标志**：
1. 浏览器能登录 `http://124.223.1.67:1337/admin`
2. 能看到 Strapi 控制台首页

---

### 3.7 注册 Agent 到 Central

**操作目的**：让客户业务系统的 Agent 容器连接到 Central，接受远程管理。

**当前已部署的 Agent Server ID**：`3bb67add-a6c5-4aa3-9040-e7b269c9d488`

**具体命令**：

```bash
cd /opt/customer-site

# 用 enrollment code 注册（替换 <你的注册码> 为 3.1 步骤生成的码）
docker run --rm \
  -v /opt/customer-site/.env:/app/agent.env \
  -e CENTRAL_API_URL=https://central.tishensnoopy.cloud \
  registry.cn-hangzhou.aliyuncs.com/yousen/agent:latest \
  register --enrollment-code <你的注册码>

# 验证 .env 已写入 AGENT_TOKEN 和 SERVER_ID
grep -E '^(AGENT_TOKEN|SERVER_ID)=' .env
```

**预期输出**：

```
✅ Agent registered successfully
Server ID: 3bb67add-a6c5-4aa3-9040-e7b269c9d488
Token saved to /app/agent.env

$ grep -E '^(AGENT_TOKEN|SERVER_ID)=' .env
AGENT_TOKEN=<long-token-string>
SERVER_ID=3bb67add-a6c5-4aa3-9040-e7b269c9d488
```

**失败处理**：

- **`enrollment code invalid`**：注册码已过期（24h 有效），在 Central 后台重新生成
- **`ECONNREFUSED central.tishensnoopy.cloud:443`**：DNS 未生效或 Central nginx 未启动，回到 2.4/2.5 修复
- **`401 Unauthorized`**：注册码已被消费过，重新生成
- **Agent 容器缺少 docker CLI（已知非阻断问题）**：不影响 Agent 通过 WebSocket 连接 Central，仅无法在容器内执行 docker 命令

**完成标志**：
1. `grep SERVER_ID .env` 输出非空
2. Central 后台 →「服务器管理」中能看到该 Agent，状态为「在线」

---

## 第四部分：部署后验证

### 4.1 容器健康检查

**操作目的**：确认所有 9 个 Docker 容器（Central 3 + 客户业务 6）正常运行。

**具体命令**：

```bash
# 查看所有容器（不分 compose 项目）
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 查看客户业务容器健康
cd /opt/customer-site
docker compose ps
```

**预期输出**：

```
NAMES                 STATUS                      PORTS
central-postgres      Up 3 hours (healthy)        5432/tcp
central-app           Up 3 hours (healthy)        3000/tcp
central-nginx         Up 3 hours                  0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
yousen-postgres       Up 2 hours (healthy)        0.0.0.0:5432->5432/tcp
yousen-redis          Up 2 hours (healthy)        0.0.0.0:6379->6379/tcp
yousen-meilisearch    Up 2 hours (healthy)        0.0.0.0:7700->7700/tcp
yousen-backend        Up 2 hours (healthy)        0.0.0.0:1337->1337/tcp
yousen-frontend       Up 2 hours (healthy)        0.0.0.0:3001->3000/tcp
agent                 Up 2 hours                  -
```

**失败处理**：

- **某容器状态为 `Restarting`**：查看日志 `docker logs <容器名>` 找原因
- **状态为 `unhealthy`**：等待 60 秒重查；仍 unhealthy 则查日志
- **状态为 `Exited`**：执行 `docker compose up -d <服务名>` 重启

**完成标志**：所有 9 个容器状态为 `Up`，关键服务（postgres/redis/meilisearch/backend/frontend）为 `(healthy)`。

---

### 4.2 端口连通性验证

**操作目的**：验证各服务端口可访问，确认防火墙/安全组配置正确。

**具体命令**（在本地电脑或服务器执行）：

```bash
# Central HTTPS
curl -I https://central.tishensnoopy.cloud/
# 应返回 200/302/301

# 客户前端
curl -I http://124.223.1.67:3001/
# 应返回 200

# 客户后端健康检查
curl http://124.223.1.67:1337/_health
# 应返回 OK 或 {"status":"ok"}

# Strapi 后台
curl -I http://124.223.1.67:1337/admin
# 应返回 200
```

**预期输出**：

```
$ curl -I https://central.tishensnoopy.cloud/
HTTP/2 200
server: nginx
...

$ curl http://124.223.1.67:1337/_health
OK
```

**失败处理**：

- **3001/1337 不通**：
  1. 登录腾讯云控制台 → 安全组 → 添加入站规则：TCP 3001、TCP 1337
  2. 服务器本地执行 `curl http://localhost:3001/` 确认服务正常
- **Central HTTPS 不通**：检查 nginx 容器状态、SSL 证书是否过期
- **超时**：检查腾讯云安全组 + 服务器防火墙 `ufw status`

**完成标志**：4 个 curl 命令全部返回 2xx 状态码。

---

### 4.3 功能验证清单

**操作目的**：逐项验证客户业务系统的关键功能。

**验证清单**（浏览器访问 `http://124.223.1.67:3001/`）：

| # | 功能 | 访问地址 | 预期结果 | 状态 |
|---|------|---------|----------|------|
| 1 | 首页 | `http://124.223.1.67:3001/` | 页面正常显示，机构信息可见 | ☐ |
| 2 | 课程列表 | `/courses` | 看到课程卡片列表 | ☐ |
| 3 | 课程详情 | 点击课程 | 进入详情页，看到课程介绍/师资/价格 | ☐ |
| 4 | 校区列表 | `/campuses` | 显示武汉 6 大校区 | ☐ |
| 5 | 教师列表 | `/teachers` | 显示教师卡片 | ☐ |
| 6 | 新闻列表 | `/news` | 显示新闻列表 | ☐ |
| 7 | FAQ | `/faq` | 显示常见问题 | ☐ |
| 8 | 多语言切换 | 右上角语言按钮 | 中英文切换正常，URL 变化 | ☐ |
| 9 | AI 客服 | 右下角浮动按钮 | 输入消息有回复（需先配置 DASHSCOPE key） | ☐ |
| 10 | 预约表单 | `/appointment` | 提交后显示成功 | ☐ |
| 11 | 联系表单 | `/contact` | 提交后显示成功 | ☐ |
| 12 | 搜索 | 顶部搜索框 | 输入关键词显示结果 | ☐ |
| 13 | Strapi 后台 | `http://124.223.1.67:1337/admin` | 能登录管理内容 | ☐ |

**失败处理**：

- **页面白屏**：`docker compose logs frontend` 看错误；可能是 SSG 构建失败
- **课程列表为空**：登录 Strapi 后台 → 创建几条测试课程数据
- **AI 客服无回复**：在 Strapi 后台 →「Ai Config」→ 填入真实 `DASHSCOPE_API_KEY`
- **预约提交失败**：查看 `docker compose logs backend`，可能是 campus 字段不匹配（已修复，见已知问题）

**完成标志**：13 项功能全部 ☑。

---

### 4.4 Central 后台验证

**操作目的**：确认 Agent 已成功连接 Central 并上报心跳。

**具体操作**：

1. 登录 `https://central.tishensnoopy.cloud`
2. 左侧菜单 →「服务器管理」
3. 查看 Agent 记录：
   - 状态应为「在线」
   - 心跳时间应为近 1 分钟内
   - Server ID：`3bb67add-a6c5-4aa3-9040-e7b269c9d488`

**预期输出**：

```
服务器列表：
┌──────────────────────────┬────────┬──────────────────────┐
│ Server ID                │ 状态   │ 最后心跳            │
├──────────────────────────┼────────┼──────────────────────┤
│ 3bb67add-a6c5-4aa3-...   │ 在线   │ 2026-07-16 15:30:00 │
└──────────────────────────┴────────┴──────────────────────┘
```

**失败处理**：

- **状态为「离线」**：
  1. 服务器执行 `docker logs agent` 查看 Agent 日志
  2. 检查 `.env` 中 `CENTRAL_WS_URL` 和 `AGENT_TOKEN` 是否正确
  3. 执行 `docker restart agent` 重启
- **看不到 Agent 记录**：3.7 注册步骤未完成，回到 3.7 重做
- **心跳停滞**：Agent 与 Central 网络问题，检查服务器出站 443 端口

**完成标志**：Agent 状态为「在线」，心跳时间在近 1 分钟内。

---

## 第五部分：常见问题排查

### 5.1 容器不启动

**症状**：`docker compose ps` 显示某容器 `Exited` 或 `Restarting`。

**排查步骤**：

```bash
# 1. 查看容器日志
docker compose logs <服务名>

# 2. 查看容器退出码
docker ps -a --filter "name=<服务名>" --format "{{.Names}}: {{.Status}}"

# 3. 检查 .env 配置
grep -E '^(DATABASE_PASSWORD|APP_KEYS|JWT_SECRET)=' .env
```

**常见原因**：

| 错误信息 | 原因 | 解决 |
|---------|------|------|
| `ECONNREFUSED postgres:5432` | postgres 未启动 | `docker compose up -d postgres` 然后等 30 秒 |
| `APP_KEYS error` | APP_KEYS 格式不对 | 检查 .env，需 4 个逗号分隔 base64 字符串 |
| `AES_KEY must decode to 32 bytes` | AES_KEY 长度错 | `openssl rand -base64 32` 重新生成 |
| `port is already allocated` | 端口被占用 | 见 5.6 端口冲突 |
| `no space left on device` | 磁盘满 | `docker system prune -a` 清理 |

---

### 5.2 前端构建失败

**症状**：`docker compose up --build frontend` 报错退出。

**排查命令**：

```bash
# 查看构建日志
docker compose logs frontend

# 手动测试构建
docker compose run --rm frontend npm run build
```

**常见原因**：

| 错误 | 原因 | 解决 |
|------|------|------|
| `SSG: data fetch failed` | backend 未就绪 | 先启动 backend 并确认 healthy，再 build frontend |
| `NEXT_PUBLIC_STRAPI_API_URL not set` | .env 缺字段 | 在 .env 中补充该字段 |
| `TypeScript error` | TS 类型错误 | 服务器上修改代码（临时），但应同步回 GitHub |
| `Out of memory` | 内存不足 | 增加 swap，或 `docker system prune -f` 后重试 |

**特别说明**：前端 SSG 构建需要从 backend 拉数据（首页/课程/校区等），必须等 backend healthy 后再 build。

---

### 5.3 Agent 连接 Central 失败

**症状**：Central 后台显示 Agent「离线」，或 `docker logs agent` 报错。

**排查命令**：

```bash
# 1. 查看 Agent 日志
docker logs --tail 100 agent

# 2. 验证 Central 可达
curl -I https://central.tishensnoopy.cloud/api/agent/ws

# 3. 检查 .env
grep -E '^(CENTRAL_WS_URL|AGENT_TOKEN|SERVER_ID)=' /opt/customer-site/.env
```

**常见错误**：

| 错误信息 | 原因 | 解决 |
|---------|------|------|
| `ECONNREFUSED` | Central 未运行或 DNS 未生效 | 确认 Central nginx 运行；`dig central.tishensnoopy.cloud` |
| `401 Unauthorized` | AGENT_TOKEN 已被吊销 | 在 Central 后台重新生成 enrollment code，回到 3.7 注册 |
| `404 Not Found` | CENTRAL_WS_URL 路径错误 | 应为 `wss://central.tishensnoopy.cloud/api/agent/ws` |
| `ws close code 4001` | token 被吊销 | 重新注册 |
| `Cannot find module 'docker'` | Agent 容器缺 docker CLI（已知非阻断问题） | 不影响 WebSocket 连接，可忽略 |

**修复后重启 Agent**：

```bash
docker restart agent
```

---

### 5.4 Docker 镜像拉取失败

**症状**：`docker pull` 报 `i/o timeout` 或 `connection refused`。

**原因**：国内服务器访问 Docker Hub 被墙。

**解决**：配置镜像加速器（参考 2.2）：

```bash
tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me",
    "https://docker.m.daocloud.io"
  ]
}
EOF
systemctl restart docker
```

加速器失效时参考 `https://github.com/dongyubin/docker-mirror` 获取最新可用源。

---

### 5.5 Strapi 后台无法访问

**症状**：浏览器访问 `http://124.223.1.67:1337/admin` 打不开。

**排查命令**：

```bash
# 1. 容器状态
docker compose ps backend

# 2. 容器日志
docker compose logs --tail 50 backend

# 3. 本地健康检查
curl http://localhost:1337/_health

# 4. 端口映射
docker compose port backend 1337
```

**常见原因**：

| 现象 | 原因 | 解决 |
|------|------|------|
| 浏览器打不开但 curl 通 | 腾讯云安全组未放 1337 | 控制台添加入站规则：TCP 1337 |
| `curl localhost:1337` 不通 | backend 容器未运行 | `docker compose up -d backend` |
| `Connection refused` | 端口未映射到宿主机 | 检查 docker-compose.yml 端口映射 |
| `502 Bad Gateway` | backend 还在启动中 | 等 60 秒重试 |

---

### 5.6 端口冲突

**症状**：`docker compose up` 报 `port is already allocated`。

**排查命令**：

```bash
# 查看占用端口的进程
sudo lsof -i :3001
sudo lsof -i :1337
sudo lsof -i :80

# 或
sudo netstat -tulpn | grep -E ':(3001|1337|80|443)'
```

**解决方案**：

| 占用方 | 解决 |
|--------|------|
| 其他 Docker 容器 | `docker stop <容器名>` 或修改 .env 端口 |
| 宿主机进程 | `kill <PID>` 或修改 .env 端口 |
| Central nginx 占用 80/443 | 客户业务不要用 80/443，用 3001/1337 |

**修改端口方法**：

```bash
# 编辑 .env
nano /opt/customer-site/.env
# 修改 FRONTEND_PORT=3002（或其他空闲端口）

# 重启 frontend
cd /opt/customer-site
docker compose up -d frontend
```

---

### 5.7 内存不足导致 OOM

**症状**：容器被系统 kill（`docker ps` 显示 `Exited (137)`），或部署时构建失败。

**排查命令**：

```bash
# 查看内存使用
free -h

# 查看 docker 容器资源占用
docker stats --no-stream

# 查看系统日志中 OOM 记录
dmesg | grep -i 'killed process'
```

**解决方案**：

```bash
# 1. 增加 swap（如果还没有）
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 2. 清理无用镜像/卷释放磁盘
docker system prune -f

# 3. 限制 Strapi 容器内存（修改 docker-compose.yml）
# backend 服务的 deploy.resources.limits.memory: 1G

# 4. 分步构建（避免同时构建多个镜像）
docker compose up -d --build postgres redis meilisearch
docker compose up -d --build backend
docker compose up -d --build frontend
```

---

## 第六部分：速查表

### 6.1 端口对照表

**当前服务器（124.223.1.67）端口分配**：

| 服务 | 端口 | 容器名 | 说明 | 状态 |
|------|------|--------|------|------|
| Central Nginx | 80, 443 | central-nginx | 已占用 | ✅ |
| Central App | 3000（容器内） | central-app | 已占用 | ✅ |
| Central PostgreSQL | 仅容器内部 | central-postgres | 不映射宿主 | ✅ |
| 客户 PostgreSQL | 5432 | yousen-postgres | 不冲突 | ✅ |
| 客户 Redis | 6379 | yousen-redis | 不冲突 | ✅ |
| 客户 MeiliSearch | 7700 | yousen-meilisearch | 不冲突 | ✅ |
| 客户 Strapi | 1337 | yousen-backend | 不冲突 | ✅ |
| 客户 Next.js | 3001 | yousen-frontend | 不冲突（Central 用 3000 容器内） | ✅ |
| Agent | 无外部端口 | agent | WebSocket 连 Central | ✅ |

---

### 6.2 目录结构

| 目录 | 作用 | 备注 |
|------|------|------|
| `/opt/central/` | Central 部署目录 | docker-compose.yml + .env + scripts/ |
| `/opt/customer-site/` | 客户业务部署目录 | docker-compose.yml + .env + backend/ + frontend-next/ + agent/ |
| `/etc/letsencrypt/live/central.tishensnoopy.cloud/` | Central SSL 证书 | fullchain.pem + privkey.pem |
| `/var/log/central-backup.log` | Central 备份日志 | crontab 每天 3 点写入 |
| Docker volumes | | |
| `central_pgdata` | Central PostgreSQL 数据 | |
| `pgdata` | 客户 PostgreSQL 数据 | |
| `redisdata` | 客户 Redis 数据 | |
| `msdata` | 客户 MeiliSearch 数据 | |
| `uploads` | 客户 Strapi 上传文件 | |

---

### 6.3 常用命令

```bash
# === 查看所有容器（Central + 客户业务）===
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# === 客户业务 ===
cd /opt/customer-site

# 查看状态
docker compose ps

# 查看日志（实时）
docker compose logs -f backend
docker compose logs -f frontend

# 重启单个服务
docker compose restart backend

# 重新构建并启动
docker compose up -d --build backend

# 进入容器
docker compose exec backend sh

# 手动备份数据库
docker compose exec -T postgres pg_dump -U strapi strapi > /opt/backups/customer_$(date +%Y%m%d).sql

# === Central ===
cd /opt/central

# 查看状态
docker compose ps

# 重启 Central
docker compose restart

# 重新 seed 管理员
docker compose exec app npm run db:seed

# 手动备份
bash scripts/backup.sh

# === Agent ===
# 查看日志
docker logs -f agent

# 重启
docker restart agent
```

---

### 6.4 账号信息

| 系统 | 地址 | 账号 | 密码 | 备注 |
|------|------|------|------|------|
| Central 后台 | `https://central.tishensnoopy.cloud/login` | `tishensnoopy@petalmail.com` | `Hym465964665` | 超级管理员 |
| Strapi 后台 | `http://124.223.1.67:1337/admin` | `tishensnoopy@petalmail.com` | `Hym465964665` | Strapi 超级管理员 |
| 服务器 SSH | `root@124.223.1.67` | `root` | — | SSH key 或密码 |

> **安全提示**：生产环境请修改默认密码；账号信息不应提交到 GitHub。

---

### 6.5 已知遗留问题

| # | 问题 | 影响 | 解决方式 |
|---|------|------|---------|
| 1 | `DASHSCOPE_API_KEY` 为占位符 | AI 客服功能降级为「转人工」 | Strapi 后台 →「Ai Config」→ 填入真实 key |
| 2 | 域名 `yousen.tishensnoopy.cloud` 未配置 DNS | 无法用域名访问客户业务 | 域名注册商控制台添加 A 记录指向 124.223.1.67 |
| 3 | 端口 3001/1337 未在腾讯云安全组开放 | 外网无法访问客户业务 | 腾讯云控制台 → 安全组 → 添加 TCP 3001/1337 入站规则 |
| 4 | Agent 容器缺少 docker CLI | 非阻断，仅影响容器内 docker 命令 | 不影响 WebSocket 连接 Central，可忽略 |
| 5 | 部署中修复的代码（Strapi policy 命名空间 / Agent ESM / Dockerfile） | 已修复，commit `4cc6f16` | 后续部署已包含修复 |

---

**文档版本**：2026-07-16
**适用项目**：佑森小课堂多租户系统
**部署 commit**：`4cc6f16`
**Agent Server ID**：`3bb67add-a6c5-4aa3-9040-e7b269c9d488`
