#!/usr/bin/env bash
#
# Docker 启动脚本 —— 自动安装依赖并运行生产构建验证
#
# 用法:
#   ./docker-start.sh            # 构建并前台运行
#   ./docker-start.sh -d         # 后台运行（detached）
#   ./docker-start.sh --clean    # 构建前清理悬空镜像和构建缓存
#   ./docker-start.sh --no-build # 不重新构建，仅启动已有镜像
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
CLEAN=0
NO_BUILD=0
for arg in "$@"; do
  case "$arg" in
    -d|--detach) DETACHED=1 ;;
    --clean)     CLEAN=1 ;;
    --no-build)  NO_BUILD=1 ;;
    -h|--help)
      sed -n '2,10p' "$0"
      exit 0
      ;;
    *)
      err "未知参数: $arg"
      exit 1
      ;;
  esac
done

# ============== 检测操作系统 ==============
OS_ID="$(grep -E '^ID=' /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d '"' || true)"
OS_FAMILY="unknown"
case "$OS_ID" in
  ubuntu|debian) OS_FAMILY="debian" ;;
  centos|rhel|fedora|rocky|alma) OS_FAMILY="rhel" ;;
  alpine) OS_FAMILY="alpine" ;;
esac

# ============== 1. 检测/安装 Docker ==============
install_docker() {
  log "正在为 $OS_FAMILY 系系统安装 Docker..."
  case "$OS_FAMILY" in
    debian)
      sudo apt-get update -y
      sudo apt-get install -y ca-certificates curl gnupg
      sudo install -m 0755 -d /etc/apt/keyrings
      if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
          sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      fi
      sudo chmod a+r /etc/apt/keyrings/docker.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
        sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
      sudo apt-get update -y
      sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      ;;
    rhel)
      sudo dnf -y install dnf-plugins-core
      sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
      sudo dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      ;;
    alpine)
      sudo apk add --no-cache docker docker-cli-compose
      ;;
    *)
      err "不支持的操作系统: $OS_ID"
      err "请手动安装 Docker: https://docs.docker.com/engine/install/"
      exit 1
      ;;
  esac

  # 启动并设置开机自启
  sudo systemctl enable --now docker 2>/dev/null || true

  # 将当前用户加入 docker 组（需重新登录生效）
  if ! id -nG | grep -qw docker; then
    sudo usermod -aG docker "$USER" 2>/dev/null || true
    warn "已将当前用户加入 docker 组，需要注销重新登录后才能免 sudo 使用 docker"
  fi
}

if ! command -v docker &> /dev/null; then
  warn "未检测到 Docker，开始自动安装..."
  install_docker
  # 安装后若仍需 sudo，则后续命令都加 sudo
  if ! docker info &> /dev/null; then
    warn "Docker 已安装但当前用户无权限，本次将使用 sudo 运行 docker 命令"
    DOCKER_PREFIX="sudo"
  else
    ok "Docker 安装完成并可用"
    DOCKER_PREFIX=""
  fi
else
  ok "Docker 已安装: $(docker --version)"
  DOCKER_PREFIX=""
  # 确认 docker daemon 在运行
  if ! ${DOCKER_PREFIX} docker info &> /dev/null; then
    warn "Docker daemon 未运行，尝试启动..."
    sudo systemctl start docker 2>/dev/null || sudo service docker start 2>/dev/null || {
      err "无法启动 Docker daemon，请手动启动后重试"
      exit 1
    }
    ok "Docker daemon 已启动"
  fi
fi

# ============== 2. 检测 docker compose 命令 ==============
if ${DOCKER_PREFIX} docker compose version &> /dev/null; then
  COMPOSE_CMD="${DOCKER_PREFIX} docker compose"
  ok "使用 docker compose v2"
elif command -v docker-compose &> /dev/null; then
  COMPOSE_CMD="${DOCKER_PREFIX} docker-compose"
  warn "使用 docker-compose v1（建议升级到 v2）"
else
  err "未检测到 docker compose 命令"
  err "请安装 docker-compose-plugin: sudo apt-get install docker-compose-plugin"
  exit 1
fi

# ============== 3. 切换到脚本所在目录 ==============
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
log "工作目录: $SCRIPT_DIR"

# ============== 4. 准备 .env 文件 ==============
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    ok "已从 .env.example 创建 .env"
    warn "请根据实际环境修改 .env 中的变量（尤其是 NEXT_PUBLIC_STRAPI_API_URL）"
  else
    err "未找到 .env 或 .env.example，请先创建环境配置文件"
    exit 1
  fi
else
  ok ".env 已存在"
fi

# ============== 5. 验证必要的环境变量 ==============
REQUIRED_VARS=("NEXT_PUBLIC_STRAPI_API_URL" "NEXT_PUBLIC_SITE_URL")
MISSING=0
for var in "${REQUIRED_VARS[@]}"; do
  val="$(grep -E "^${var}=" .env | cut -d= -f2- | tr -d '"' || true)"
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

# ============== 6. 可选清理 ==============
if [ "$CLEAN" -eq 1 ]; then
  log "清理悬空镜像和构建缓存..."
  ${DOCKER_PREFIX} docker builder prune -f --filter "until=24h" 2>/dev/null || true
  ${DOCKER_PREFIX} docker image prune -f 2>/dev/null || true
  ok "清理完成"
fi

# ============== 7. 构建并启动 ==============
BUILD_FLAG=""
if [ "$NO_BUILD" -eq 0 ]; then
  BUILD_FLAG="--build"
  log "开始构建并启动容器（首次构建可能需要 3-5 分钟）..."
else
  log "跳过构建，启动已有镜像..."
fi

DETACH_FLAG=""
if [ "$DETACHED" -eq 1 ]; then
  DETACH_FLAG="-d"
fi

# shellcheck disable=SC2086
$COMPOSE_CMD up $BUILD_FLAG $DETACH_FLAG

# ============== 8. 后续验证（仅 detached 模式）==============
if [ "$DETACHED" -eq 1 ]; then
  log "等待容器健康检查通过（最多 60 秒）..."
  for i in $(seq 1 12); do
    sleep 5
    STATUS="$(${DOCKER_PREFIX} docker compose ps --format json 2>/dev/null | \
      python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("Health","unknown"))' 2>/dev/null || echo "unknown")"
    if [ "$STATUS" = "healthy" ]; then
      ok "容器健康检查通过"
      break
    fi
    warn "等待中... 当前状态: $STATUS"
  done

  FRONTEND_PORT="$(grep -E '^FRONTEND_PORT=' .env | cut -d= -f2 || echo 3000)"
  SITE_URL="$(grep -E '^NEXT_PUBLIC_SITE_URL=' .env | cut -d= -f2 | tr -d '"' || echo "http://localhost:${FRONTEND_PORT}")"

  echo ""
  ok "✅ 部署完成！"
  echo -e "   ${GREEN}访问地址:${NC} $SITE_URL"
  echo -e "   ${GREEN}查看日志:${NC} $COMPOSE_CMD logs -f"
  echo -e "   ${GREEN}停止服务:${NC} $COMPOSE_CMD down"
  echo ""
fi
