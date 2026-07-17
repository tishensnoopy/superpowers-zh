#!/usr/bin/env bash
#
# 佑森小课堂 —— 全栈 Docker 部署脚本
#
# 用法:
#   ./deploy.sh                  # 直接 IP:3000 + IP:1337 模式（默认）
#   ./deploy.sh --nginx          # Nginx 统一入口模式（仅 80 端口）
#   ./deploy.sh -d               # 后台运行（detached）
#   ./deploy.sh --no-build       # 不重新构建，使用已有镜像
#   ./deploy.sh --clean          # 构建前清理悬空镜像和构建缓存
#   ./deploy.sh --status         # 查看服务状态
#   ./deploy.sh --logs [svc]     # 查看日志（可选指定服务）
#   ./deploy.sh --down           # 停止所有服务
#   ./deploy.sh --configure-mirrors  # 仅配置 Docker 镜像加速器
#   ./deploy.sh --no-pull        # 跳过 git pull（rsync 模式专用，C 块）
#   ./deploy.sh --agent          # 部署完成后启动 agent 容器（C 块）
#   ./deploy.sh -h               # 帮助
#
# 部署顺序:
#   1. 配置 Docker 镜像加速器（首次）
#   2. 启动基础设施（postgres + redis + meilisearch）
#   3. 等待基础设施健康
#   4. 构建并启动 backend（Strapi）
#   5. 等待 backend 健康
#   6. 构建并启动 frontend（Next.js，SSG 需要访问 backend）
#   7. （可选）启动 nginx
#
set -euo pipefail

# ============== 颜色输出 ==============
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $*"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] !${NC} $*"; }
err()  { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $*" >&2; }

# ============== 参数解析 ==============
MODE="direct"      # direct | nginx
DETACHED=0
NO_BUILD=0
CLEAN=0
NO_PULL=0          # C 块新增：跳过 git pull（rsync 模式专用，当前为语义占位）
START_AGENT=0      # C 块新增：部署完成后启动 agent 容器
ACTION="up"        # up | status | logs | down | configure-mirrors

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

# ============== 定位项目根目录 ==============
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
log "工作目录: $SCRIPT_DIR"

# ============== 检测 docker compose 命令 ==============
detect_compose_cmd() {
  if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
    warn "使用 docker-compose v1（建议升级到 v2）"
  else
    err "未检测到 docker compose 命令"
    err "请安装 docker-compose-plugin: sudo apt-get install docker-compose-plugin"
    exit 1
  fi
}

# ============== 配置 Docker 镜像加速器 ==============
configure_mirrors() {
  if [ "$EUID" -ne 0 ]; then
    err "配置镜像加速器需要 root 权限，请使用: sudo ./deploy.sh --configure-mirrors"
    exit 1
  fi
  log "配置 Docker 镜像加速器..."
  bash ./frontend-next/configure-docker-mirrors.sh
}

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

  if ! DEPLOY_PATH="$deploy_path" CENTRAL_WS_URL="$central_ws_url" \
        envsubst < "$agent_compose" | $COMPOSE_CMD -f - up -d; then
    err "Agent 容器启动失败"
    return 1
  fi

  sleep 5
  log "Agent 容器状态:"
  docker ps --filter "name=yousen-agent" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  ok "Agent 已启动（连接 central: $central_ws_url）"
}

# ============== 处理非 up 动作 ==============
if [ "$ACTION" = "configure-mirrors" ]; then
  configure_mirrors
  exit 0
fi

detect_compose_cmd
ok "Docker: $(docker --version)"

if [ "$ACTION" = "status" ]; then
  $COMPOSE_CMD ps
  exit 0
fi

if [ "$ACTION" = "logs" ]; then
  if [ -n "${LOG_SERVICE:-}" ]; then
    $COMPOSE_CMD logs -f "$LOG_SERVICE"
  else
    $COMPOSE_CMD logs -f
  fi
  exit 0
fi

if [ "$ACTION" = "down" ]; then
  log "停止所有服务..."
  if [ "$MODE" = "nginx" ]; then
    $COMPOSE_CMD -f docker-compose.yml -f docker-compose.nginx.yml down
  else
    $COMPOSE_CMD down
  fi
  ok "所有服务已停止"
  exit 0
fi

# ============== 以下是 up 动作 ==============

# 检查 root 权限（仅在需要时）
if ! docker info &> /dev/null; then
  err "Docker daemon 未运行或当前用户无权限"
  err "请将当前用户加入 docker 组: sudo usermod -aG docker \$USER"
  err "或使用 sudo 运行: sudo ./deploy.sh"
  exit 1
fi

# ============== 准备 .env 文件 ==============
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    ok "已从 .env.example 创建 .env"
    warn "请根据实际环境修改 .env 中的变量"
    warn "尤其是：DATABASE_PASSWORD, REDIS_PASSWORD, APP_KEYS, JWT_SECRET 等安全密钥"
    warn "生成安全密钥命令: openssl rand -base64 32"
    exit 1
  else
    err "未找到 .env 或 .env.example"
    exit 1
  fi
