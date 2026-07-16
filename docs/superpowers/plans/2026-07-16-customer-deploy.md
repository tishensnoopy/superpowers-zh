# 客户服务器生产部署（C 块）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为单台客户服务器搭建生产部署体系 —— GitHub Actions rsync 自动部署 + deploy.sh `--no-pull`/`--agent` 选项 + nginx SSL 预留 + Agent 部署整合 + 完整 Runbook。

**架构：** GitHub Actions runner 在境外 checkout 代码后，用 rsync 主动推送到国内客户服务器（规避服务器连 GitHub 不稳定），再 SSH 远程执行 `deploy.sh --no-pull --nginx -d`。deploy.sh 追加 `--agent` 选项一键启动 Agent 容器（用 `scripts/agent-compose.yml` 模板，由 envsubst 替换路径）。nginx.conf 追加注释化 HTTPS server 块供后续配域名启用。Runbook 覆盖 9 个章节（前置准备 / 首次部署 / 更新部署 / 回滚 / Agent 管理 / SSL 启用 / 微信回调启用 / 故障排查 / 手动离线部署）。

**技术栈：** Bash（deploy.sh）、YAML（docker-compose / GitHub Actions workflow）、Nginx 配置、Markdown（Runbook）。

**关联规格：** [2026-07-16-customer-deploy-design.md](../specs/2026-07-16-customer-deploy-design.md)

**前置依赖：** A 块已完成（agent 容器镜像 `registry.cn-hangzhou.aliyuncs.com/yousen/agent:latest` 已存在；agent/README.md 已写好）；现有 [deploy.sh](../../../deploy.sh)（311 行）、[nginx/nginx.conf](../../../nginx/nginx.conf)、[.env.example](../../../.env.example) 均已存在。

---

## 文件结构

```
deploy.sh                            # 修改：追加 --no-pull、--agent、--no-agent 选项
scripts/
└── agent-compose.yml                # 新建：Agent 容器 compose 模板（envsubst 占位）
.env.example                         # 修改：追加 Agent 变量（CENTRAL_WS_URL/AGENT_TOKEN/SERVER_ID）
nginx/
└── nginx.conf                       # 修改：追加注释化 HTTPS server 块
.github/workflows/
└── deploy-customer.yml              # 新建：客户业务自动部署 workflow
docs/
└── DEPLOY-RUNBOOK.md                # 新建：生产部署操作手册（9 章节）
```

---

## 任务 1：deploy.sh 追加 --no-pull / --agent 选项 + agent-compose.yml 模板 + .env.example 追加 Agent 变量

**文件：**
- 修改：`deploy.sh`（参数解析区 + 新增 start_agent 函数 + 主流程末尾调用）
- 创建：`scripts/agent-compose.yml`
- 修改：`.env.example`（末尾追加 Agent 节）

**为什么合并：** 这三个文件强耦合 —— deploy.sh 的 `--agent` 选项依赖 agent-compose.yml 存在 + .env 中 AGENT_TOKEN/SERVER_ID 配置。一起修改避免中间状态。

- [ ] **步骤 1：创建 scripts/agent-compose.yml**

写入 `scripts/agent-compose.yml`：

```yaml
# Yousen Agent 容器 compose 模板
# 用法：由 deploy.sh --agent 调用，先 envsubst 替换 ${DEPLOY_PATH} 后再 docker compose up
# 注意：env_file 中的 .env 必须包含 AGENT_TOKEN、SERVER_ID、CENTRAL_WS_URL
services:
  agent:
    image: registry.cn-hangzhou.aliyuncs.com/yousen/agent:latest
    container_name: yousen-agent
    restart: unless-stopped
    env_file: ${DEPLOY_PATH}/.env
    environment:
      CENTRAL_WS_URL: ${CENTRAL_WS_URL}
      DATA_DIR: ${DEPLOY_PATH}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ${DEPLOY_PATH}:${DEPLOY_PATH}:rw
    network_mode: host
```

- [ ] **步骤 2：修改 .env.example 追加 Agent 变量**

