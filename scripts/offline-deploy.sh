#!/bin/bash
# 离线部署脚本（GitHub 完全不可用时使用）
# 用法：./scripts/offline-deploy.sh <SERVER_IP> [DEPLOY_PATH]
# 示例：./scripts/offline-deploy.sh 1.2.3.4 /opt/yousen
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
scp /tmp/yousen-deploy.tar.gz "root@$SERVER_IP:/tmp/"

echo "[3/4] 远程解压..."
ssh "root@$SERVER_IP" "cd '$DEPLOY_PATH' && tar -xzf /tmp/yousen-deploy.tar.gz && rm /tmp/yousen-deploy.tar.gz"

echo "[4/4] 远程部署..."
ssh "root@$SERVER_IP" "cd '$DEPLOY_PATH' && ./deploy.sh --no-pull --nginx -d"

# 清理本地临时文件
rm -f /tmp/yousen-deploy.tar.gz

echo "✅ 离线部署完成"
