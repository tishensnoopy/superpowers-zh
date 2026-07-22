# 客户服务器加固与故障恢复 Runbook

**日期**：2026-07-21
**适用**：佑森小课堂生产环境（yoosen.cn / 121.196.210.191）+ 所有从母站克隆的客户实例
**作者**：基于 2026-07-21 服务器卡死事故复盘

---

## 一、故障现象与根因

### 1.1 现象

- 客户站点 `https://yoosen.cn/` HTTPS 请求超时（curl exit 28）
- SSH banner 超时（连得上 22 端口但无响应）
- ping 服务器正常（ICMP 通）
- TCP 端口 22/80/443 都能 SYN 通
- 但任何应用层协议（SSH/HTTP/HTTPS）都拿不到响应

### 1.2 根因

**典型的"内核活着、用户态进程被饿死"症状**，三个原因叠加：

1. **物理内存严重不足**：阿里云 ECS 是 2 核 2GB（实际可用约 1.6GB），要同时跑 7 个容器：
   - backend (Strapi + LLM service + RAG)：常态 270MB，峰值可达 1GB
   - frontend (Next.js)：常态 70MB
   - postgres：常态 75MB
   - meilisearch：常态 11MB
   - redis：常态 15MB
   - nginx：常态 12MB
   - agent-prod：常态 35MB
   - 加上 docker daemon、systemd、sshd 等，物理内存常态紧张

2. **swappiness=0（核心 bug）**：虽然配了 4GB swap，但 `vm.swappiness=0` 让内核极度不愿意主动用 swap，遇到内存紧张直接走 OOM killer 杀进程。OOM 杀进程不可控，可能杀掉 sshd / dockerd / nginx → 系统挂起无响应。

3. **nginx 和 agent-prod 容器无内存限制**：单个容器内存爆发会吃光所有物理内存，触发雪崩。

### 1.3 为什么会反复卡死

每次卡死的诱因可能是：
- Strapi admin 操作（批量内容更新、rebuild）
- 媒体库上传大图（生成多份缩略图）
- AI 客服 burst 流量
- meilisearch 重建索引
- 任何 Node.js 进程的 V8 GC 暂停 + 内存峰值

诱因本身不可控，但**可以通过加固让单个容器吃满内存时不会拖垮全机**。

---

## 二、立即恢复步骤（卡死时）

### 2.1 第一步：阿里云控制台强制重启

无法 SSH 时唯一选项：

1. 阿里云控制台 → ECS 实例列表 → 找到 `121.196.210.191`
2. 实例详情 → 「远程连接」→ 选 **VNC 连接**（不依赖 SSH 服务）
3. VNC 终端里用 root 登录后执行 `reboot`
4. 如果 `reboot` 命令也卡住，回阿里云控制台点「强制重启」

### 2.2 第二步：恢复后 SSH 验证

```bash
ssh -i ~/.ssh/central_deploy root@121.196.210.191 'docker ps; free -h; curl -sk -o /dev/null -w "%{http_code}" https://yoosen.cn/'
```

期望：所有容器 Up + HTTP 200 + 可用内存 > 300MB。

---

## 三、短期加固方案（已实施 2026-07-21）

### 3.1 修改 swappiness（关键止血措施）

```bash
# 临时生效
sysctl -w vm.swappiness=10

# 永久生效
grep -q "^vm.swappiness" /etc/sysctl.conf \
  && sed -i "s/^vm.swappiness=.*/vm.swappiness=10/" /etc/sysctl.conf \
  || echo "vm.swappiness=10" >> /etc/sysctl.conf
```

**为什么是 10 不是 60**：
- 默认值 60 太激进，会频繁 swap 拖慢系统
- 0 极端保守，遇到内存紧张直接 OOM 杀进程
- 10 是经验值：只在物理内存真的紧张时才 swap，平衡稳定性和性能

### 3.2 给所有容器加内存限制

**已生效的内存分配（物理 1.6GB + swap 4GB）**：

| 容器 | mem_limit | mem_reservation | 备注 |
|---|---|---|---|
| yousen-backend | 1G | 256M | Strapi+LLM，给足 |
| yousen-frontend | 512M | 128M | Next.js |
| yousen-postgres | 512M | 128M | 数据库，稳 |
| yousen-meilisearch | 512M | 128M | 搜索引擎 |
| yousen-redis | 128M | 32M | 缓存 |
| yousen-nginx | 100M | 30M | 反代 |
| yousen-agent-prod | 200M | 50M | central agent |
| **合计** | **2.95G** | **762M** | 限制总和大于物理内存，但有 swap 兜底 |

**修改的文件**：
- `/opt/customer-site/docker-compose.yml`：postgres/redis/meilisearch/backend/frontend 已有限制
- `/opt/customer-site/docker-compose.nginx.yml`：加 nginx 限制（100M / 30M）+ logging 轮转
- `/opt/customer-site/scripts/agent-compose.yml`：加 agent 限制（200M / 50M）+ logging 轮转

