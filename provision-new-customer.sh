#!/usr/bin/env bash
# =============================================================================
# 一键开通知了母站客户实例
#
# 流程：参数校验 → 母站 DB dump（排除实例数据表）→ 新实例 DB 恢复
#       → .env 生成（全新密钥）→ 服务器分发 → 部署 → bootstrap 自检确认
#
# KB 隔离（决策 D7）：dump 排除 knowledge_bases + knowledge_embeddings +
# uploads 等实例数据表，新实例 KB 从空开始由镜像同步派生，母站内容零泄漏。
#
# 用法：
#   ./provision-new-customer.sh \
#     --customer-id acme \
#     --domain acme.example.com \
#     --admin-email admin@acme.com \
#     --server-host 1.2.3.4 [--server-user ubuntu] [--dry-run]
#
# 前置条件：
#   - 本地有母站代码仓库（本脚本所在仓库）
#   - 母站数据库可访问（MASTER_DB_* 环境变量或默认值）
#   - 目标服务器 SSH 免密可登录，已装 Docker
#   - central admin 已创建该 customer + enrollment code（ENROLLMENT_CODE 环境变量）
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------- 参数解析 ----------
CUSTOMER_ID="" DOMAIN="" ADMIN_EMAIL="" SERVER_HOST="" SERVER_USER="ubuntu"
DRY_RUN=false

usage() {
  cat <<EOF
用法: $0 --customer-id <id> --domain <域名> --admin-email <邮箱> --server-host <IP>
          [--server-user ubuntu] [--dry-run]

必填:
  --customer-id    客户标识（小写字母数字-，用于目录/DB/容器命名）
  --domain         客户站点域名
  --admin-email    客户 Strapi admin 邮箱
  --server-host    目标服务器 IP/主机名
可选:
  --server-user    SSH 用户（默认 ubuntu）
  --dry-run        只打印将执行的命令，不执行任何副作用

环境变量:
  MASTER_DB_HOST/MASTER_DB_PORT/MASTER_DB_NAME/MASTER_DB_USER/MASTER_DB_PASSWORD  母站库连接
  ENROLLMENT_CODE    central agent 注册码（不填则跳过 agent 注册步骤并提醒）
EOF
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --customer-id) CUSTOMER_ID="$2"; shift 2;;
    --domain) DOMAIN="$2"; shift 2;;
    --admin-email) ADMIN_EMAIL="$2"; shift 2;;
    --server-host) SERVER_HOST="$2"; shift 2;;
    --server-user) SERVER_USER="$2"; shift 2;;
    --dry-run) DRY_RUN=true; shift;;
    -h|--help) usage;;
    *) echo "未知参数: $1"; usage;;
  esac
done

[[ -z "$CUSTOMER_ID" || -z "$DOMAIN" || -z "$ADMIN_EMAIL" || -z "$SERVER_HOST" ]] && usage

# customer-id 格式校验（将用于 DB/目录/容器名，必须安全）
if ! [[ "$CUSTOMER_ID" =~ ^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$ ]]; then
  echo "ERROR: --customer-id 必须匹配 ^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$（小写字母数字-，3-32 字符）" >&2
  exit 1
fi

# ---------- 运行封装 ----------
run() {
  if $DRY_RUN; then echo "[DRY-RUN] $*"; else echo "+ $*"; "$@"; fi
}

# ---------- 母站 DB 连接（可用环境变量覆盖） ----------
MASTER_DB_HOST="${MASTER_DB_HOST:-127.0.0.1}"
MASTER_DB_PORT="${MASTER_DB_PORT:-5432}"
MASTER_DB_NAME="${MASTER_DB_NAME:-yousen_db}"
MASTER_DB_USER="${MASTER_DB_USER:-yousen}"
export PGPASSWORD="${MASTER_DB_PASSWORD:-}"