fi

# 验证必要的环境变量
REQUIRED_VARS=("DATABASE_PASSWORD" "APP_KEYS" "JWT_SECRET" "NEXT_PUBLIC_STRAPI_API_URL" "NEXT_PUBLIC_SITE_URL")
MISSING=0
for var in "${REQUIRED_VARS[@]}"; do
  val="$(grep -E "^${var}=" .env 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
  if [ -z "$val" ]; then
    err ".env 缺少必要变量: $var"
    MISSING=1
  fi
done
if [ "$MISSING" -eq 1 ]; then
  err "请补全 .env 后重试"
  exit 1
fi
ok "环境变量验证通过"

# 如果使用 Nginx 模式，提醒用户 NEXT_PUBLIC_STRAPI_API_URL 应该指向 80 端口
if [ "$MODE" = "nginx" ]; then
  CURRENT_API_URL="$(grep -E '^NEXT_PUBLIC_STRAPI_API_URL=' .env | cut -d= -f2- | tr -d '"')"
  if [[ "$CURRENT_API_URL" == *":1337"* ]]; then
    warn "检测到 NEXT_PUBLIC_STRAPI_API_URL=$CURRENT_API_URL"
    warn "Nginx 模式下建议改为指向 80 端口，例如: http://YOUR_SERVER_IP"
    warn "否则浏览器会直接访问 :1337，绕过 Nginx 反向代理"
    warn "继续执行（5 秒后），或按 Ctrl+C 中止修改 .env..."
    sleep 5
  fi
fi

# ============== 可选清理 ==============
if [ "$CLEAN" -eq 1 ]; then
  log "清理悬空镜像和构建缓存..."
  docker builder prune -f --filter "until=24h" 2>/dev/null || true
  docker image prune -f 2>/dev/null || true
  ok "清理完成"
fi

# ============== 组装 compose 命令 ==============
COMPOSE_FILES=(-f docker-compose.yml)
if [ "$MODE" = "nginx" ]; then
  COMPOSE_FILES+=(-f docker-compose.nginx.yml)
fi

BUILD_FLAG=""
if [ "$NO_BUILD" -eq 0 ]; then
  BUILD_FLAG="--build"
fi

DETACH_FLAG=""
if [ "$DETACHED" -eq 1 ]; then
  DETACH_FLAG="-d"
fi

# ============== 分阶段启动 ==============
log "=== 部署模式: $MODE ==="

# 阶段 1：基础设施
log "[1/3] 启动基础设施（postgres + redis + meilisearch）..."
$COMPOSE_CMD "${COMPOSE_FILES[@]}" up -d postgres redis meilisearch
ok "基础设施已启动，等待健康检查..."

for i in $(seq 1 30); do
  sleep 2
  PG_HEALTHY=$($COMPOSE_CMD "${COMPOSE_FILES[@]}" ps postgres --format json 2>/dev/null | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("Health","unknown"))' 2>/dev/null || echo "unknown")
  REDIS_HEALTHY=$($COMPOSE_CMD "${COMPOSE_FILES[@]}" ps redis --format json 2>/dev/null | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("Health","unknown"))' 2>/dev/null || echo "unknown")
  MS_HEALTHY=$($COMPOSE_CMD "${COMPOSE_FILES[@]}" ps meilisearch --format json 2>/dev/null | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("Health","unknown"))' 2>/dev/null || echo "unknown")
  if [ "$PG_HEALTHY" = "healthy" ] && [ "$REDIS_HEALTHY" = "healthy" ] && [ "$MS_HEALTHY" = "healthy" ]; then
    ok "基础设施全部健康"
    break
  fi
  if [ $i -eq 30 ]; then
    err "基础设施健康检查超时（60 秒）"
    err "使用以下命令查看日志: $COMPOSE_CMD ${COMPOSE_FILES[*]} logs postgres redis meilisearch"
    exit 1
  fi
  warn "等待中... pg=$PG_HEALTHY redis=$REDIS_HEALTHY ms=$MS_HEALTHY"
done

# 阶段 2：后端
log "[2/3] 构建并启动 backend（Strapi）..."
$COMPOSE_CMD "${COMPOSE_FILES[@]}" up -d $BUILD_FLAG backend
ok "backend 已启动，等待健康检查..."

for i in $(seq 1 24); do
  sleep 5
  BACKEND_HEALTHY=$($COMPOSE_CMD "${COMPOSE_FILES[@]}" ps backend --format json 2>/dev/null | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("Health","unknown"))' 2>/dev/null || echo "unknown")
  if [ "$BACKEND_HEALTHY" = "healthy" ]; then
    ok "backend 健康"
    break
  fi
  if [ $i -eq 24 ]; then
    err "backend 健康检查超时（120 秒）"
    err "使用以下命令查看日志: $COMPOSE_CMD ${COMPOSE_FILES[*]} logs backend"
    exit 1
  fi
  warn "等待中... backend=$BACKEND_HEALTHY"
