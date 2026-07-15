# 多客户部署 —— 中央管理后台 + Agent 长连接架构设计

- **创建日期**：2026-07-15
- **作者**：项目维护者
- **状态**：设计已批准，待生成实现计划
- **关联**：子项目 6B —— 多客户部署
- **上游规格**：无（本规格为新建）

---

## 1. 背景与目标

### 1.1 背景

佑森小课堂网站系统已完成单机部署（[deploy.sh](../../../deploy.sh) + [docker-compose.yml](../../../docker-compose.yml) + [docker-compose.nginx.yml](../../../docker-compose.nginx.yml)），单客户场景可一键部署到云服务器。

业务进入多客户阶段：每个客户独立购买云服务器、独立部署一份完整系统。需要一套中央管理后台，让维护者从单点管理所有客户的配置、版本、部署与监控，避免 SSH 到每台服务器手动操作。

### 1.2 目标

- **管理后台部署在中央服务器**：维护者通过 Web UI 管理所有客户
- **客户服务器零入站端口开放**：客户服务器只需能出站访问中央
- **配置版本化**：每次配置变更可追溯、可回滚
- **部署可观测**：部署任务实时显示进度与日志
- **客户业务代码零改动**：现有 [backend](../../../backend/)/[frontend-next](../../../frontend-next/) 完全无感知

### 1.3 非目标

- 不做 SaaS 多租户（每个客户独立部署、独立数据库）
- 不做客户自助管理（管理后台仅维护者使用，客户不登录）
- 不做自动扩缩容（客户服务器规模小，单机足够）
- 不替换现有 `deploy.sh`（Agent 在其之上做编排，复刻其健康检查逻辑）

---