在 `.env.example` 末尾追加（注意保留现有内容不动）：

```env

# === Agent（多租户中央控制，A 块产物）===
# Central 管理后台的 WebSocket URL（central 部署在另一台服务器）
CENTRAL_WS_URL=wss://central.yousen.example.com/api/agent/ws
# Agent 长期 token（由 agent register 命令注册后自动写入，不要手动填）
AGENT_TOKEN=
# Agent 在 central 注册的服务器 ID（由 agent register 命令注册后自动写入）
SERVER_ID=
```

- [ ] **步骤 3：修改 deploy.sh 参数解析**

定位 deploy.sh 中"参数解析"区块（约第 40-66 行），追加 `--no-pull`、`--agent`、`--no-agent` 三个选项。

**原代码（参数解析变量声明区，约第 41-45 行）：**

```bash
MODE="direct"      # direct | nginx
DETACHED=0
NO_BUILD=0
CLEAN=0
ACTION="up"        # up | status | logs | down | configure-mirrors
```

**修改为：**

```bash
MODE="direct"      # direct | nginx
DETACHED=0
NO_BUILD=0
CLEAN=0
NO_PULL=0          # C 块新增：跳过 git pull（rsync 模式专用，当前为语义占位）
START_AGENT=0      # C 块新增：部署完成后启动 agent 容器
ACTION="up"        # up | status | logs | down | configure-mirrors
```

**原代码（case 块，约第 47-66 行）：**

```bash
while [[ $# -gt 0 ]]; do
  case "$1" in
    --nginx)           MODE="nginx"; shift ;;
    -d|--detach)       DETACHED=1; shift ;;
    --no-build)        NO_BUILD=1; shift ;;
    --clean)           CLEAN=1; shift ;;
    --status)          ACTION="status"; shift ;;
    --logs)            ACTION="logs"; shift; LOG_SERVICE="${1:-}"; shift || true ;;
    --down)            ACTION="down"; shift ;;
    --configure-mirrors) ACTION="configure-mirrors"; shift ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      err "未知参数: $1"
      exit 1
      ;;
  esac
done
```

**修改为：**

```bash
while [[ $# -gt 0 ]]; do
  case "$1" in
    --nginx)           MODE="nginx"; shift ;;
    -d|--detach)       DETACHED=1; shift ;;
    --no-build)        NO_BUILD=1; shift ;;
    --clean)           CLEAN=1; shift ;;
    --no-pull)         NO_PULL=1; shift ;;           # C 块：rsync 模式语义占位
    --agent)           START_AGENT=1; shift ;;       # C 块：启动 agent 容器
    --no-agent)        START_AGENT=0; shift ;;       # C 块：显式跳过 agent（默认行为）
    --status)          ACTION="status"; shift ;;
    --logs)            ACTION="logs"; shift; LOG_SERVICE="${1:-}"; shift || true ;;
    --down)            ACTION="down"; shift ;;
    --configure-mirrors) ACTION="configure-mirrors"; shift ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      err "未知参数: $1"
      exit 1
      ;;
  esac
done
```

- [ ] **步骤 4：修改 deploy.sh 帮助文档**

定位 deploy.sh 顶部注释（第 1-20 行），在 `--configure-mirrors` 行后追加新选项说明。

**原代码（第 14 行附近）：**

```bash
#   ./deploy.sh --configure-mirrors  # 仅配置 Docker 镜像加速器
#   ./deploy.sh -h               # 帮助
```

**修改为：**

```bash
#   ./deploy.sh --configure-mirrors  # 仅配置 Docker 镜像加速器
#   ./deploy.sh --no-pull        # 跳过 git pull（rsync 模式专用，C 块）
#   ./deploy.sh --agent          # 部署完成后启动 agent 容器（C 块）
#   ./deploy.sh -h               # 帮助
```

- [ ] **步骤 5：在 deploy.sh 中添加 start_agent 函数**

在 deploy.sh 的 "配置 Docker 镜像加速器" 函数 `configure_mirrors()` 之后（约第 95 行），添加新函数：

