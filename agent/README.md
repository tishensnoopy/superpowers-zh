# Yousen Agent 安装指南

Agent 是部署在客户服务器上的 Node.js 容器，通过 WebSocket 长连接到中央管理后台，接收部署/配置/重启指令。

## 前置要求

- 客户服务器已安装 Docker 24+ 和 Docker Compose v2
- 客户服务器能出站访问中央服务器（443 或 3000 端口）
- 客户服务器无需开放任何入站端口
- 客户业务代码已 `git clone` 到 `/data` 目录（`docker-compose.yml` 在 `/data/docker-compose.yml`）

## 1. 获取 enrollment code

联系维护者，从中央管理后台为你所属客户颁发一次性 enrollment code（24 小时有效）。

## 2. 首次注册

在客户服务器上执行：

```bash
# 拉取 Agent 镜像
docker pull registry.cn-hangzhou.aliyuncs.com/yousen/agent:latest

# 注册（用 enrollment code 换取长期 token）
docker run --rm \
  -v /data/agent.env:/app/agent.env \
  -e CENTRAL_API_URL=https://central.yousen.example.com \
  registry.cn-hangzhou.aliyuncs.com/yousen/agent:latest \
  register --enrollment-code <你的code>

# 注册成功后 /data/agent.env 会包含 AGENT_TOKEN 和 SERVER_ID
cat /data/agent.env
```

## 3. 启动 Agent 长连接

创建 `/data/agent-compose.yml`：

```yaml
services:
  agent:
    image: registry.cn-hangzhou.aliyuncs.com/yousen/agent:latest
    container_name: yousen-agent
    restart: unless-stopped
    env_file: /data/agent.env
    environment:
      CENTRAL_WS_URL: wss://central.yousen.example.com/api/agent/ws
      DATA_DIR: /data
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock  # 允许 Agent 调 docker compose
      - /data:/data:rw
    network_mode: host  # 简化 docker socket 访问
```

启动：
```bash
cd /data && docker compose -f agent-compose.yml up -d
docker compose -f agent-compose.yml logs -f agent
```

看到 `agent:register` 成功和 `agent:welcome` 即表示已连上中央。

## 4. 验证

- 中央管理后台的服务器列表页应显示此服务器为 `online`
- 中央点"查看状态" → Agent 执行 `docker compose ps` 并回传
- 中央点"部署" → Agent 执行 `git pull` + `docker compose up --build` + 健康检查

## 5. 故障排查

### Agent 连不上中央

- 检查 `CENTRAL_WS_URL` 是否正确（应为 `wss://` 开头）
- 检查客户服务器出站防火墙是否允许 443
- 查看 Agent 日志：`docker compose -f agent-compose.yml logs agent`
- 重连采用指数退避，最长 60 秒一次

### Agent 注册失败

- enrollment code 只能用一次，已使用需重新颁发
- 24 小时后过期，需重新颁发
- hostname 字段只允许字母数字、下划线、短横线

### 中央显示 offline

- 检查 Agent 容器是否在运行：`docker compose -f agent-compose.yml ps`
- 检查 Agent 日志是否有 ws 重连错误
- 中央 heartbeat-monitor 60 秒无心跳会标记 offline

### token 被吊销

- 维护者在中央管理后台点了"吊销 Token"
- Agent 重连时会被拒绝（ws close code 4001）
- 需要重新颁发 enrollment code 并执行 register

## 6. 升级 Agent

```bash
cd /data
docker compose -f agent-compose.yml pull
docker compose -f agent-compose.yml up -d
```

Agent 镜像升级后自动重连，无需重新注册（token 不变）。

## 7. 安全注意事项

- `agent.env` 文件包含长期 token，权限设为 `chmod 600 /data/agent.env`
- `docker.sock` 挂载给 Agent 容器意味着它能管理客户服务器上的所有容器；不要在同一 docker daemon 上跑其他敏感业务
- Agent 容器与客户业务容器在同一 docker network，能直接 `docker compose exec` 进 backend 等容器