# ---------- 实例数据表（dump 排除，新实例从零派生） ----------
# knowledge_bases/embeddings: KB 隔离（D7），新实例由镜像同步派生
# upload_files*: 媒体库是实例数据
# leads/chat: 客户线索与聊天记录是实例数据
EXCLUDE_TABLES=(
  knowledge_bases knowledge_embeddings
  upload_files upload_files_related_mph upload_files_folder_links
  leads chat_sessions chat_messages
  admin_users admin_users_roles_links   # admin 账号不复制（新实例用新密钥初始化）
)
EXCLUDE_ARGS=()
for t in "${EXCLUDE_TABLES[@]}"; do EXCLUDE_ARGS+=(--exclude-table-data="$t"); done

# ---------- 随机密钥生成 ----------
rand_secret() { openssl rand -base64 32 | tr -d '\n'; }

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="/tmp/master-dump-${CUSTOMER_ID}-${TIMESTAMP}.sql"

echo "=========================================="
echo " 开通客户实例: ${CUSTOMER_ID}"
echo " 域名: ${DOMAIN}  服务器: ${SERVER_USER}@${SERVER_HOST}"
$DRY_RUN && echo " 模式: DRY-RUN（不执行副作用）"
echo "=========================================="

# ---------- 步骤 1：母站 DB dump（排除实例数据表） ----------
echo ""
echo "[1/6] 导出母站数据库（排除 ${#EXCLUDE_TABLES[@]} 张实例数据表）..."
run pg_dump -h "$MASTER_DB_HOST" -p "$MASTER_DB_PORT" -U "$MASTER_DB_USER" -d "$MASTER_DB_NAME" \
  --no-owner --no-privileges "${EXCLUDE_ARGS[@]}" -f "$DUMP_FILE"

# ---------- 步骤 2：生成 .env（全新密钥——绝不用母站密钥） ----------
echo ""
echo "[2/6] 生成实例 .env（全新随机密钥）..."
ENV_FILE="/tmp/.env-${CUSTOMER_ID}-${TIMESTAMP}"
if $DRY_RUN; then
  echo "[DRY-RUN] 生成 $ENV_FILE（含 DATABASE_/APP_KEYS/JWT/MEILISEARCH 等，密钥全部随机生成）"
else
  NEW_DB_PASSWORD="$(rand_secret)"
  cat > "$ENV_FILE" <<ENVEOF
# ===== 实例标识（provision-new-customer.sh 生成于 ${TIMESTAMP}）=====
CUSTOMER_ID=${CUSTOMER_ID}
DOMAIN=${DOMAIN}

# ===== Database =====
DATABASE_CLIENT=postgres
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=${CUSTOMER_ID}_db
DATABASE_USERNAME=${CUSTOMER_ID}
DATABASE_PASSWORD=${NEW_DB_PASSWORD}

# ===== Strapi 密钥（全新随机生成，绝不用母站密钥）=====
APP_KEYS=$(rand_secret),$(rand_secret)
API_TOKEN_SALT=$(rand_secret)
ADMIN_JWT_SECRET=$(rand_secret)
TRANSFER_TOKEN_SALT=$(rand_secret)
ENCRYPTION_KEY=$(rand_secret)
JWT_SECRET=$(rand_secret)

# ===== MeiliSearch =====
MEILISEARCH_HOST=http://meilisearch:7700
MEILISEARCH_API_KEY=$(rand_secret)

# ===== Redis =====
REDIS_HOST=redis
REDIS_PORT=6379

# ===== AI（Qwen）=====
AI_API_KEY=
AI_MODEL=qwen-plus
ENVEOF
  echo "  已生成: $ENV_FILE（AI_API_KEY 留空，部署后在 admin 配置）"
fi

# ---------- 步骤 3：服务器分发（代码 + .env + dump） ----------
REMOTE_DIR="/opt/${CUSTOMER_ID}"
echo ""
echo "[3/6] 分发到服务器 ${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}..."
run ssh "${SERVER_USER}@${SERVER_HOST}" "sudo mkdir -p ${REMOTE_DIR} && sudo chown ${SERVER_USER}:${SERVER_USER} ${REMOTE_DIR}"
run rsync -az --delete \
  --exclude .env --exclude node_modules --exclude 'backend/public/uploads/' --exclude .git \
  "${SCRIPT_DIR}/" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/"
