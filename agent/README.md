# Yousen Agent

客户服务器上的 Agent，通过 WebSocket 长连接到中央管理后台。

## 安装

### 1. 颁发 enrollment code

在中央管理后台：
1. 登录 → 进入客户详情页
2. 点"颁发新注册码"，获得 32 位 code（24h 有效）

### 2. 客户服务器注册

```bash
# 拉取 Agent 镜像
docker pull yousen-agent:0.1.0

# 注册（一次性）
docker run --rm \
  -v /etc/yousen-agent:/etc/yousen-agent \
  yousen-agent:0.1.0 register \
  --central https://central.yousen.example.com \
  --enrollment-code ABC123XYZ \
  --hostname customer-a-prod \
  --display-name "客户A生产服务器"
```

注册成功后会在 `/etc/yousen-agent/agent.env` 写入：
- `CENTRAL_API_URL`
- `CENTRAL_WS_URL`
- `SERVER_ID`
- `AGENT_TOKEN`

### 3. 启动 Agent 长连接

```bash
docker run -d --name yousen-agent \
  --restart unless-stopped \
  -v /etc/yousen-agent:/etc/yousen-agent:ro \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /data:/data \
  yousen-agent:0.1.0
```

参数说明：
- `--restart unless-stopped`：进程崩溃自动重启
- `/var/run/docker.sock`：让 Agent 能执行 docker compose 命令
- `/data`：客户业务代码目录（docker-compose.yml 所在位置）

### 4. 验证

回到中央管理后台 → 服务器列表，应看到对应服务器状态为 `online`。

## 故障排查

- **服务器一直显示 offline**：
  1. 检查 `docker logs yousen-agent` 是否有连接错误
  2. 确认客户服务器能访问 `central.yousen.example.com`（出站 443 端口）
  3. 检查 `/etc/yousen-agent/agent.env` 是否存在且内容正确