**立即生效方式（零停机）**：

```bash
# 用 docker update 立即应用内存限制，无需重启容器
docker update --memory=100M --memory-swap=-1 --memory-reservation=30M yousen-nginx
docker update --memory=200M --memory-swap=-1 --memory-reservation=50M yousen-agent-prod
```

⚠️ **必须同时设 `--memory-swap=-1`**（表示 swap 不限），否则 Docker 报错：
```
Memory limit should be smaller than already set memoryswap limit
```

### 3.3 创建 cron 自动健康检查脚本

**脚本位置**：`/opt/customer-site/scripts/health-check.sh`

**关键设计**：
- 通过 nginx 反代路径检查（backend/frontend 端口不暴露给宿主机，由 nginx compose 覆盖为 `!reset []`）
  - nginx 自己：`https://127.0.0.1:443/` 期望 200
  - backend 健康：`https://127.0.0.1:443/_health` 期望 204
  - frontend 健康：`https://127.0.0.1:443/` 期望 200（同 nginx 检查项，但是 nginx 通过反代到 frontend）
- 单次失败不重启（避免抖动），连续 3 次才 `docker restart`
- 可用内存 < 100MB 主动重启 backend 释放
- 单实例锁 `flock` 防止 cron 重叠执行
- 所有事件通过 `logger` 写入 syslog

**安装到 crontab**：

```bash
(crontab -l 2>/dev/null; echo "* * * * * /opt/customer-site/scripts/health-check.sh >> /var/log/customer-health-check.log 2>&1") | grep -v "^$" | sort -u | crontab -
```

### 3.4 验证加固效果

```bash
# 1. 容器限制
docker stats --no-stream
# 2. swappiness
cat /proc/sys/vm/swappiness  # 期望 10
# 3. cron 任务
crontab -l
# 4. 健康检查日志
tail -50 /var/log/customer-health-check.log
# 5. 站点访问
curl -sk -o /dev/null -w "%{http_code}\n" https://yoosen.cn/  # 期望 200
```

---

## 四、中期加固方案（待实施）

### 4.1 阿里云云监控告警

阿里云控制台 → 云监控 → 应用分组：

1. 创建应用分组「客户服务器」
2. 加入 ECS 实例 `121.196.210.191`
3. 创建报警规则（通知方式：短信）：

| 指标 | 阈值 | 持续 | 通知 |
|---|---|---|---|
| CPU 使用率 | > 85% | 5 分钟 | 短信 |
| 内存使用率 | > 90% | 3 分钟 | 短信 |
| 系统盘使用率 | > 80% | 1 分钟 | 短信 |
| 公网流入带宽 | > 80% | 5 分钟 | 短信 |
| 公网流出带宽 | > 80% | 5 分钟 | 短信 |
| 系统平均负载 | > 2 | 5 分钟 | 短信 |

### 4.2 日志轮转（部分已实施）

主 compose 各容器已配 `logging.options.max-size: 10m, max-file: 3`。

还需配置系统级 logrotate：
```bash
cat > /etc/logrotate.d/customer-site <<'EOF'
/var/log/customer-health-check.log {
    daily
    rotate 14
    compress
    missingok
    notifempty
    create 644 root root
}
EOF
```

### 4.3 systemd watchdog（可选）

为关键服务添加 `WatchdogSec=` 自动重启：

```bash
mkdir -p /etc/systemd/system/docker.service.d/
cat > /etc/systemd/system/docker.service.d/override.conf <<'EOF'
[Service]
WatchdogSec=60
Restart=always
RestartSec=10
EOF
systemctl daemon-reload
```

---

## 五、长期方案（按需）

| 方案 | 成本 | 收益 | 时机 |
|---|---|---|---|
| 升级到 2 核 4GB | +¥60/月 | 物理内存翻倍，几乎不会 OOM | 频繁出现内存告警时 |
| 升级到 4 核 8GB | +¥200/月 | 长期稳定，可加监控/分析 | 多客户共享一台时 |
| Postgres 迁到 RDS | +¥100/月 | 数据库独立，应用服务器减负 | 数据量增长后 |
| 加 CloudMonitor 自定义指标 | 免费 | 容器级别指标更精细 | 中长期 |

---

## 六、加固后再次卡死的排查

如果加固后服务器再次卡死：

1. **重启后立即看日志**：

```bash
# OOM 历史
dmesg | grep -iE "oom|killed process" | tail -20
# syslog OOM
grep -iE "oom|killed process" /var/log/syslog | tail -30
# 健康检查日志
tail -100 /var/log/customer-health-check.log
# 容器重启历史
docker events --since 30m --until 0s 2>&1 | head -30
# 各容器退出原因
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.State}}"
```