if ! $DRY_RUN; then
  scp "$ENV_FILE" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/.env"
  scp "$DUMP_FILE" "${SERVER_USER}@${SERVER_HOST}:/tmp/"
fi

# ---------- 步骤 4：新实例 DB 恢复 ----------
echo ""
echo "[4/6] 目标服务器建库并恢复 dump..."
run ssh "${SERVER_USER}@${SERVER_HOST}" bash -s <<REMOTE
set -euo pipefail
cd ${REMOTE_DIR}
sudo docker compose up -d postgres
sleep 5
sudo docker compose exec -T postgres psql -U postgres -c "CREATE USER ${CUSTOMER_ID} WITH PASSWORD '${NEW_DB_PASSWORD:-DRYRUN_PW}';" || true
sudo docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE ${CUSTOMER_ID}_db OWNER ${CUSTOMER_ID};" || true
sudo docker compose exec -T postgres psql -U postgres -d ${CUSTOMER_ID}_db -c 'CREATE EXTENSION IF NOT EXISTS vector;' || true
sudo docker compose exec -T postgres psql -U postgres -d ${CUSTOMER_ID}_db < $(basename "$DUMP_FILE" | sed 's|^|/tmp/|')
REMOTE

# ---------- 步骤 5：部署（构建 + 启动全栈） ----------
echo ""
echo "[5/6] 构建并启动全栈服务..."
run ssh "${SERVER_USER}@${SERVER_HOST}" bash -s <<REMOTE
set -euo pipefail
cd ${REMOTE_DIR}
sudo docker compose build backend frontend
sudo docker compose up -d
REMOTE

# ---------- 步骤 6：bootstrap 自检确认（D4/D5：开通即用） ----------
echo ""
echo "[6/6] 等待 backend 启动并确认自检报告..."
run ssh "${SERVER_USER}@${SERVER_HOST}" bash -s <<'REMOTE'
set -euo pipefail
cd '"${REMOTE_DIR}"'
for i in $(seq 1 36); do
  sleep 5
  if sudo docker compose logs backend 2>&1 | grep -q '\[bootstrap-health\]'; then
    echo "--- bootstrap-health 报告 ---"
    sudo docker compose logs backend 2>&1 | grep '\[bootstrap-health\]' | tail -5
    if sudo docker compose logs backend 2>&1 | grep -q '\[bootstrap-health\] FAIL'; then
      echo "ERROR: bootstrap 自检存在 FAIL 项，请检查上方报告" >&2
      exit 1
    fi
    echo "bootstrap 自检通过"
    exit 0
  fi
done
echo "ERROR: 180s 内未见 bootstrap-health 报告，backend 可能未正常启动" >&2
sudo docker compose logs --tail=50 backend >&2 || true
exit 1
REMOTE

# ---------- 完成 ----------
echo ""
echo "=========================================="
echo " 客户实例开通完成: ${CUSTOMER_ID}"
echo " 站点: https://${DOMAIN}（需自行配置 nginx/DNS 指向 ${SERVER_HOST}）"
echo " 后续步骤:"
echo "   1. 配置 DNS + nginx 反代 + HTTPS 证书"
echo "   2. 后台配置 AI_API_KEY（Content Manager → ai_configs）"
echo "   3. 创建客户 Editor 账号: create-editor-account.ts"
if [[ -z "${ENROLLMENT_CODE:-}" ]]; then
  echo "   4. [未提供 ENROLLMENT_CODE] 在 central admin 创建注册码后，"
  echo "      在服务器上执行 agent 注册（见 central 文档）"
else
  echo "   4. 使用 ENROLLMENT_CODE 注册 central agent"
fi
echo "=========================================="
