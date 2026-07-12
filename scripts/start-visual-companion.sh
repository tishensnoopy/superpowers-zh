#!/usr/bin/env bash
# 视觉伴侣启动脚本（修复 owner process 看门狗问题）
#
# 问题根因：start-server.sh 把 BRAINSTORM_OWNER_PID 设为 Shell 工具进程的 PID，
# Shell 退出后服务器检测到 owner 进程死亡就自动终止。
#
# 修复方案：设置 BRAINSTORM_OWNER_PID="" 禁用看门狗，仅靠 idle timeout (4h) 自动关闭。
#
# 用法：bash scripts/start-visual-companion.sh

set -e

PROJECT_DIR="/home/tishensnoopy/project/superpowers-zh"
SKILL_DIR="${PROJECT_DIR}/.trae/skills/brainstorming"
BRAINSTORM_DIR="${PROJECT_DIR}/.superpowers/brainstorm"
PORT_FILE="${BRAINSTORM_DIR}/.last-port"
TOKEN_FILE="${BRAINSTORM_DIR}/.last-token"
SESSION_ID="manual-$(date +%s)"
SESSION_DIR="${BRAINSTORM_DIR}/${SESSION_ID}"

# 清理旧的视觉伴侣进程（避免端口冲突）
pkill -f "brainstorming/scripts/server.cjs" 2>/dev/null || true
sleep 1

# 创建 session 目录
mkdir -p "${SESSION_DIR}/content" "${SESSION_DIR}/state"

# 启动服务器，关键修复：BRAINSTORM_OWNER_PID="" 禁用看门狗
nohup env \
  BRAINSTORM_DIR="${SESSION_DIR}" \
  BRAINSTORM_HOST="127.0.0.1" \
  BRAINSTORM_URL_HOST="localhost" \
  BRAINSTORM_OWNER_PID="" \
  BRAINSTORM_PORT_FILE="${PORT_FILE}" \
  BRAINSTORM_TOKEN_FILE="${TOKEN_FILE}" \
  node "${SKILL_DIR}/scripts/server.cjs" \
  > "${SESSION_DIR}/state/server.log" 2>&1 &

SERVER_PID=$!
echo "${SERVER_PID}" > "${SESSION_DIR}/state/server.pid"
disown "${SERVER_PID}" 2>/dev/null || true

# 等待服务器启动（最多 5 秒）
for i in $(seq 1 50); do
  if grep -q "server-started" "${SESSION_DIR}/state/server.log" 2>/dev/null; then
    break
  fi
  sleep 0.1
done

# 输出启动结果
grep "server-started" "${SESSION_DIR}/state/server.log" 2>/dev/null || {
  echo "ERROR: 服务器启动失败，日志内容："
  cat "${SESSION_DIR}/state/server.log" 2>/dev/null
  exit 1
}
