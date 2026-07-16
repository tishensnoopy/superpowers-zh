#!/bin/bash
# Central 数据库备份脚本
# 用法：./scripts/backup.sh（由 cron 或 deploy.sh --backup 调用）
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/central/central/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/control_db_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date +%H:%M:%S)] 开始备份 control_db..."

# 通过 docker exec 执行 pg_dump
if ! docker exec central-postgres pg_dump -U central control_db | gzip > "$BACKUP_FILE"; then
  echo "[$(date +%H:%M:%S)] ✗ 备份失败" >&2
  rm -f "$BACKUP_FILE"
  exit 1
fi

BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
echo "[$(date +%H:%M:%S)] ✓ 备份完成: $BACKUP_FILE ($BACKUP_SIZE)"

# 清理过期备份
DELETED=$(find "$BACKUP_DIR" -name "control_db_*.sql.gz" -mtime +${RETENTION_DAYS} -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "[$(date +%H:%M:%S)] 清理 $DELETED 个过期备份（>${RETENTION_DAYS}天）"
fi

# 列出当前备份
echo "[$(date +%H:%M:%S)] 当前备份列表:"
ls -lh "$BACKUP_DIR"/control_db_*.sql.gz 2>/dev/null | tail -5