## 2. 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│  中央管理后台 (Control Plane)  ——  部署在维护者中央服务器         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Admin Web UI (Next.js)                                   │  │
│  │  - 客户列表 / 服务器列表 / 配置编辑器 / 部署任务面板        │  │
│  │  - 实时日志流 (Server-Sent Events)                        │  │
│  └────────────────┬─────────────────────────────────────────┘  │
│  ┌────────────────▼─────────────────────────────────────────┐  │
│  │  Control API (Next.js Route Handlers + WebSocket Server)  │  │
│  │  - REST: /api/admin/*   (管理后台 CRUD)                    │  │
│  │  - WS:   /api/agent/ws  (Agent 长连接入口)                 │  │
│  │  - SSE:  /api/admin/jobs/:id/stream (日志实时流)           │  │
│  └────────────────┬─────────────────────────────────────────┘  │
│  ┌────────────────▼─────────────────────────────────────────┐  │
│  │  PostgreSQL (control_db)                                  │  │
│  │  - customers / customer_servers / customer_configs        │  │
│  │  - admin_users / agent_tokens / deploy_jobs / job_logs    │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────▲────────────────────────────────────────────────────────┘
         │ wss:// (出站, 客户 → 中央)
         │ Agent 持有 token, 无入站端口
┌────────┴────────────────────────────────────────────────────────┐
│  客户服务器 (Customer Server A)                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  yousen-agent  (Node.js 容器, 长驻进程)                   │  │
│  │  - 维护 WebSocket 长连接 + 30s 心跳                       │  │
│  │  - 接收指令 → 执行 → 上报结果                             │  │
│  │  - 自动重连 (指数退避, 最大 60s)                          │  │
│  └────────┬─────────────────────────────────────────────────┘  │
│  ┌────────▼──────────────────────────────────────────────────┐  │
│  │  Docker Engine                                             │  │
│  │  - postgres + redis + meilisearch + backend + frontend    │  │
│  │  - nginx (现有 docker-compose.yml 不变)                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.1 关键设计决策

- **通信方向：客户 → 中央（出站）**：客户服务器通常位于 NAT/防火墙后，入站端口开放麻烦；出站连接对客户网络几乎零侵入
- **Agent 容器加入客户 docker network**：能直接 `exec docker compose ...`，无需额外权限配置
- **WebSocket 而非 gRPC**：协议简单、防火墙友好（443 端口）、Node.js 生态成熟
- **配置版本化**：每次 `customer_configs` 写入都是新版本，支持回滚到任意历史版本

---

## 3. 组件职责

| 组件 | 职责 | 技术栈 |
|---|---|---|
| **Admin Web UI** | 管理员登录、客户/服务器/配置 CRUD、部署任务下发、实时日志查看 | Next.js App Router + shadcn/ui |
| **Control API** | REST 处理管理操作；WS 接收 Agent 连接并下发指令；SSE 推日志给浏览器 | Next.js Route Handlers + `ws` 库（自定义 server） |
| **Control DB** | 存储客户元数据、配置版本、部署任务、Agent 令牌 | PostgreSQL（独立于客户业务库） |
| **Customer Agent** | 长连接维护、心跳、指令执行（部署/重启/写 .env/拉日志）、结果上报 | Node.js + `ws` 库，打包为 Docker 镜像 |
| **Agent CLI** | 首次注册工具：用一次性 enrollment code 换取长期 token | 同 Agent 代码库，子命令 `agent register` |

---

## 4. 通信协议

WebSocket 消息统一 JSON 格式，每条消息有 `type` + `id`（用于 request/response 配对）。

### 4.1 Agent → 中央

| type | 触发时机 | payload |
|---|---|---|
| `agent:register` | 连接建立后首条 | `{ customerId, serverId, agentVersion, hostname, dockerVersion }` |
| `agent:heartbeat` | 每 30 秒 | `{ cpu, mem, disk, services: [{name, status}] }` |
| `command:ack` | 收到中央指令 | `{ commandId, receivedAt }` |
| `command:progress` | 长任务执行中 | `{ commandId, stage, message }` |
| `command:result` | 指令执行完成 | `{ commandId, success, exitCode, stdout, stderr, durationMs }` |
| `log:line` | 部署日志实时流 | `{ jobId, stream, line, ts }` |

### 4.2 中央 → Agent

| type | 用途 | payload |
|---|---|---|
| `command:deploy` | 触发部署（部署新镜像 + 可选更新 .env） | `{ commandId, jobId, imageTag, envVars?: Record<string,string>, mode: 'nginx'\|'direct' }` |
| `command:config-sync` | 仅更新 .env（不部署新镜像） | `{ commandId, envVars: Record<string,string>, restart: boolean }` |
| `command:restart` | 重启指定服务 | `{ commandId, services: string[] }` |
| `command:status` | 查询当前状态 | `{ commandId }` |
| `command:logs` | 拉取服务日志 | `{ commandId, service, tail: number }` |
| `command:cancel` | 取消正在执行的任务 | `{ commandId }` |

---

## 5. 数据模型（中央 control_db）

```sql
-- 客户
CREATE TABLE customers (
  id            UUID PRIMARY KEY,
  name          TEXT NOT NULL,
  contact_name  TEXT,
  contact_phone TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 客户服务器（一个客户可有多台）
CREATE TABLE customer_servers (
  id             UUID PRIMARY KEY,
  customer_id    UUID REFERENCES customers(id),
  hostname       TEXT NOT NULL,           -- 内部标识
  display_name   TEXT,                    -- "百步亭校区服务器"
  agent_version  TEXT,
  last_heartbeat TIMESTAMPTZ,
  status         TEXT DEFAULT 'offline',  -- online|offline|deploying
  meta           JSONB DEFAULT '{}',      -- cpu/mem/disk 快照
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- 客户配置（版本化）
CREATE TABLE customer_configs (
  id            UUID PRIMARY KEY,
  customer_id   UUID REFERENCES customers(id),
  version       INT NOT NULL,
  brand         JSONB DEFAULT '{}',       -- logoUrl, brandName, primaryColor...
  ai            JSONB DEFAULT '{}',       -- dashscopeKey, model, systemPrompt...
  deployment    JSONB DEFAULT '{}',       -- mode, imageTag, nginxPort...
  env_overrides JSONB DEFAULT '{}',       -- 任意 .env 覆盖
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, version)
);

-- 管理员
CREATE TABLE admin_users (
  id            UUID PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT DEFAULT 'admin',     -- superadmin|admin|viewer
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Agent 令牌
CREATE TABLE agent_tokens (
  id           UUID PRIMARY KEY,
  server_id    UUID REFERENCES customer_servers(id),
  token_hash   TEXT NOT NULL,             -- SHA-256(token)
  issued_at    TIMESTAMPTZ DEFAULT now(),
  revoked_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);

-- 部署任务
CREATE TABLE deploy_jobs (
  id            UUID PRIMARY KEY,
  server_id     UUID REFERENCES customer_servers(id),
  config_id     UUID REFERENCES customer_configs(id),
  type          TEXT NOT NULL,            -- deploy|config-sync|restart
  status        TEXT DEFAULT 'queued',    -- queued|running|success|failed|cancelled
  triggered_by  UUID REFERENCES admin_users(id),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  exit_code     INT,
  error_message TEXT
);

CREATE TABLE job_logs (
  id          BIGSERIAL PRIMARY KEY,
  job_id      UUID REFERENCES deploy_jobs(id),
  ts          TIMESTAMPTZ DEFAULT now(),
  stream      TEXT,                       -- stdout|stderr
  line        TEXT
);
CREATE INDEX ON job_logs (job_id, ts);
```

### 5.1 索引策略

- `customer_servers(customer_id)`：按客户列出服务器
- `customer_configs(customer_id, version DESC)`：取最新配置
- `deploy_jobs(server_id, created_at DESC)`：按服务器列任务
- `agent_tokens(token_hash)`：登录验证高频查询

---

## 6. 核心接口签名

### 6.1 中央：WebSocket 服务（`central/api/agent/ws/route.ts`）

```typescript
// 不能用 Next.js Route Handler（它不支持长连接）
// 需要自定义 HTTP server，挂在 Next.js custom server 上

import { WebSocketServer } from 'ws';
import { verifyAgentToken, bindServer } from '@/lib/agent-auth';
import { handleAgentMessage } from '@/lib/agent-router';

export function attachAgentServer(server: http.Server) {
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    if (url.pathname !== '/api/agent/ws') return;       // 让 Next.js 处理其他路由
    const token = url.searchParams.get('token');
    if (!token) return socket.destroy();
    wss.handleUpgrade(req, socket, head, async (ws) => {
      const server = await verifyAgentToken(token);     // SHA-256 比对
      if (!server) return ws.close(4001, 'invalid token');
      ws.on('message', (raw) => handleAgentMessage(ws, server, JSON.parse(raw.toString())));
      ws.send(JSON.stringify({ type: 'agent:welcome', serverId: server.id }));
    });
  });
}
```

### 6.2 中央：指令路由器（`central/lib/agent-router.ts`）

```typescript
type AgentMessage =
  | { type: 'agent:register'; ... }
  | { type: 'agent:heartbeat'; ... }
  | { type: 'command:result'; commandId: string; success: boolean; ... }
  | { type: 'log:line'; jobId: string; ... };

export async function handleAgentMessage(ws: WebSocket, server: ServerRow, msg: AgentMessage) {
  switch (msg.type) {
    case 'agent:register':
      await db.customer_servers.update(server.id, { status: 'online', agent_version: msg.agentVersion });
      break;
    case 'agent:heartbeat':
      await db.customer_servers.update(server.id, {
        last_heartbeat: new Date(),
        meta: { cpu: msg.cpu, mem: msg.mem, disk: msg.disk },
      });
      break;
    case 'command:result':
      await db.deploy_jobs.updateResult(msg.commandId, msg);
      await broadcastJobUpdate(msg.commandId);   // 通过 SSE 推给管理后台浏览器
      break;
    case 'log:line':
      await db.job_logs.insert(msg);
      await broadcastLogLine(msg.jobId, msg);    // SSE
      break;
  }
}

export async function sendCommand(serverId: string, command: Command) {
  const ws = connections.get(serverId);
  if (!ws || ws.readyState !== OPEN) throw new Error('agent offline');
  ws.send(JSON.stringify(command));
  await db.deploy_jobs.insert({ id: command.commandId, server_id: serverId, type: command.type, status: 'queued' });
}
```

### 6.3 Agent：WebSocket 客户端（`agent/src/connection.ts`）

```typescript
import WebSocket from 'ws';
import { executeCommand } from './executor';

const CENTRAL_URL = process.env.CENTRAL_WS_URL!;   // wss://central.example.com/api/agent/ws
const TOKEN       = process.env.AGENT_TOKEN!;      // 长期 token
const SERVER_ID   = process.env.SERVER_ID!;

let ws: WebSocket;
let reconnectDelay = 1000;

export function start() {
  ws = new WebSocket(`${CENTRAL_URL}?token=${TOKEN}`);
  ws.on('open', () => {
    reconnectDelay = 1000;
    send({ type: 'agent:register', serverId: SERVER_ID, agentVersion: VERSION, hostname: os.hostname(), dockerVersion: dockerVersion() });
    startHeartbeat();
  });
  ws.on('message', async (raw) => {
    const cmd = JSON.parse(raw.toString());
    send({ type: 'command:ack', commandId: cmd.commandId, receivedAt: new Date().toISOString() });
    try {
      await executeCommand(cmd, {
        onProgress: (stage, message) => send({ type: 'command:progress', commandId: cmd.commandId, stage, message }),
        onLog: (stream, line) => send({ type: 'log:line', jobId: cmd.jobId, stream, line, ts: new Date().toISOString() }),
      });
      send({ type: 'command:result', commandId: cmd.commandId, success: true, durationMs: elapsed() });
    } catch (err) {
      send({ type: 'command:result', commandId: cmd.commandId, success: false, exitCode: err.code ?? 1, stderr: err.message, durationMs: elapsed() });
    }
  });
  ws.on('close', () => { stopHeartbeat(); scheduleReconnect(); });
  ws.on('error', () => ws.close());
}

function scheduleReconnect() {
  setTimeout(() => start(), reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, 60000);   // 指数退避，上限 60s
}
```

### 6.4 Agent：指令执行器（`agent/src/executor.ts`）

```typescript
import { execa } from 'execa';
import { writeFileSync } from 'node:fs';

export async function executeCommand(cmd: Command, hooks: Hooks) {
  switch (cmd.type) {
    case 'command:config-sync':
      const envContent = Object.entries(cmd.envVars).map(([k,v]) => `${k}=${v}`).join('\n');
      writeFileSync('/data/.env', envContent);
      hooks.onProgress('config-written', '.env updated');
      if (cmd.restart) await runCompose(['restart', 'backend', 'frontend'], hooks);
      return;

    case 'command:deploy':
      // 当前实现：git pull + 本地 build（沿用现有 docker-compose.yml 的 build context 模式）
      // imageTag 字段保留为未来切换到镜像仓库 pull 模式时使用，本期忽略
      if (cmd.envVars) {
        const envContent = Object.entries(cmd.envVars).map(([k,v]) => `${k}=${v}`).join('\n');
        writeFileSync('/data/.env', envContent);
        hooks.onProgress('config-written', '.env updated');
      }
      hooks.onProgress('git-pull', 'pulling latest code');
      await execa('git', ['pull'], { cwd: '/data' });
      hooks.onProgress('build', 'building images');
      const upArgs = cmd.mode === 'nginx'
        ? ['-f', 'docker-compose.yml', '-f', 'docker-compose.nginx.yml', 'up', '-d', '--build']
        : ['up', '-d', '--build'];
      await runCompose(upArgs, hooks);
      hooks.onProgress('healthcheck', 'waiting for healthchecks');
      await waitForHealthy(hooks);
      return;

    case 'command:restart':
      await runCompose(['restart', ...cmd.services], hooks);
      return;

    case 'command:logs':
      const { stdout } = await runCompose(['logs', '--tail', String(cmd.tail), cmd.service], hooks);
      stdout.split('\n').forEach(line => hooks.onLog('stdout', line));
      return;

    case 'command:status':
      const { stdout: ps } = await runCompose(['ps', '--format', 'json'], hooks);
      return ps;

    case 'command:cancel':
      cancelRunningTask();   // 通过 AbortController 取消正在执行的子进程
      return;
  }
}

async function runCompose(args: string[], hooks: Hooks) {
  const subprocess = execa('docker', ['compose', ...args], { cwd: '/data' });
  subprocess.stdout!.on('data', chunk => chunk.toString().split('\n').forEach(line => hooks.onLog('stdout', line)));
  subprocess.stderr!.on('data', chunk => chunk.toString().split('\n').forEach(line => hooks.onLog('stderr', line)));
  return await subprocess;
}
```

### 6.5 Agent 首次注册流程

```bash
# 客户服务器上执行一次：
docker run --rm yousen-agent:latest register \
  --central https://central.example.com \
  --enrollment-code ABC123XYZ \
  --hostname "customer-a-prod" \
  --display-name "客户A生产服务器"

# Agent 调用 POST /api/agent/enroll
# 请求体: { enrollmentCode, hostname, displayName }
# 中央校验 enrollment code（一次性、24h 有效）→ 创建 customer_server → 生成 token → 返回
# 响应体: { serverId, agentToken }
# Agent 把 token 写入 /etc/yousen-agent/agent.env
# 后续 systemd / docker compose 启动 agent 时读取这个 env
```

---

## 7. 项目结构

```
superpowers-zh/
├── backend/                 # 客户业务后端 (Strapi, 不变)
├── frontend-next/           # 客户业务前端 (Next.js, 不变)
├── central/                 # ★ 新增：中央管理后台
│   ├── app/
│   │   ├── (auth)/login/    # 管理员登录
│   │   ├── (dashboard)/
│   │   │   ├── customers/   # 客户列表 + 详情
│   │   │   ├── servers/     # 服务器列表 + 实时状态
│   │   │   ├── configs/     # 配置编辑器
│   │   │   └── jobs/        # 部署任务面板 + 日志流
│   │   └── api/
│   │       ├── admin/       # REST: customers/servers/configs/jobs
│   │       ├── agent/
│   │       │   ├── enroll/route.ts   # POST 一次性注册码换 token
│   │       │   └── ws                # WebSocket (custom server)
│   │       └── jobs/[id]/stream/route.ts  # SSE 日志流
│   ├── lib/
│   │   ├── db.ts            # postgres 客户端
│   │   ├── agent-auth.ts    # token 验证
│   │   ├── agent-router.ts  # 消息分发
│   │   └── connections.ts   # serverId → ws 映射
│   ├── db/
│   │   ├── schema.sql
│   │   └── seed.ts          # 初始超级管理员
│   ├── server.ts            # Next.js custom server (挂 WebSocket)
│   ├── Dockerfile
│   └── docker-compose.yml   # central + postgres
├── agent/                   # ★ 新增：客户服务器 Agent
│   ├── src/
│   │   ├── connection.ts    # WebSocket 客户端 + 重连
│   │   ├── executor.ts      # 指令执行器
│   │   ├── reporter.ts      # 心跳/状态上报
│   │   ├── register.ts      # 首次注册子命令
│   │   └── index.ts
│   ├── Dockerfile
│   ├── package.json
│   └── README.md            # 客户服务器安装步骤
├── docker-compose.yml       # 客户业务部署 (不变)
└── deploy.sh                # 客户部署脚本 (不变)
```

---

## 8. 与现有代码的集成点

| 现有资源 | 集成方式 | 改动量 |
|---|---|---|
| [deploy.sh](../../../deploy.sh) | 不动。Agent 的 `command:deploy` 直接调 `docker compose`，复刻 deploy.sh 内的健康检查顺序逻辑 | 0 |
| [docker-compose.yml](../../../docker-compose.yml) / [docker-compose.nginx.yml](../../../docker-compose.nginx.yml) | 不动。Agent 通过 `--env-file /data/.env` 加载由中央同步的配置 | 0 |
| `.env.example` | 作为 `customer_configs.env_overrides` 的 schema 参考 | 0 |
| 客户业务 Strapi / Next.js | 完全无感知，仍从 `.env` 读配置 | 0 |
| 现有 CI（`.github/workflows/deploy-site.yml`） | 保留用于构建 `yousen-agent` 镜像；客户业务镜像仍由客户服务器本地 build（`docker compose up --build`） | 0 |

**结论：客户业务代码零改动。** 新增的 `central/` 和 `agent/` 是两个独立子项目。

### 8.1 客户服务器上代码与配置的来源

| 资源 | 来源 | 更新方式 |
|---|---|---|
| `docker-compose.yml` / `docker-compose.nginx.yml` / `nginx/nginx.conf` | 首次部署时 `git clone` 仓库到 `/data` | `command:deploy` 触发 `git pull` 拉取最新 |
| `backend/` / `frontend-next/` 源代码 | 同上（git clone） | 同上（git pull） |
| `.env` | 中央管理后台通过 `command:config-sync` 写入 | 任何配置变更由中央推送 |
| `yousen-agent` 容器 | Docker 镜像（发布到镜像仓库） | Agent 自更新（未来）；本期手动 `docker pull` |

**首次部署流程（客户服务器初始化）**：
1. 客户服务器安装 Docker + docker compose
2. `git clone <repo> /data`（或解压中央下发的 init tarball）
3. `docker run --rm yousen-agent:latest register --central ... --enrollment-code ...`
4. Agent 注册成功后，登录中央管理后台下发首次 `command:config-sync`（写入 .env）
5. 中央下发首次 `command:deploy`（执行 docker compose up）
6. 客户业务上线

---

## 9. 安全考虑

1. **Agent Token**：SHA-256 哈希存储，明文只在客户服务器；通过 `enrollment code`（一次性、24h、UUIDv4）换取，避免明文传输长期密钥
2. **WebSocket 传输**：强制 `wss://`（生产环境）；token 通过 `?token=` query param 传递，握手时由中央验证并标记 server online
3. **管理员认证**：Next.js 中间件 + JWT cookie（httpOnly + secure + sameSite=lax）；密码用 bcrypt（cost=12）
4. **管理操作审计**：所有 `triggered_by` 字段记录到 `deploy_jobs`；后续可扩展独立审计表
5. **指令幂等性**：每条指令带 `commandId`（UUIDv4），Agent 通过内存 Map 去重 5 分钟，防止 Agent 重连后中央重新下发同一指令导致重复执行
6. **敏感字段加密**：`customer_configs.ai.dashscopeKey` 等密钥字段用 AES-256-GCM 加密存储（密钥从中央 `.env` 读取，不进数据库）
7. **Enrollment Code 防爆破**：单 IP 5 分钟内最多尝试 3 次，连续 3 次失败则该 IP 锁定 1 小时；enrollment code 本身失败 5 次作废
8. **命令注入防护**：`hostname` / `display_name` 等用户输入字段在写入 SQL 前用参数化查询，在传给 `execa` 前禁止 shell 解析（`execa` 默认不经过 shell）

---

## 10. 高可用性设计（Agent 长连接）

### 10.1 推荐库

| 用途 | 库 | 选型理由 |
|---|---|---|
| WebSocket 客户端 | [`ws`](https://www.npmjs.com/package/ws) | Node.js 生态最成熟、性能最好、API 稳定。无需更高层封装 |
| 重连调度 | 自实现（约 30 行） | 需求简单：指数退避 + 上限；引入 `reconnect-core` 等反而增加依赖 |
| 子进程管理 | [`execa`](https://www.npmjs.com/package/execa) | 比 `child_process` 更安全（默认禁用 shell）、更好的 Promise 接口、支持 AbortSignal 取消 |
| 心跳计时器 | `setInterval` + 单测覆盖 | 不需要 `node-cron` 等重型库 |

### 10.2 最佳实践

- **指数退避 + 抖动**：`delay = min(delay * 2, 60000) + random(0, 1000)`，避免大量 Agent 同时重连雪崩
- **Ping/Pong 双向心跳**：依赖 `ws` 内置 `ping` 帧（30s 一次），中央若 60s 未收到 pong 主动断开；应用层 `agent:heartbeat` 仅做状态上报
- **优雅关闭**：捕获 `SIGTERM`/`SIGINT`，先 `ws.close(1001)` 再 `process.exit(0)`，避免中央误判 server offline
- **离线指令排队**：中央若发现 Agent 离线，将 `command:deploy` 标记为 `queued`，Agent 重连后中央立即 flush 队列
- **指令幂等**：`commandId` 在 Agent 内存 Map 保留 5 分钟去重，防止网络重传导致重复执行
- **子进程可取消**：`execa` 支持 `signal: AbortController.signal`，收到 `command:cancel` 后立即终止正在执行的 `docker compose up`

### 10.3 故障场景

| 故障 | 检测 | 处理 |
|---|---|---|
| 中央宕机 | Agent ws `close` 事件 | 指数退避重连；客户业务不受影响 |
| Agent 进程崩溃 | Docker `restart: unless-stopped` | 容器自动重启，重新建立连接 |
| 网络抖动（短暂丢包） | ws `ping` 超时 | 触发 close → 重连 |
| 中央下发指令时 Agent 离线 | `connections.get(serverId)` 返回 undefined | 标记 `queued`，Agent 重连后下发 |
| Agent 执行指令时崩溃 | `command:result` 超时（默认 5 分钟） | 中央标记 `failed`，等 Agent 重连后下发 `command:status` 探测真实状态 |

---

## 11. 测试策略

| 层 | 工具 | 覆盖目标 |
|---|---|---|
| Agent executor 单元 | Vitest + mock `execa` | 每种指令类型的正确 docker compose 调用参数 + 错误处理 |
| 中央 agent-router 单元 | Vitest + mock db | 各类消息正确写入 db + 正确广播 |
| WebSocket 集成 | Vitest + 内嵌 ws client | 端到端：注册 → 心跳 → 下发指令 → 收到结果 |
| Agent 重连 | Vitest + fake clock (`@sinonjs/fake-timers`) | 指数退避算法、60s 上限、重连后状态恢复 |
| E2E（中央 UI） | Playwright | 登录 → 创建客户 → 颁发 enrollment code → 模拟 Agent 注册 → 下发部署 → 看到日志流 |
| 安全 | 手工 + 自动化 | token 失效、enrollment code 重放、命令注入（hostname 字段） |

---

## 12. 实现里程碑

| 里程碑 | 内容 | 依赖 |
|---|---|---|
| **M1** | 中央 DB schema + 管理员登录 + 客户/服务器/配置 CRUD（REST + UI） | 无 |
| **M2** | Agent 注册（enrollment）+ WebSocket 长连接 + 心跳 | M1 |
| **M3** | Agent 指令执行器 + 中央下发 `config-sync` / `restart` / `status` / `logs` | M2 |
| **M4** | `command:deploy` + 实时日志流（SSE 到浏览器）+ 任务面板 | M3 |
| **M5** | 安全加固（敏感字段加密、审计、防爆破）+ E2E 测试 | M4 |

详细任务拆分由 `writing-plans` 技能生成。

---

## 13. 风险与缓解

| 风险 | 缓解措施 |
|---|---|
| WebSocket 长连接被中间代理超时断开（如 nginx `proxy_read_timeout` 默认 60s） | 中央 nginx 配置 `proxy_read_timeout 3600s`；Agent 30s 心跳保持活跃 |
| 单台中央服务器宕机导致全客户失管 | 本期不做中央高可用；后续可加中央主备 + 数据库流复制 |
| Agent token 泄露 | 支持在管理后台一键 revoke；token 哈希存储，泄露后无法直接使用 |
| 客户服务器 docker daemon 故障 | Agent 心跳上报会失败 → 中央标记 offline；管理员收到告警 |
| 部署中途中断导致客户业务受损 | 沿用 deploy.sh 的健康检查顺序：先起 postgres → backend healthy → frontend；中断时旧容器仍在运行 |

---

## 14. 未来扩展（非本期范围）

- 中央主备高可用
- 客户服务器指标监控（Prometheus + Grafana）
- 部署灰度发布（按客户分批）
- 客户自助管理子账号
- 配置 diff 可视化对比