done

# 阶段 3：前端（+ 可选 Nginx）
log "[3/3] 构建并启动 frontend（Next.js）..."
$COMPOSE_CMD "${COMPOSE_FILES[@]}" up -d $BUILD_FLAG frontend
ok "frontend 已启动，等待健康检查..."

for i in $(seq 1 12); do
  sleep 5
  FRONTEND_HEALTHY=$($COMPOSE_CMD "${COMPOSE_FILES[@]}" ps frontend --format json 2>/dev/null | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("Health","unknown"))' 2>/dev/null || echo "unknown")
  if [ "$FRONTEND_HEALTHY" = "healthy" ]; then
    ok "frontend 健康"
    break
  fi
  if [ $i -eq 12 ]; then
    err "frontend 健康检查超时（60 秒）"
    err "使用以下命令查看日志: $COMPOSE_CMD ${COMPOSE_FILES[*]} logs frontend"
    exit 1
  fi
  warn "等待中... frontend=$FRONTEND_HEALTHY"
done

# 如果是 Nginx 模式，最后启动 Nginx
if [ "$MODE" = "nginx" ]; then
  log "[+] 启动 nginx 反向代理..."
  $COMPOSE_CMD "${COMPOSE_FILES[@]}" up -d nginx
  sleep 3
  NGINX_HEALTHY=$($COMPOSE_CMD "${COMPOSE_FILES[@]}" ps nginx --format json 2>/dev/null | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("Health","unknown"))' 2>/dev/null || echo "unknown")
  if [ "$NGINX_HEALTHY" = "healthy" ]; then
    ok "nginx 健康"
  else
    warn "nginx 启动中，状态: $NGINX_HEALTHY"
  fi

  # ============== 配置漂移防护（R14/R7）==============
  # 防止服务器 nginx.conf 与仓库版本不一致（如手工编辑后未同步）
  # 检查运行时配置中是否包含关键的 /uploads/ location（媒体库依赖）
  log "[+] 校验 nginx 运行时配置..."
  NGINX_CONF_RUNTIME=$($COMPOSE_CMD "${COMPOSE_FILES[@]}" exec -T nginx nginx -T 2>/dev/null || echo "")
  if [ -z "$NGINX_CONF_RUNTIME" ]; then
    warn "无法读取 nginx 运行时配置（容器可能未完全启动），跳过漂移校验"
  else
    NGINX_DRIFT=0
    # 关键 location 列表（缺失将导致功能故障）
    for LOC in "/api/" "/admin" "/uploads/" "/_health"; do
      if ! echo "$NGINX_CONF_RUNTIME" | grep -q "location $LOC"; then
        err "nginx 运行时配置缺少关键 location: $LOC"
        NGINX_DRIFT=1
      fi
    done
    if [ "$NGINX_DRIFT" -eq 1 ]; then
      err "nginx 配置漂移检测到！服务器配置与 nginx/nginx.conf 不一致"
      err "修复方式: rsync 同步 nginx/nginx.conf 后执行: $COMPOSE_CMD ${COMPOSE_FILES[*]} restart nginx"
      exit 1
    fi
    ok "nginx 配置漂移校验通过"
  fi
fi

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
echo ""
echo -e "   ${GREEN}服务状态:${NC}"
$COMPOSE_CMD "${COMPOSE_FILES[@]}" ps
echo ""

if [ "$MODE" = "nginx" ]; then
  NGINX_PORT="$(grep -E '^NGINX_PORT=' .env | cut -d= -f2 || echo 80)"
  SERVER_IP="$(curl -s ifconfig.me 2>/dev/null || echo 'SERVER_IP')"
  echo -e "   ${GREEN}访问地址:${NC} http://$SERVER_IP:${NGINX_PORT}"
  echo -e "   ${GREEN}管理后台:${NC} http://$SERVER_IP:${NGINX_PORT}/admin"
else
  FRONTEND_PORT="$(grep -E '^FRONTEND_PORT=' .env | cut -d= -f2 || echo 3000)"
  BACKEND_PORT="$(grep -E '^BACKEND_PORT=' .env | cut -d= -f2 || echo 1337)"
  SERVER_IP="$(curl -s ifconfig.me 2>/dev/null || echo 'SERVER_IP')"
  echo -e "   ${GREEN}前端地址:${NC} http://$SERVER_IP:${FRONTEND_PORT}"
  echo -e "   ${GREEN}后端 API:${NC} http://$SERVER_IP:${BACKEND_PORT}"
  echo -e "   ${GREEN}管理后台:${NC} http://$SERVER_IP:${BACKEND_PORT}/admin"
fi
echo ""
echo -e "   ${GREEN}查看日志:${NC} ./deploy.sh --logs"
echo -e "   ${GREEN}查看状态:${NC} ./deploy.sh --status"
echo -e "   ${GREEN}停止服务:${NC} ./deploy.sh --down"
echo ""
