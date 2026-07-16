# 完整部署指南（小白版）

> 本文档详细介绍两种部署场景：
> 1. **在我的服务器上部署**（Central + 客户业务系统同机测试）
> 2. **在客户的服务器上部署**（独立客户服务器生产部署）
>
> 适合零基础用户，每一步都有详细说明。

---

## 目录

- [第一部分：在我的服务器上部署（测试环境）](#第一部分在我的服务器上部署测试环境)
  - [1.1 当前状态确认](#11-当前状态确认)
  - [1.2 端口规划](#12-端口规划)
  - [1.3 在 Central 后台创建客户](#13-在-central-后台创建客户)
  - [1.4 部署客户业务系统](#14-部署客户业务系统)
  - [1.5 人工测试](#15-人工测试)
  - [1.6 Debug 流程](#16-debug-流程)
  - [1.7 修改同步回 GitHub](#17-修改同步回-github)
  - [1.8 是否影响后续部署](#18-是否影响后续部署)
- [第二部分：在客户的服务器上部署（生产环境）](#第二部分在客户的服务器上部署生产环境)
  - [2.1 前提条件](#21-前提条件)
  - [2.2 服务器准备](#22-服务器准备)
  - [2.3 DNS 和 SSL 配置](#23-dns-和-ssl-配置)
  - [2.4 在 Central 后台创建客户](#24-在-central-后台创建客户)
  - [2.5 同步代码到客户服务器](#25-同步代码到客户服务器)
  - [2.6 配置环境变量](#26-配置环境变量)
  - [2.7 启动服务](#27-启动服务)
  - [2.8 验证 Agent 注册](#28-验证-agent-注册)
  - [2.9 日常维护](#29-日常维护)
- [附录 A：常见问题](#附录-a常见问题)
- [附录 B：端口对照表](#附录-b端口对照表)
- [附录 C：重要文件说明](#附录-c重要文件说明)

---

## 第一部分：在我的服务器上部署（测试环境）

### 1.1 当前状态确认

你的服务器（124.223.1.67）上已经部署了 Central 管理后台：

| 服务 | 端口 | 状态 |
|------|------|------|
| Central Nginx | 80, 443 | ✅ 运行中 |
| Central App | 3000（容器内）| ✅ 运行中 |
| Central PostgreSQL | 仅容器内部 | ✅ 运行中 |
| Central 域名 | central.tishensnoopy.cloud | ✅ 已配置 SSL |

现在要在**同一台服务器**上额外部署客户业务系统（Strapi + Next.js + Agent）进行测试。

### 1.2 端口规划

客户业务系统需要以下端口。由于 Central 已占用 80/443/3000，需要调整客户前端端口：

| 服务 | 默认端口 | 测试环境端口 | 说明 |
|------|---------|------------|------|
| 客户 PostgreSQL | 5432 | **5432** | 不冲突（Central PG 仅容器内部） |
| Redis | 6379 | **6379** | 不冲突 |
| MeiliSearch | 7700 | **7700** | 不冲突 |
| Strapi 后端 | 1337 | **1337** | 不冲突 |
| Next.js 前端 | 3000 | **3001** ⚠️ | 避免与 Central 冲突 |

> **关键**：客户前端的 `FRONTEND_PORT` 要改为 `3001`

### 1.3 在 Central 后台创建客户

在部署客户业务系统之前，需要先在 Central 后台创建客户记录。

1. **登录 Central 后台**：浏览器访问 `https://central.tishensnoopy.cloud/login`

2. **创建客户（Customer）**：
   - 点击左侧菜单「客户管理」
   - 点击「新建客户」
   - 填写客户名称（如「佑森小课堂测试」）
   - 保存

3. **生成 Enrollment Code（注册码）**：
   - 在客户详情页，点击「生成注册码」
   - 记录下这个注册码（格式类似 `ABCD-1234-EFGH`）
   - 客户服务器的 Agent 会用这个码注册到 Central

4. **创建配置（Config）**：
   - 进入「配置管理」
   - 为该客户创建配置版本
   - 填写必要的配置参数（域名、数据库密码等）
   - 发布配置

> **注意**：Enrollment Code 是客户服务器连接 Central 的凭证，请妥善保管。

### 1.4 部署客户业务系统

#### 步骤 1：在本地电脑同步代码到服务器

在你的**本地电脑**终端执行（不是服务器）：

```bash
cd /home/tishensnoopy/project/superpowers-zh

# rsync 同步到服务器（排除不需要的文件）
rsync -avz --progress \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.env*' \
  --exclude='.next/' \
  --exclude='test-results/' \
  --exclude='central/' \
  ./ ubuntu@124.223.1.67:/tmp/customer-site/
```

#### 步骤 2：在服务器上移动文件并配置

SSH 登录服务器：

```bash
ssh ubuntu@124.223.1.67
sudo -i
```

移动文件到 /opt/customer-site：

```bash
mkdir -p /opt/customer-site
cp -r /tmp/customer-site/* /opt/customer-site/
chown -R root:root /opt/customer-site
rm -rf /tmp/customer-site
cd /opt/customer-site
```

#### 步骤 3：配置 .env

```bash
cp .env.example .env
nano .env
```

需要修改的关键项（测试环境配置）：

```env
# === 端口（测试环境用 3001 避免与 Central 冲突）===
FRONTEND_PORT=3001
BACKEND_PORT=1337
POSTGRES_PORT=5432

# === 数据库密码（改成强密码）===
DATABASE_PASSWORD=YourStrongDbPassword2026!

# === Redis 密码 ===
REDIS_PASSWORD=YourStrongRedisPassword2026!

# === MeiliSearch ===
MEILI_MASTER_KEY=YourStrongMeiliKey2026!
MEILI_ENV=production

# === Strapi 安全密钥（生成命令: openssl rand -base64 32）===
APP_KEYS=<运行 openssl rand -base64 32 生成 4 个>
API_TOKEN_SALT=<openssl rand -base64 32>
ADMIN_JWT_SECRET=<openssl rand -base64 32>
TRANSFER_TOKEN_SALT=<openssl rand -base64 32>
JWT_SECRET=<openssl rand -base64 32>

# === 前端 URL ===
NEXT_PUBLIC_STRAPI_API_URL=http://124.223.1.67:1337
NEXT_PUBLIC_SITE_URL=http://124.223.1.67:3001
STRAPI_API_URL_SSR=http://backend:1337

# === Agent（连接 Central）===
CENTRAL_WS_URL=wss://central.tishensnoopy.cloud/api/agent/ws
AGENT_TOKEN=
SERVER_ID=
```

> **说明**：`AGENT_TOKEN` 和 `SERVER_ID` 先留空，Agent 注册后会自动填写。

#### 步骤 4：配置 Docker 镜像加速器（如果还没配置）

```bash
# 检查是否已配置
cat /etc/docker/daemon.json

# 如果没有，参考 Central 部署时的配置
```

#### 步骤 5：启动服务

```bash
cd /opt/customer-site

# 首次启动：分步启动（确保 backend 先启动供 frontend SSG）
# 1. 先启动数据库和缓存
docker compose up -d postgres redis meilisearch

# 2. 等待数据库健康（约 30 秒）
docker compose ps

# 3. 启动后端
docker compose up -d --build backend

# 4. 等待后端健康（约 60 秒，Strapi 需要建表）
docker compose ps

# 5. 启动前端（SSG 需要后端数据）
docker compose up -d --build frontend

# 6. 检查所有服务状态
docker compose ps
```

#### 步骤 6：注册 Agent 到 Central

```bash
# 进入 agent 目录（如果 agent 在客户业务系统中）
cd /opt/customer-site/agent

# 用 enrollment code 注册
npm run register -- --code <你的注册码> --name "测试服务器"

# 注册成功后会输出 AGENT_TOKEN 和 SERVER_ID
# 这些会自动写入 .env 文件
```

#### 步骤 7：验证服务

```bash
# 检查所有容器
docker compose ps

# 测试后端
curl http://localhost:1337/_health

# 测试前端
curl http://localhost:3001/
```

浏览器访问：
- 前端：`http://124.223.1.67:3001/`
- Strapi 管理后台：`http://124.223.1.67:1337/admin`

### 1.5 人工测试

#### 必须测试的功能清单

1. **首页**：访问 `http://124.223.1.67:3001/`，页面正常显示
2. **课程列表**：`http://124.223.1.67:3001/courses`，能看到课程
3. **课程详情**：点击课程，详情页正常
4. **校区列表**：`http://124.223.1.67:3001/campuses`
5. **新闻列表**：`http://124.223.1.67:3001/news`
6. **多语言切换**：点击右上角语言切换，中英文切换正常
7. **AI 客服**：点击右下角浮动聊天，输入消息，AI 正常回复
8. **预约表单**：提交预约表单，验证提交成功
9. **搜索功能**：使用搜索框搜索课程
10. **Strapi 后台**：`http://124.223.1.67:1337/admin`，能登录管理内容

#### Central 后台验证

1. 登录 `https://central.tishensnoopy.cloud`
2. 进入「服务器管理」
3. 确认测试服务器状态为「在线」
4. 查看心跳是否正常

### 1.6 Debug 流程

如果在测试中发现问题需要修复，**遵循以下原则**：

#### 原则：本地修改 → GitHub → 服务器同步

```
发现问题 → 本地修改代码 → 本地测试 → 提交到 GitHub → rsync 到服务器 → 重新部署
```

**不要直接在服务器上修改代码！** 原因：
1. 服务器上的修改容易丢失
2. 无法追踪变更历史
3. 会导致代码库不一致

#### 具体步骤

1. **在本地电脑修改代码**：
   ```bash
   cd /home/tishensnoopy/project/superpowers-zh
   # 用编辑器修改代码
   # 本地测试
   npm test  # 或其他测试命令
   ```

2. **提交到 GitHub**：
   ```bash
   git add <修改的文件>
   git commit -m "fix: 修复了xxx问题"
   git push origin main
   ```

3. **rsync 同步到服务器**：
   ```bash
   rsync -avz --progress \
     --exclude='.git/' \
     --exclude='node_modules/' \
     --exclude='.env*' \
     --exclude='.next/' \
     --exclude='test-results/' \
     --exclude='central/' \
     ./ ubuntu@124.223.1.67:/tmp/customer-site/
   ```

4. **在服务器上更新并重启**：
   ```bash
   ssh ubuntu@124.223.1.67
   sudo -i
   cp -r /tmp/customer-site/* /opt/customer-site/
   cd /opt/customer-site
   docker compose up -d --build backend frontend
   ```

#### 如果已经在服务器上修改了代码

如果像我们这次部署 Central 时那样，直接在服务器上修改了代码，需要**反向同步回本地**：

1. **从服务器 rsync 回本地**：
   ```bash
   # 在本地电脑执行
   rsync -avz \
     ubuntu@124.223.1.67:/opt/customer-site/ \
     /tmp/server-changes/

   # 对比差异
   diff -rq /tmp/server-changes/ /home/tishensnoopy/project/superpowers-zh/ \
     --exclude=node_modules --exclude=.git --exclude=.next
   ```

2. **手动合并有用的修改到本地代码**

3. **提交到 GitHub**：
   ```bash
   git add <文件>
   git commit -m "fix: 从服务器同步的修复"
   git push origin main
   ```

### 1.7 修改同步回 GitHub

**最佳实践总结**：

| 场景 | 正确做法 | 错误做法 |
|------|---------|---------|
| 发现 bug | 本地修复 → GitHub → rsync 到服务器 | 直接在服务器上改 |
| 紧急修复 | 服务器上改 → 立即同步回本地 → GitHub | 服务器上改了不管 |
| 配置变更 | 修改 .env.example → GitHub → 服务器 .env | 只改服务器 .env |

### 1.8 是否影响后续部署

**不会影响**，前提是：

1. **目录隔离**：
   - Central 在 `/opt/central/`
   - 客户业务在 `/opt/customer-site/`
   - 两个目录完全独立

2. **端口隔离**：
   - Central：3000, 80, 443
   - 客户业务：3001, 1337, 5432, 6379, 7700

3. **Docker 网络隔离**：
   - Central 有自己的 Docker 网络
   - 客户业务有自己的 Docker 网络
   - 两者互不干扰

4. **数据隔离**：
   - Central 用 `central_pgdata` 卷
   - 客户业务用 `pgdata`、`redisdata`、`msdata`、`uploads` 卷

**后续部署其他客户**：
- 在 Central 后台创建新客户
- 在新服务器上部署（参考第二部分）
- 或在同一台服务器上用不同端口部署（但不推荐生产环境）

---

## 第二部分：在客户的服务器上部署（生产环境）

### 2.1 前提条件

- 一台全新的云服务器（推荐 Ubuntu 22.04+，至少 2 核 4G）
- 服务器公网 IP
- 已注册的域名（如 `yousen.example.com`）
- 域名 DNS 已指向服务器 IP
- Central 管理后台已部署并可访问

### 2.2 服务器准备

#### 步骤 1：SSH 登录服务器

```bash
ssh ubuntu@<客户服务器IP>
sudo -i
```

#### 步骤 2：安装 Docker 和 Docker Compose

```bash
# 更新系统
apt-get update && apt-get upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 验证安装
docker --version
docker compose version
```

#### 步骤 3：配置 Docker 镜像加速器（国内服务器必做）

```bash
mkdir -p /etc/docker
tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me",
    "https://docker.m.daocloud.io"
  ]
}
EOF

systemctl daemon-reload
systemctl restart docker

# 验证
docker info | grep -A5 "Registry Mirrors"
```

### 2.3 DNS 和 SSL 配置

#### 步骤 1：配置 DNS

在域名注册商控制台添加 A 记录：

| 记录类型 | 主机记录 | 记录值 |
|---------|---------|-------|
| A | @ | <客户服务器IP> |
| A | www | <客户服务器IP> |

验证 DNS 生效：

```bash
dig +short your-domain.com
# 应返回服务器 IP
```

#### 步骤 2：申请 SSL 证书

```bash
# 安装 certbot
apt-get install -y certbot

# 申请证书（先确保 80 端口没被占用）
certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# 证书位置
ls /etc/letsencrypt/live/your-domain.com/
# fullchain.pem  privkey.pem
```

### 2.4 在 Central 后台创建客户

1. **登录 Central**：`https://central.tishensnoopy.cloud/login`

2. **创建客户**：
   - 进入「客户管理」→「新建客户」
   - 填写客户名称和域名

3. **生成 Enrollment Code**：
   - 在客户详情页点击「生成注册码」
   - 记录注册码

4. **创建并发布配置**：
   - 进入「配置管理」
   - 创建配置版本
   - 填写客户域名、数据库密码等
   - 点击「发布」

### 2.5 同步代码到客户服务器

在**你的本地电脑**执行：

```bash
cd /home/tishensnoopy/project/superpowers-zh

# rsync 同步到客户服务器
rsync -avz --progress \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.env*' \
  --exclude='.next/' \
  --exclude='test-results/' \
  --exclude='central/' \
  ./ ubuntu@<客户服务器IP>:/tmp/customer-site/
```

在客户服务器上：

```bash
ssh ubuntu@<客户服务器IP>
sudo -i
mkdir -p /opt/customer-site
cp -r /tmp/customer-site/* /opt/customer-site/
chown -R root:root /opt/customer-site
rm -rf /tmp/customer-site
cd /opt/customer-site
```

### 2.6 配置环境变量

```bash
cp .env.example .env
nano .env
```

生产环境配置：

```env
# === 端口（生产环境用默认端口）===
FRONTEND_PORT=3000
BACKEND_PORT=1337
POSTGRES_PORT=5432

# === 数据库 ===
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=<强密码>
DATABASE_SSL=false

# === Redis ===
REDIS_PASSWORD=<强密码>

# === MeiliSearch ===
MEILI_MASTER_KEY=<强密码>
MEILI_ENV=production

# === Strapi 安全密钥（openssl rand -base64 32）===
APP_KEYS=<4个不同的密钥>
API_TOKEN_SALT=<密钥>
ADMIN_JWT_SECRET=<密钥>
TRANSFER_TOKEN_SALT=<密钥>
JWT_SECRET=<密钥>

# === 前端 URL（生产域名）===
NEXT_PUBLIC_STRAPI_API_URL=https://your-domain.com/api
NEXT_PUBLIC_SITE_URL=https://your-domain.com
STRAPI_API_URL_SSR=http://backend:1337

# === Agent（连接 Central）===
CENTRAL_WS_URL=wss://central.tishensnoopy.cloud/api/agent/ws
AGENT_TOKEN=
SERVER_ID=

# === AI 客服 ===
DASHSCOPE_API_KEY=<你的阿里云 API Key>

# === 微信公众号 ===
WECHAT_APP_ID=<你的微信 AppID>
WECHAT_APP_SECRET=<你的微信 AppSecret>
WECHAT_TOKEN=<你的微信 Token>
```

### 2.7 启动服务

```bash
cd /opt/customer-site

# 首次启动：分步启动
# 1. 启动基础设施
docker compose up -d postgres redis meilisearch

# 2. 等待健康
docker compose ps

# 3. 启动后端
docker compose up -d --build backend

# 4. 等待后端健康
docker compose ps

# 5. 启动前端
docker compose up -d --build frontend

# 6. 启动 Agent（如果使用 --agent 选项）
docker compose -f docker-compose.yml -f scripts/agent-compose.yml up -d agent

# 或者用 deploy.sh 一键启动
./deploy.sh --no-pull --agent
```

### 2.8 验证 Agent 注册

```bash
# 进入 agent 目录
cd /opt/customer-site/agent

# 用 enrollment code 注册
npm run register -- --code <Central后台生成的注册码> --name "客户名称"

# 注册成功后检查
cat .env | grep AGENT_TOKEN
cat .env | grep SERVER_ID
```

在 Central 后台验证：
1. 登录 `https://central.tishensnoopy.cloud`
2. 进入「服务器管理」
3. 确认该客户服务器状态为「在线」
4. 查看心跳是否正常

### 2.9 日常维护

#### 查看日志

```bash
cd /opt/customer-site

# 查看所有服务日志
docker compose logs -f

# 查看特定服务
docker compose logs -f backend
docker compose logs -f frontend
```

#### 重启服务

```bash
cd /opt/customer-site

# 重启所有服务
docker compose restart

# 重启特定服务
docker compose restart backend
```

#### 更新代码

在本地电脑修改代码并推送到 GitHub 后：

```bash
# 在本地电脑 rsync 到服务器
rsync -avz --progress \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.env*' \
  --exclude='.next/' \
  --exclude='test-results/' \
  --exclude='central/' \
  ./ ubuntu@<客户服务器IP>:/tmp/customer-site/

# SSH 到服务器更新
ssh ubuntu@<客户服务器IP>
sudo -i
cp -r /tmp/customer-site/* /opt/customer-site/
rm -rf /tmp/customer-site
cd /opt/customer-site
docker compose up -d --build backend frontend
```

#### 备份数据库

```bash
# 手动备份
docker compose exec postgres pg_dump -U strapi strapi > backup_$(date +%Y%m%d).sql

# 设置自动备份（crontab）
crontab -e
# 添加每天 3 点备份
0 3 * * * cd /opt/customer-site && docker compose exec -T postgres pg_dump -U strapi strapi > /opt/backups/customer_$(date +\%Y\%m\%d).sql
```

---

## 附录 A：常见问题

### Q1: Docker 镜像拉取失败（i/o timeout）

**原因**：国内服务器访问 Docker Hub 被墙

**解决**：配置国内镜像加速器
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

### Q2: git clone 失败（GnuTLS error）

**原因**：国内服务器访问 GitHub 不稳定

**解决**：用 rsync 从本地同步代码（本文档推荐方式）

### Q3: 端口冲突

**症状**：`docker compose up` 报 `port is already allocated`

**解决**：修改 `.env` 中的端口配置，参考[端口规划](#12-端口规划)

### Q4: 前端构建失败（SSG 数据获取失败）

**原因**：前端构建时需要从后端获取数据（SSG），后端未启动或不可达

**解决**：
1. 确保后端先启动并健康：`docker compose ps`
2. 确认 `STRAPI_API_URL_SSR=http://backend:1337`（Docker 内部网络）
3. 确认 `docker-compose.yml` 中 `build.network: host`

### Q5: Agent 无法连接 Central

**检查项**：
1. `CENTRAL_WS_URL` 是否正确（`wss://central.tishensnoopy.cloud/api/agent/ws`）
2. Central 服务器是否运行
3. Enrollment Code 是否有效
4. 服务器时间是否同步（`date` 命令检查）

### Q6: Strapi 后台无法访问

**检查项**：
1. 后端容器是否健康：`docker compose ps backend`
2. 端口是否映射：`docker compose port backend 1337`
3. 防火墙是否放行 1337 端口

---

## 附录 B：端口对照表

### 测试环境（同一台服务器）

| 服务 | 端口 | 访问地址 |
|------|------|---------|
| Central Nginx | 80, 443 | `https://central.tishensnoopy.cloud` |
| Central App | 3000（容器内） | 通过 Nginx 代理 |
| 客户前端 | 3001 | `http://124.223.1.67:3001` |
| 客户后端 | 1337 | `http://124.223.1.67:1337` |
| 客户 PostgreSQL | 5432 | 仅容器内部 |
| Redis | 6379 | 仅容器内部 |
| MeiliSearch | 7700 | 仅容器内部 |

### 生产环境（独立客户服务器）

| 服务 | 端口 | 访问地址 |
|------|------|---------|
| 客户前端 | 3000 | `https://your-domain.com`（通过 Nginx） |
| 客户后端 | 1337 | `https://your-domain.com/api`（通过 Nginx） |
| 客户 PostgreSQL | 5432 | 仅容器内部 |
| Redis | 6379 | 仅容器内部 |
| MeiliSearch | 7700 | 仅容器内部 |

---

## 附录 C：重要文件说明

| 文件 | 作用 |
|------|------|
| `.env` | 环境变量配置（每台服务器独立，不提交到 GitHub） |
| `.env.example` | 环境变量模板（提交到 GitHub，作为参考） |
| `docker-compose.yml` | 客户业务系统 Docker 编排 |
| `deploy.sh` | 一键部署脚本 |
| `central/docker-compose.yml` | Central 管理后台 Docker 编排 |
| `central/deploy.sh` | Central 部署脚本 |
| `central/.env` | Central 环境变量配置 |
| `scripts/agent-compose.yml` | Agent 服务 Docker 编排 |
| `nginx/nginx.conf` | Nginx 反向代理配置 |

---

**文档版本**：2026-07-16
**适用项目**：佑森小课堂多租户系统
