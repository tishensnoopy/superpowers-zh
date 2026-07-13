#!/usr/bin/env bash
#
# Docker 镜像加速器配置脚本
# 解决中国大陆访问 Docker Hub 的 DNS 污染和连接问题
#
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}!${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*" >&2; }

# 检查是否为 root
if [ "$EUID" -ne 0 ]; then
  err "请使用 sudo 运行: sudo ./configure-docker-mirrors.sh"
  exit 1
fi

echo -e "${BLUE}=== Docker 镜像加速器配置 ===${NC}\n"

# 备份现有 daemon.json
DAEMON_JSON="/etc/docker/daemon.json"
if [ -f "$DAEMON_JSON" ]; then
  cp "$DAEMON_JSON" "${DAEMON_JSON}.bak.$(date +%Y%m%d%H%M%S)"
  warn "已备份现有 daemon.json"
fi

# 确保目录存在
mkdir -p /etc/docker

# 测试镜像加速器可用性
echo "测试镜像加速器可用性..."
MIRRORS=()
for mirror in \
  "https://docker.1ms.run" \
  "https://docker.xuanyuan.me" \
  "https://docker.m.daocloud.io"; do
  echo -n "  $mirror -> "
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$mirror/v2/" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ 可用${NC}"
    MIRRORS+=("\"$mirror\"")
  else
    echo -e "${YELLOW}✗ 不可用 (HTTP $HTTP_CODE)${NC}"
  fi
done

if [ ${#MIRRORS[@]} -eq 0 ]; then
  err "所有镜像加速器均不可用，请检查网络"
  exit 1
fi

# 生成 daemon.json
MIRRORS_JSON=$(IFS=,; echo "${MIRRORS[*]}")
cat > "$DAEMON_JSON" <<EOF
{
  "registry-mirrors": [$MIRRORS_JSON],
  "dns": ["8.8.8.8", "1.1.1.1", "114.114.114.114"],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

ok "已写入 $DAEMON_JSON"
echo ""
echo "配置内容:"
cat "$DAEMON_JSON"
echo ""

# 重启 Docker daemon
echo "重启 Docker daemon..."
systemctl restart docker
sleep 2

if systemctl is-active --quiet docker; then
  ok "Docker daemon 已重启"
else
  err "Docker daemon 启动失败，请检查: journalctl -u docker"
  exit 1
fi

# 验证镜像加速器配置
echo ""
echo "验证配置:"
docker info 2>/dev/null | grep -A 5 "Registry Mirrors" || warn "未检测到 Registry Mirrors 配置"

# 测试拉取镜像
echo ""
echo "测试拉取镜像 (node:20-alpine)..."
if docker pull node:20-alpine 2>&1 | tail -5; then
  ok "镜像拉取成功！"
else
  warn "镜像拉取失败，可能需要等待或手动指定镜像源"
fi

echo ""
ok "配置完成！现在可以运行: ./docker-start.sh -d"