2. **看哪个容器吃内存最多**：

```bash
docker stats --no-stream
```

3. **看 backend 是否被 OOM kill 过**：

```bash
docker inspect yousen-backend | grep -A 5 "OOMKilled"
docker inspect yousen-backend | grep -A 5 "ExitCode"
```

4. **临时缓解**：

```bash
# 如果是 backend 反复 OOM，临时调高限制
docker update --memory=1500M --memory-swap=-1 yousen-backend
# 或者重启所有容器
cd /opt/customer-site && docker compose -f docker-compose.yml -f docker-compose.nginx.yml restart
```

5. **彻底解决**：升级 ECS 配置到 4GB。

---

## 七、SSH 公钥配置（一次性）

服务器重启后 VNC 配置 SSH 公钥免密登录的命令：

```bash
mkdir -p ~/.ssh && echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIM4cNSfQ80jFodm5kU1yYrMbLvjeijPKW2iRrYX1WRvs central-deploy" >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys && echo "SSH_KEY_OK"
```

客户端使用：

```bash
ssh -i ~/.ssh/central_deploy -o IdentitiesOnly=yes root@121.196.210.191
```

---

## 八、变更文件清单

### 服务器端

| 文件 | 变更 | 状态 |
|---|---|---|
| `/etc/sysctl.conf` | 加 `vm.swappiness=10` | ✅ 已持久化 |
| `/opt/customer-site/docker-compose.nginx.yml` | nginx 加 mem_limit 100M + logging | ✅ 已部署 |
| `/opt/customer-site/scripts/agent-compose.yml` | agent 加 mem_limit 200M + logging | ✅ 已部署 |
| `/opt/customer-site/scripts/health-check.sh` | 新建（每分钟健康检查） | ✅ 已部署 |
| `/var/spool/cron/crontabs/root` | 加 `* * * * * /opt/customer-site/scripts/health-check.sh` | ✅ 已安装 |
| `/var/log/customer-health-check.log` | 日志文件 | ✅ 已创建 |
| `/var/lib/customer-health-check/` | 失败计数状态目录 | ✅ 已创建 |

### 客户端（本机）

| 文件 | 用途 |
|---|---|
| `/tmp/customer-server-files/docker-compose.nginx.yml` | 修改后副本 |
| `/tmp/customer-server-files/agent-compose.yml` | 修改后副本 |
| `/tmp/customer-server-files/health-check.sh` | 脚本源文件 |

---

## 九、复盘要点

### 9.1 经验教训

1. **swap ≠ 万能**：配了 swap 但 swappiness=0 等于没配。Linux 内核默认值不一定适合生产。
2. **Docker 容器默认无内存限制**：用 `docker run` 启动的容器尤其要主动加 `--memory`。
3. **健康检查要分层**：通过 nginx 反代检查 backend/frontend 比直连端口更准（端口可能不暴露）。
4. **`docker update` 零停机生效**：比修改 compose 后重启容器更安全，但要持久化必须改 compose 文件。
5. **OOM 历史不直观**：dmesg 在容器内看不到，要看宿主机 `dmesg` 或 `/var/log/syslog`。

### 9.2 部署到新客户的标准动作

部署新客户实例时，应作为「开箱必做」执行：

```bash
# 1. 确认 swap（无则加 4GB）
swapon --show || (fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab)

# 2. 设置 swappiness=10
sysctl -w vm.swappiness=10
grep -q "^vm.swappiness" /etc/sysctl.conf && sed -i "s/^vm.swappiness=.*/vm.swappiness=10/" /etc/sysctl.conf || echo "vm.swappiness=10" >> /etc/sysctl.conf

# 3. 给所有容器加内存限制（在 docker-compose.yml）
# 4. 部署 health-check.sh 到 /opt/customer-site/scripts/
# 5. 安装 cron
# 6. 配置阿里云云监控告警
```

### 9.3 监控指标基线

正常状态下（无业务流量）的基线：

| 指标 | 基线值 | 告警阈值 |
|---|---|---|
| CPU 使用率 | < 5% | > 85% 持续 5 分钟 |
| 内存使用率 | ~45% (700MB/1.6GB) | > 90% 持续 3 分钟 |
| 可用内存 | > 700MB | < 150MB |
| swap 使用 | < 100MB | > 1GB |
| 磁盘使用率 | 30% (11GB/40GB) | > 80% |
| HTTP 响应时间 | < 300ms | > 3s |

---

## 十、参考文档

- 上游 superpowers AGENTS.md 贡献指南
- Strapi v5 部署文档
- Docker Compose 资源限制：https://docs.docker.com/compose/compose-file/deploy/
- Linux swappiness 文档：https://www.kernel.org/doc/Documentation/sysctl/vm.txt
- 阿里云云监控文档：https://help.aliyun.com/product/28572.html
