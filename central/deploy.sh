#!/usr/bin/env bash
#
# 佑森中央管理后台 —— 全栈 Docker 部署脚本
#
# 用法:
#   ./deploy.sh                  # 默认部署（含 nginx）
#   ./deploy.sh -d               # 后台运行（detached）
#   ./deploy.sh --no-build       # 不重新构建，使用已有镜像
#   ./deploy.sh --no-pull        # 跳过 git pull（rsync 模式专用）
#   ./deploy.sh --backup         # 手动触发数据库备份
#   ./deploy.sh --status         # 查看服务状态
#   ./deploy.sh --logs [svc]     # 查看日志（可选指定服务）
#   ./deploy.sh --down           # 停止所有服务
#   ./deploy.sh -h               # 帮助
#
# 部署顺序:
#   1. 启动 postgres（等待健康检查）
#   2. 构建并启动 central-app（等待健康检查）
#   3. 启动 nginx 反向代理
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
DETACHED=0
NO_BUILD=0
NO_PULL=0          # rsync 模式专用，语义占位（同 C 块）
ACTION="up"        # up | status | logs | down | backup

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-build)        NO_BUILD=1; shift ;;
    --no-pull)         NO_PULL=1; shift ;;           # rsync 模式语义占位
    --backup)          ACTION="backup"; shift ;;
    -d|--detach)       DETACHED=1; shift ;;
    --status)          ACTION="status"; shift ;;
    --logs)            ACTION="logs"; shift; LOG_SERVICE="${1:-}"; shift || true ;;
    --down)            ACTION="down"; shift ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    *)
      err "未知参数: $1"
      exit 1
      ;;
  esac
done

# ============== 定位脚本目录（central/） ==============
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

detect_compose_cmd
ok "Docker: $(docker --version)"

# ============== 组装 compose 命令基础参数 ==============
COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.nginx.yml)

# ============== 处理 backup 动作 ==============
if [ "$ACTION" = "backup" ]; then
  bash "$SCRIPT_DIR/scripts/backup.sh"
  exit 0
fi

# ============== 处理 status / logs / down 动作 ==============
if [ "$ACTION" = "status" ]; then
  $COMPOSE_CMD "${COMPOSE_FILES[@]}" ps
  exit 0
fi

if [ "$ACTION" = "logs" ]; then
  if [ -n "${LOG_SERVICE:-}" ]; then
    $COMPOSE_CMD "${COMPOSE_FILES[@]}" logs -f "$LOG_SERVICE"
  else
    $COMPOSE_CMD "${COMPOSE_FILES[@]}" logs -f
  fi
  exit 0
fi

if [ "$ACTION" = "down" ]; then
  log "停止所有服务..."
  $COMPOSE_CMD "${COMPOSE_FILES[@]}" down
  ok "所有服务已停止"
  exit 0
fi

# ============== 以下是 up 动作 ==============

# 检查 docker daemon
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
    warn "尤其是：DATABASE_PASSWORD, JWT_SECRET, AES_KEY, ADMIN_JWT_SECRET, CENTRAL_DOMAIN 等安全密钥"
    warn "生成安全密钥命令: openssl rand -base64 32"
    exit 1
  else
    err "未找到 .env 或 .env.example"
    exit 1
  fi
fi

# 验证必要的环境变量
REQUIRED_VARS=("DATABASE_PASSWORD" "JWT_SECRET" "AES_KEY" "ADMIN_JWT_SECRET" "CENTRAL_DOMAIN")
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

# ============== 组装 compose 构建参数 ==============
BUILD_FLAG=""
if [ "$NO_BUILD" -eq 0 ]; then
  BUILD_FLAG="--build"
fi

DETACH_FLAG=""
if [ "$DETACHED" -eq 1 ]; then
  DETACH_FLAG="-d"
fi

# ============== 分阶段启动 ==============
log "=== Central 部署开始 ==="

# 阶段 1：postgres
log "[1/3] 启动 postgres..."
$COMPOSE_CMD "${COMPOSE_FILES[@]}" up -d postgres
ok "postgres 已启动，等待健康检查..."

for i in $(seq 1 30); do
  sleep 2
  PG_HEALTHY=$($COMPOSE_CMD "${COMPOSE_FILES[@]}" ps postgres --format json 2>/dev/null | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("Health","unknown"))' 2>/dev/null || echo "unknown")
  if [ "$PG_HEALTHY" = "healthy" ]; then
    ok "postgres 健康"
    break
  fi
  if [ $i -eq 30 ]; then
    err "postgres 健康检查超时（60 秒）"
    err "使用以下命令查看日志: $COMPOSE_CMD ${COMPOSE_FILES[*]} logs postgres"
    exit 1
  fi
  warn "等待中... pg=$PG_HEALTHY"
done

# 阶段 2：central-app
log "[2/3] 构建并启动 central-app..."
$COMPOSE_CMD "${COMPOSE_FILES[@]}" up -d $BUILD_FLAG central
ok "central-app 已启动，等待健康检查..."

for i in $(seq 1 24); do
  sleep 5
  APP_HEALTHY=$($COMPOSE_CMD "${COMPOSE_FILES[@]}" ps central --format json 2>/dev/null | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("Health","unknown"))' 2>/dev/null || echo "unknown")
  if [ "$APP_HEALTHY" = "healthy" ]; then
    ok "central-app 健康"
    break
  fi
  if [ $i -eq 24 ]; then
    err "central-app 健康检查超时（120 秒）"
    err "使用以下命令查看日志: $COMPOSE_CMD ${COMPOSE_FILES[*]} logs central"
    exit 1
  fi
  warn "等待中... central=$APP_HEALTHY"
done

# 阶段 3：nginx
log "[3/3] 启动 nginx 反向代理..."
$COMPOSE_CMD "${COMPOSE_FILES[@]}" up -d nginx
sleep 3
NGINX_HEALTHY=$($COMPOSE_CMD "${COMPOSE_FILES[@]}" ps nginx --format json 2>/dev/null | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("Health","unknown"))' 2>/dev/null || echo "unknown")
if [ "$NGINX_HEALTHY" = "healthy" ]; then
  ok "nginx 健康"
else
  warn "nginx 启动中，状态: $NGINX_HEALTHY"
fi

# ============== no-pull 模式日志（rsync 模式）==============
if [ "$NO_PULL" -eq 1 ]; then
  log "[mode] no-pull (rsync mode) — 代码由 rsync 同步，未执行 git pull"
fi

# ============== 输出访问信息 ==============
echo ""
ok "✅ Central 部署完成！"
echo ""
$COMPOSE_CMD "${COMPOSE_FILES[@]}" ps
echo ""
DOMAIN="$(grep -E '^CENTRAL_DOMAIN=' .env | cut -d= -f2- | tr -d '"' || echo 'localhost')"
echo "   管理后台: https://$DOMAIN/login"
echo "   Agent WebSocket: wss://$DOMAIN/api/agent/ws"
echo "   查看日志: ./deploy.sh --logs"
echo "   查看状态: ./deploy.sh --status"
echo "   停止服务: ./deploy.sh --down"
echo ""