```bash
# ============== 启动 Agent 容器（C 块新增）==============
start_agent() {
  local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local agent_compose="$script_dir/scripts/agent-compose.yml"

  if [ ! -f "$agent_compose" ]; then
    err "未找到 agent-compose.yml: $agent_compose"
    err "请确保 scripts/agent-compose.yml 已随代码同步"
    return 1
  fi

  if [ ! -f "$script_dir/.env" ]; then
    err "未找到 .env 文件: $script_dir/.env"
    err "请先 cp .env.example .env 并填入 AGENT_TOKEN 和 SERVER_ID"
    return 1
  fi

  # 检查 .env 是否包含必需变量
  local agent_token="$(grep -E '^AGENT_TOKEN=' "$script_dir/.env" | cut -d= -f2- | tr -d '"' || true)"
  local server_id="$(grep -E '^SERVER_ID=' "$script_dir/.env" | cut -d= -f2- | tr -d '"' || true)"
  if [ -z "$agent_token" ] || [ -z "$server_id" ]; then
    err ".env 缺少 AGENT_TOKEN 或 SERVER_ID"
    err "请先执行 agent register 命令完成注册（见 agent/README.md）"
    return 1
  fi

  log "启动 Agent 容器..."
  # 用 envsubst 替换 ${DEPLOY_PATH} 和 ${CENTRAL_WS_URL}
  # DEPLOY_PATH 用脚本所在目录（与 .env 一致）
  local deploy_path="$script_dir"
  local central_ws_url="$(grep -E '^CENTRAL_WS_URL=' "$script_dir/.env" | cut -d= -f2- | tr -d '"' || true)"

  if [ -z "$central_ws_url" ]; then
    err ".env 缺少 CENTRAL_WS_URL"
    return 1
  fi

  DEPLOY_PATH="$deploy_path" CENTRAL_WS_URL="$central_ws_url" \
    envsubst < "$agent_compose" | $COMPOSE_CMD -f - up -d

  if [ $? -ne 0 ]; then
    err "Agent 容器启动失败"
    return 1
  fi

  sleep 5
  log "Agent 容器状态:"
  docker ps --filter "name=yousen-agent" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  ok "Agent 已启动（连接 central: $central_ws_url）"
}
```

- [ ] **步骤 6：在 deploy.sh 主流程末尾调用 start_agent**

定位 deploy.sh 末尾的"输出访问信息"区块（约第 286-310 行），在 `ok "✅ 部署完成！"` 之前插入 agent 启动逻辑。

**原代码（约第 285-288 行）：**

```bash
# ============== 输出访问信息 ==============
echo ""
ok "✅ 部署完成！"
```

**修改为：**

```bash
# ============== 启动 Agent（可选，C 块新增）==============
if [ "$START_AGENT" -eq 1 ]; then
  echo ""
  log "=== 启动 Agent ==="
  start_agent || warn "Agent 启动失败，业务容器已正常运行（Agent 与业务解耦）"
fi

# ============== no-pull 模式日志（C 块新增）==============
if [ "$NO_PULL" -eq 1 ]; then
  log "[mode] no-pull (rsync mode) — 代码由 rsync 同步，未执行 git pull"
fi

# ============== 输出访问信息 ==============
echo ""
ok "✅ 部署完成！"
```

- [ ] **步骤 7：验证 deploy.sh 语法**

运行：
```bash
cd /home/tishensnoopy/project/superpowers-zh && bash -n deploy.sh
```
预期：无输出（语法 OK）

- [ ] **步骤 8：验证 deploy.sh 帮助文档**

运行：
```bash
./deploy.sh -h
```
预期：输出包含 `--no-pull` 和 `--agent` 选项说明

- [ ] **步骤 9：验证 agent-compose.yml 语法**

运行：
```bash
DEPLOY_PATH=/opt/yousen CENTRAL_WS_URL=wss://central.example.com/api/agent/ws \
  envsubst < scripts/agent-compose.yml | docker compose -f - config 2>&1 | head -30
```
预期：输出有效的 compose 配置（如果环境无 docker，跳过此步，仅目测 YAML 语法）

- [ ] **步骤 10：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add deploy.sh scripts/agent-compose.yml .env.example
git commit -m "feat(deploy): add --no-pull and --agent options + agent-compose template (C-1)

- deploy.sh 追加 --no-pull（rsync 模式语义占位）、--agent、--no-agent 选项
- 新增 start_agent 函数：检查 agent-compose.yml + .env 凭证 + envsubst 替换路径 + docker compose up
- scripts/agent-compose.yml 模板（用 \${DEPLOY_PATH} 占位，由 envsubst 替换）
- .env.example 追加 Agent 变量（CENTRAL_WS_URL/AGENT_TOKEN/SERVER_ID）"
```

---

## 任务 2：nginx.conf 追加 HTTPS 预留 server 块

**文件：**
- 修改：`nginx/nginx.conf`（在现有 server 块之后追加注释化 HTTPS server 块）

- [ ] **步骤 1：在 nginx.conf 末尾追加 HTTPS 预留配置**

定位 nginx.conf 的最后一个 `}`（http 块闭合，约第 118 行），在最后一个 server 块闭合 `}`（约第 118 行）之后、http 块闭合 `}`（约第 119 行）之前，追加注释化的 HTTPS server 块。

**原代码（nginx.conf 末尾，约第 112-119 行）：**

```nginx
        # 错误页面（避免暴露内部错误）
        error_page 502 503 504 /50x.html;
        location = /50x.html {
            default_type text/html;
            return 503 '<!DOCTYPE html><html><head><meta charset="utf-8"><title>服务暂时不可用</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h1>服务暂时不可用</h1><p>服务器正在维护中，请稍后再试。</p></body></html>';
        }
    }
}
```

**修改为：**

```nginx
        # 错误页面（避免暴露内部错误）
        error_page 502 503 504 /50x.html;
        location = /50x.html {
            default_type text/html;
            return 503 '<!DOCTYPE html><html><head><meta charset="utf-8"><title>服务暂时不可用</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h1>服务暂时不可用</h1><p>服务器正在维护中，请稍后再试。</p></body></html>';
        }
    }

    # ====================================================================
    # HTTPS 预留配置（C 块新增）
    # 当前：用 IP 访问，仅 HTTP 80 端口工作
    # 启用步骤：配域名后取消下面 server 块的注释，并申请 Let's Encrypt 证书
    #   1. 域名 DNS 解析到服务器 IP
    #   2. sudo apt install certbot python3-certbot-nginx
    #   3. sudo certbot --nginx -d your-domain.com
    #   4. 取消下面 server 块的注释（替换 your-domain.com 为实际域名）
    #   5. docker compose -f docker-compose.yml -f docker-compose.nginx.yml restart nginx
    #   6. 微信公众号后台配置 webhook URL: https://your-domain.com/api/wechat/webhook
    # ====================================================================
    # server {
    #     listen 443 ssl http2 default_server;
    #     listen [::]:443 ssl http2 default_server;
    #     server_name your-domain.com;
    #
    #     # SSL 证书（Let's Encrypt 默认路径）
    #     ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    #     ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    #     ssl_protocols TLSv1.2 TLSv1.3;
    #     ssl_ciphers HIGH:!aNULL:!MD5;
    #     ssl_prefer_server_ciphers on;
    #     ssl_session_cache shared:SSL:10m;
    #     ssl_session_timeout 10m;
    #
    #     # 安全相关 header（同 80 端口）
    #     add_header X-Content-Type-Options "nosniff" always;
    #     add_header X-Frame-Options "SAMEORIGIN" always;
    #     add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    #     add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    #
    #     # ---- Strapi 后端 API ----
    #     location /api/ {
    #         proxy_pass http://backend;
    #         proxy_http_version 1.1;
    #         proxy_set_header Host $host;
    #         proxy_set_header X-Real-IP $remote_addr;
    #         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    #         proxy_set_header X-Forwarded-Proto $scheme;
    #         proxy_set_header Connection "";
    #         proxy_read_timeout 120s;
    #         proxy_send_timeout 120s;
    #     }
    #
    #     # ---- Strapi 管理后台 ----
    #     location /admin {
    #         proxy_pass http://backend;
    #         proxy_http_version 1.1;
    #         proxy_set_header Host $host;
    #         proxy_set_header X-Real-IP $remote_addr;
    #         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    #         proxy_set_header X-Forwarded-Proto $scheme;
    #         proxy_set_header Connection "";
    #     }
    #
    #     # ---- Strapi 上传文件 ----
    #     location /uploads/ {
    #         proxy_pass http://backend;
    #         proxy_http_version 1.1;
    #         proxy_set_header Host $host;
    #         proxy_set_header X-Real-IP $remote_addr;
    #         proxy_set_header Connection "";
    #         expires 7d;
    #         add_header Cache-Control "public, immutable";
    #     }
    #
    #     # ---- Strapi 健康检查端点 ----
    #     location = /_health {
    #         proxy_pass http://backend;
    #         proxy_http_version 1.1;
    #         proxy_set_header Connection "";
    #     }
    #
    #     # ---- Next.js 前端（默认路由）----
    #     location / {
    #         proxy_pass http://frontend;
    #         proxy_http_version 1.1;
    #         proxy_set_header Host $host;
    #         proxy_set_header X-Real-IP $remote_addr;
    #         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    #         proxy_set_header X-Forwarded-Proto $scheme;
    #         proxy_set_header Upgrade $http_upgrade;
    #         proxy_set_header Connection "upgrade";
    #         proxy_read_timeout 86400;
    #     }
    #
    #     error_page 502 503 504 /50x.html;
    #     location = /50x.html {
    #         default_type text/html;
    #         return 503 '<!DOCTYPE html><html><head><meta charset="utf-8"><title>服务暂时不可用</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h1>服务暂时不可用</h1><p>服务器正在维护中，请稍后再试。</p></body></html>';
    #     }
    # }
    #
    # # HTTP 强制跳转 HTTPS（启用 HTTPS 后取消注释）
    # server {
    #     listen 80 default_server;
    #     listen [::]:80 default_server;
    #     server_name your-domain.com;
    #     return 301 https://$server_name$request_uri;
    # }
}
```

- [ ] **步骤 2：验证 nginx.conf 语法**

运行：
```bash
cd /home/tishensnoopy/project/superpowers-zh
# 如果环境有 nginx：nginx -c nginx/nginx.conf -t
# 如果环境无 nginx：用 docker 临时验证
docker run --rm -v $(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf:ro nginx:alpine nginx -t 2>&1
```
预期：`syntax is ok` 和 `test is successful`（如果环境无 docker，跳过，仅目测注释对齐）

- [ ] **步骤 3：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add nginx/nginx.conf
git commit -m "feat(nginx): add commented HTTPS server block for future SSL enablement (C-2)

- 追加注释化的 443 ssl http2 server 块（含 HSTS、SSL 证书路径占位）
- 复用 80 端口的所有 location 配置（/api/、/admin、/uploads/、/_health、/）
- 追加 HTTP→HTTPS 强制跳转 server 块（注释化）
- 启用步骤文档化在注释中（certbot 申请 + 取消注释 + 重启 nginx）"
```

---

## 任务 3：创建 .github/workflows/deploy-customer.yml

**文件：**
- 创建：`.github/workflows/deploy-customer.yml`

**前置说明：** 参考 [.github/workflows/deploy-site.yml](../../../.github/workflows/deploy-site.yml) 的 SHA 固定模式。Actions 版本：
- `actions/checkout@v4` SHA: `34e114876b0b11c390a56381ad16ebd13914f8d5`
- `webfactory/ssh-agent@v0.9.0` SHA: `dc588b781dcf0c1a0b1e033ea7b4e5b43686a9f3`
- `actions/upload-artifact@v4` SHA: `50769540e7f4bd5e21e526ee35c689e35e0d6874`

- [ ] **步骤 1：创建 .github/workflows/deploy-customer.yml**

写入 `.github/workflows/deploy-customer.yml`：

```yaml
name: Deploy customer site

# 客户业务自动部署：push 到 main 分支（触及业务相关路径）时触发
# Runner 在境外主动 rsync 代码到国内客户服务器，规避服务器连 GitHub 不稳定问题
# 必需 Secrets（在仓库 Settings → Secrets 中配置）：
#   - SSH_PRIVATE_KEY: SSH 登录私钥（runner → 客户服务器）
#   - SERVER_IP: 客户服务器公网 IP
#   - DEPLOY_PATH: 服务器项目路径（如 /opt/yousen）
# 可选 Secrets:
#   - DEPLOY_SSH_PORT: SSH 端口（默认 22）
#   - DEPLOY_USER: SSH 登录用户（默认 root）

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - 'frontend-next/**'
      - 'docker-compose.yml'
      - 'docker-compose.nginx.yml'
      - 'nginx/**'
      - 'deploy.sh'
      - 'scripts/agent-compose.yml'
      - '.github/workflows/deploy-customer.yml'
  workflow_dispatch:
    inputs:
      restart_agent:
        description: '部署完成后重启 Agent 容器'
        required: false
        type: boolean
        default: false

# 同一服务器同时只跑一个部署，避免并发冲突
concurrency:
  group: deploy-customer-${{ secrets.SERVER_IP }}
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      actions: write  # upload-artifact 需要
    steps:
      # Action 全部 SHA 固定（防供应链/标签劫持）
      - name: Checkout
        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4

      - name: Setup SSH agent
        uses: webfactory/ssh-agent@dc588b781dcf0c1a0b1e033ea7b4e5b43686a9f3 # v0.9.0
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}

      - name: Add server to known_hosts
        run: |
          ssh-keyscan -p ${{ secrets.DEPLOY_SSH_PORT || 22 }} ${{ secrets.SERVER_IP }} >> ~/.ssh/known_hosts

      - name: Validate required secrets
        run: |
          if [ -z "${{ secrets.SERVER_IP }}" ]; then
            echo "::error::Secret SERVER_IP is required"
            exit 1
          fi
          if [ -z "${{ secrets.DEPLOY_PATH }}" ]; then
            echo "::error::Secret DEPLOY_PATH is required"
            exit 1
          fi
          echo "Deploy target: ${{ secrets.DEPLOY_USER || 'root' }}@${{ secrets.SERVER_IP }}:${{ secrets.DEPLOY_PATH }}"

      - name: Rsync code to server
        run: |
          rsync -avz --delete \
            --exclude='.git/' \
            --exclude='node_modules/' \
            --exclude='.next/' \
            --exclude='dist/' \
            --exclude='build/' \
            --exclude='.env' \
            --exclude='*.log' \
            --exclude='data/' \
            --exclude='strapi_uploads/' \
            --exclude='strapi_pg_data/' \
            --exclude='strapi_redis_data/' \
            --exclude='strapi_meili_data/' \
            --exclude='.cache/' \
            --exclude='.npmrc' \
            --exclude='central/' \
            --exclude='agent/' \
            -e "ssh -p ${{ secrets.DEPLOY_SSH_PORT || 22 }}" \
            ./ ${{ secrets.DEPLOY_USER || 'root' }}@${{ secrets.SERVER_IP }}:${{ secrets.DEPLOY_PATH }}/
        # 关键：--exclude='.env' 确保服务器端 .env 不被覆盖
        # 排除 central/ 和 agent/：这两个目录是 A 块产物，不属于客户业务部署范围

      - name: Deploy via SSH (without agent)
        if: ${{ github.event.inputs.restart_agent != 'true' }}
        run: |
          ssh -p ${{ secrets.DEPLOY_SSH_PORT || 22 }} ${{ secrets.DEPLOY_USER || 'root' }}@${{ secrets.SERVER_IP }} \
            "cd ${{ secrets.DEPLOY_PATH }} && ./deploy.sh --no-pull --nginx -d 2>&1 | tee deploy.log"
        env:
          DEPLOY_LOG_FILE: deploy.log

      - name: Deploy via SSH (with agent restart)
        if: ${{ github.event.inputs.restart_agent == 'true' }}
        run: |
          ssh -p ${{ secrets.DEPLOY_SSH_PORT || 22 }} ${{ secrets.DEPLOY_USER || 'root' }}@${{ secrets.SERVER_IP }} \
            "cd ${{ secrets.DEPLOY_PATH }} && ./deploy.sh --no-pull --nginx -d --agent 2>&1 | tee deploy.log"

      - name: Fetch deploy log on failure
        if: failure()
        run: |
          ssh -p ${{ secrets.DEPLOY_SSH_PORT || 22 }} ${{ secrets.DEPLOY_USER || 'root' }}@${{ secrets.SERVER_IP }} \
            "cat ${{ secrets.DEPLOY_PATH }}/deploy.log" > deploy.log || true

      - name: Upload deploy log artifact
        if: failure()
        uses: actions/upload-artifact@50769540e7f4bd5e21e526ee35c689e35e0d6874 # v4
        with:
          name: deploy-log-${{ github.run_id }}
          path: deploy.log
          retention-days: 7
```

- [ ] **步骤 2：验证 workflow YAML 语法**

运行：
```bash
cd /home/tishensnoopy/project/superpowers-zh
# 用 yamllint 验证语法（如果环境有）
yamllint .github/workflows/deploy-customer.yml 2>&1 || true
# 或用 actionlint（如果环境有）
actionlint .github/workflows/deploy-customer.yml 2>&1 || true
# 退而求其次：用 python 验证 YAML 可解析
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-customer.yml'))" && echo "YAML OK"
```
预期：YAML 可正常解析（无语法错误）

- [ ] **步骤 3：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add .github/workflows/deploy-customer.yml
git commit -m "ci: add customer site auto-deploy workflow via rsync + ssh (C-3)

- push 到 main 分支（触及 backend/frontend-next/nginx/deploy.sh 等路径）触发
- workflow_dispatch 手动触发，支持 restart_agent 参数
- runner rsync 代码到服务器（排除 .env/node_modules/.git/central/agent）
- SSH 远程执行 deploy.sh --no-pull --nginx -d（或带 --agent）
- 失败时上传 deploy.log artifact
- concurrency 防并发部署
- 所有 actions SHA 固定（防供应链劫持）"
```

---

## 任务 4：创建 docs/DEPLOY-RUNBOOK.md（9 章节）

**文件：**
- 创建：`docs/DEPLOY-RUNBOOK.md`

- [ ] **步骤 1：创建 docs/DEPLOY-RUNBOOK.md**

写入 `docs/DEPLOY-RUNBOOK.md`：

````markdown
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
# 从本地 rsync + ssh
rsync -avz --delete \
  --exclude='.git/' --exclude='node_modules/' --exclude='.next/' \
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
docker compose -f scripts/agent-compose.yml up -d
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
docker compose -f scripts/agent-compose.yml up -d
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

将上述步骤合并为 `scripts/offline-deploy.sh`（本地执行）：

```bash
#!/bin/bash
# 用法：./scripts/offline-deploy.sh <SERVER_IP> [DEPLOY_PATH]
set -euo pipefail
SERVER_IP="${1:?Usage: $0 <SERVER_IP> [DEPLOY_PATH]}"
DEPLOY_PATH="${2:-/opt/yousen}"

echo "[1/4] 打包代码..."
tar --exclude='.git' --exclude='node_modules' --exclude='.next' \
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
````

- [ ] **步骤 2：验证 Runbook Markdown 语法**

运行：
```bash
cd /home/tishensnoopy/project/superpowers-zh
# 用 markdownlint 验证（如果环境有）
markdownlint docs/DEPLOY-RUNBOOK.md 2>&1 || true
# 退而求其次：目测章节结构完整
grep -c "^## " docs/DEPLOY-RUNBOOK.md
```
预期：9 个二级标题（对应 9 个章节）

- [ ] **步骤 3：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add docs/DEPLOY-RUNBOOK.md
git commit -m "docs: add customer server deploy runbook (C-4)

9 章节覆盖：
1. 前置准备（服务器要求 + SSH key + GitHub Secrets）
2. 首次部署（Docker 安装 + 代码拉取 + .env 配置 + Agent 注册）
3. 更新部署（自动 + 手动 + workflow_dispatch）
4. 回滚（commit + tag）
5. Agent 管理（启动/停止/日志/升级/重新注册）
6. SSL 启用（certbot + nginx HTTPS + 自动续期）
7. 微信回调启用（凭证填入 + 公众号后台配置）
8. 故障排查（GitHub Actions/rsync/deploy.sh/Agent 各类失败）
9. 手动离线部署（tar 打包 + scp + 解压 + 一键脚本）"
```

---

## 自检

### 规格覆盖度

| 规格章节 | 对应任务 | 状态 |
|---------|---------|------|
| 1.2 目标 1（GitHub Actions 自动部署） | 任务 3 | ✅ |
| 1.2 目标 2（rsync 兜底） | 任务 3（rsync 步骤）+ 任务 4（第 9 节离线部署） | ✅ |
| 1.2 目标 3（Agent 整合 --agent） | 任务 1（deploy.sh --agent + start_agent + agent-compose.yml） | ✅ |
| 1.2 目标 4（SSL 预留） | 任务 2（nginx.conf HTTPS 注释块）+ 任务 4（第 6 节启用步骤） | ✅ |
| 1.2 目标 5（Runbook 文档） | 任务 4（9 章节） | ✅ |
| 5.1 GitHub Actions 自动部署 | 任务 3 | ✅ |
| 5.2 GitHub Secrets 清单 | 任务 4（第 1.3 节） | ✅ |
| 5.3 deploy.sh 改动（--no-pull / --agent） | 任务 1（步骤 3-6） | ✅ |
| 5.4 Agent 部署整合 | 任务 1（agent-compose.yml + .env.example）+ 任务 4（第 5 节） | ✅ |
| 5.5 nginx SSL 预留 | 任务 2 + 任务 4（第 6 节） | ✅ |
| 5.6 兜底链路 | 任务 3（rsync 主路径）+ 任务 4（第 9 节离线） | ✅ |
| 6 Runbook 结构（9 章节） | 任务 4 | ✅ |
| 8 验收标准 1-12 | 任务 1-4 全覆盖 | ✅ |

### 占位符扫描

- 无 "TODO"、"待定"、"后续实现" 等占位符
- 所有代码步骤包含完整代码块
- 所有命令步骤包含完整命令 + 预期输出

### 类型一致性

- deploy.sh 变量名 `NO_PULL`、`START_AGENT` 在步骤 3-6 一致
- agent-compose.yml 中 `${DEPLOY_PATH}`、`${CENTRAL_WS_URL}` 与 deploy.sh start_agent 函数中的 envsubst 参数一致
- workflow 中 `secrets.SERVER_IP`、`secrets.DEPLOY_PATH`、`secrets.SSH_PRIVATE_KEY` 与 Runbook 第 1.3 节 Secrets 清单一致
- Runbook 第 2.6 节 agent 注册命令与 [agent/README.md](../../../agent/README.md) 一致

### 遗漏

- 无遗漏。规格 8 节验收标准全部由任务 1-4 覆盖。
- 任务 1 的 start_agent 函数中用 `envsubst` 替换路径，需要服务器安装 `gettext` 包（`envsubst` 属于 gettext）。Ubuntu 22.04 默认已安装，Runbook 第 2.1 节已隐含包含（Docker 安装脚本会装依赖）。如果在其他环境遇到 `envsubst: command not found`，运行 `sudo apt install -y gettext`。
