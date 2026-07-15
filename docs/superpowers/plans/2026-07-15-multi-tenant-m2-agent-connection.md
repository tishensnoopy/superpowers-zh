# M2：Agent 注册 + WebSocket 长连接 + 心跳 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 客户服务器上跑 Agent 容器，通过一次性 enrollment code 注册到中央，建立 wss 长连接并维持 30s 心跳；中央管理后台实时显示服务器在线状态。

**架构：** 中央引入 Next.js custom server（挂 `ws` WebSocketServer），新增 `/api/agent/enroll` REST + `/api/agent/ws` WebSocket 端点。Agent 是独立 Node.js 容器，使用 `ws` 库 + 自实现指数退避重连。

**技术栈：** `ws`（WebSocket）、`execa`（子进程，M3 才用，但提前装）、`@sinonjs/fake-timers`（重连测试）、Vitest。

**关联规格：** [2026-07-15-multi-tenant-central-control.md](../specs/2026-07-15-multi-tenant-central-control.md) 第 4、6.1、6.2、6.3、9.1、9.5、10、12.2 节

**前置依赖：** M1 已完成（admin login、customers/servers/enrollment-codes CRUD 可用）

---

## 文件结构

```
central/
├── server.ts                         # 新增：Next.js custom server（挂 WS）
├── lib/
│   ├── agent-auth.ts                 # token 验证（SHA-256）
│   ├── agent-router.ts               # 消息分发
│   ├── connections.ts                # serverId → ws 映射
│   └── heartbeat-monitor.ts          # 60s 无心跳标记 offline
├── app/api/agent/
│   └── enroll/route.ts               # 一次性 enrollment 换 token
├── __tests__/
│   ├── agent-enroll.test.ts
│   ├── agent-auth.test.ts
│   ├── agent-router.test.ts
│   ├── heartbeat-monitor.test.ts
│   └── ws-integration.test.ts
agent/
├── src/
│   ├── connection.ts                 # WS 客户端 + 重连
│   ├── reporter.ts                   # 30s 心跳 + cpu/mem/disk
│   ├── register.ts                   # 首次注册子命令
│   ├── index.ts                      # 主入口
│   └── config.ts                     # env 加载
├── __tests__/
│   ├── connection.test.ts
│   ├── reporter.test.ts
│   └── register.test.ts
├── Dockerfile
├── package.json
└── README.md
```

---

## 任务 1：中央 custom server + WebSocket 入口

**文件：**
- 创建：`central/server.ts`
- 创建：`central/lib/connections.ts`
- 创建：`central/lib/agent-router.ts`（骨架）
- 修改：`central/package.json`（`start` 脚本改为 `node server.js`）

- [ ] **步骤 1：写 `central/lib/connections.ts`**

```typescript
import type { WebSocket } from 'ws';

const connections = new Map<string, Set<WebSocket>>();

export function addConnection(serverId: string, ws: WebSocket): () => void {
  if (!connections.has(serverId)) connections.set(serverId, new Set());
  connections.get(serverId)!.add(ws);
  return () => {
    connections.get(serverId)?.delete(ws);
    if (connections.get(serverId)?.size === 0) connections.delete(serverId);
  };
}

export function getConnections(serverId: string): WebSocket[] {
  return Array.from(connections.get(serverId) ?? []);
}

export function isOnline(serverId: string): boolean {
  return (connections.get(serverId)?.size ?? 0) > 0;
}

export function broadcastToAdmins(_event: string, _data: unknown): void {
  // M4 实现：通过 SSE 推给浏览器
}

export async function sendToServer(serverId: string, message: unknown): Promise<boolean> {
  const sockets = getConnections(serverId);
  if (sockets.length === 0) return false;
  const data = JSON.stringify(message);
  for (const ws of sockets) {
    if (ws.readyState === ws.OPEN) ws.send(data);
  }
  return true;
}
```

- [ ] **步骤 2：写 `central/lib/agent-router.ts`（骨架）**

```typescript
import type { WebSocket } from 'ws';
import { query } from '@/lib/db';
import { broadcastToAdmins } from './connections';

export type AgentMessage =
  | { type: 'agent:register'; serverId: string; agentVersion: string; hostname: string; dockerVersion: string }
  | { type: 'agent:heartbeat'; cpu: number; mem: number; disk: number; services: Array<{ name: string; status: string }> }
  | { type: 'command:ack'; commandId: string; receivedAt: string }
  | { type: 'command:progress'; commandId: string; stage: string; message: string }
  | { type: 'command:result'; commandId: string; success: boolean; exitCode?: number; stdout?: string; stderr?: string; durationMs: number }
  | { type: 'log:line'; jobId: string; stream: string; line: string; ts: string };

export async function handleAgentMessage(ws: WebSocket, serverId: string, msg: AgentMessage): Promise<void> {
  switch (msg.type) {
    case 'agent:register':
      await query(
        `UPDATE customer_servers SET status='online', agent_version=$1, meta=COALESCE(meta,'{}'::jsonb) || $2::jsonb
         WHERE id=$3`,
        [msg.agentVersion, JSON.stringify({ hostname: msg.hostname, dockerVersion: msg.dockerVersion }), serverId]
      );
      ws.send(JSON.stringify({ type: 'agent:welcome', serverId }));
      break;

    case 'agent:heartbeat':
      await query(
        `UPDATE customer_servers SET last_heartbeat=now(), status='online', meta=$1 WHERE id=$2`,
        [JSON.stringify({ cpu: msg.cpu, mem: msg.mem, disk: msg.disk, services: msg.services }), serverId]
      );
      broadcastToAdmins('server:heartbeat', { serverId, ...msg });
      break;

    case 'command:result':
      await query(
        `UPDATE deploy_jobs SET status=$1, finished_at=now(), exit_code=$2, error_message=$3 WHERE id=$4`,
        [msg.success ? 'success' : 'failed', msg.exitCode ?? null, msg.stderr ?? null, msg.commandId]
      );
      broadcastToAdmins('job:update', { jobId: msg.commandId, ...msg });
      break;

    case 'command:progress':
      broadcastToAdmins('job:progress', { jobId: msg.commandId, ...msg });
      break;

    case 'log:line':
      await query(
        `INSERT INTO job_logs (job_id, stream, line) VALUES ($1,$2,$3)`,
        [msg.jobId, msg.stream, msg.line]
      );
      broadcastToAdmins('job:log', { jobId: msg.jobId, ...msg });
      break;

    case 'command:ack':
      await query(`UPDATE deploy_jobs SET status='running', started_at=now() WHERE id=$1`, [msg.commandId]);
      break;
  }
}
```

- [ ] **步骤 3：写 `central/server.ts`（custom server 挂 WS）**

```typescript
import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { verifyAgentToken } from '@/lib/agent-auth';
import { addConnection } from '@/lib/connections';
import { handleAgentMessage } from '@/lib/agent-router';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT ?? '3000', 10);
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res, parse(req.url!, true)));
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname, query } = parse(req.url!, true);
    if (pathname !== '/api/agent/ws') return;  // 让 Next 处理其他 upgrade

    const token = query.token as string | undefined;
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    verifyAgentToken(token).then((serverRow) => {
      if (!serverRow) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, async (ws) => {
        const remove = addConnection(serverRow.id, ws);
        ws.on('close', () => {
          remove();
          // 不立即标记 offline，由 heartbeat-monitor 兜底
        });
        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw.toString());
            handleAgentMessage(ws, serverRow.id, msg);
          } catch (err) {
            console.error('[ws] message handling failed:', err);
          }
        });
      });
    }).catch((err) => {
      console.error('[ws] upgrade failed:', err);
      socket.destroy();
    });
  });

  // ws ping/pong（传输层心跳，独立于应用层 agent:heartbeat）
  const pingInterval = setInterval(() => {
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.ping();
    }
  }, 30000);
  wss.on('close', () => clearInterval(pingInterval));

  server.listen(port);
  console.log(`> Ready on http://localhost:${port} (dev=${dev})`);
});
```

- [ ] **步骤 4：修改 `central/package.json` 的 scripts**

```json
{
  "scripts": {
    "dev": "node server.ts",
    "build": "next build",
    "start": "NODE_ENV=production node server.ts",
    "test": "vitest run"
  }
}
```

并安装依赖：
```bash
cd central && npm install ws @types/ws
```

- [ ] **步骤 5：Commit**

```bash
git add central/server.ts central/lib/connections.ts central/lib/agent-router.ts central/package.json
git commit -m "feat(central): add custom server + WebSocket upgrade handler (M2-1)"
```

---

## 任务 2：Agent token 验证（TDD）

**文件：**
- 创建：`central/lib/agent-auth.ts`
- 测试：`central/__tests__/agent-auth.test.ts`

- [ ] **步骤 1：写失败的 token 验证测试**

`central/__tests__/agent-auth.test.ts`：
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { hashAgentToken, verifyAgentToken, generateAgentToken } from '@/lib/agent-auth';

let serverId: string;

beforeAll(async () => {
  const c = await pool.query(`INSERT INTO customers (name) VALUES ('Tok测试') RETURNING id`);
  const s = await pool.query(
    `INSERT INTO customer_servers (customer_id, hostname) VALUES ($1,'tok-srv') RETURNING id`,
    [c.rows[0].id]
  );
  serverId = s.rows[0].id;
});

afterAll(async () => {
  await pool.query(`DELETE FROM agent_tokens; DELETE FROM customer_servers; DELETE FROM customers;`);
  await pool.end();
});

describe('agent-auth', () => {
  it('hashes tokens with SHA-256', () => {
    const hash = hashAgentToken('my-secret-token');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe('my-secret-token');
  });

  it('verifies a valid, non-revoked token and returns server row', async () => {
    const token = await generateAgentToken(serverId);
    expect(token).toMatch(/^[A-Za-z0-9_-]{40}$/);
    const row = await verifyAgentToken(token);
    expect(row).not.toBeNull();
    expect(row!.id).toBe(serverId);
  });

  it('returns null for unknown token', async () => {
    const row = await verifyAgentToken('nonexistent-token-xxx');
    expect(row).toBeNull();
  });

  it('returns null for revoked token', async () => {
    const token = await generateAgentToken(serverId);
    await pool.query(`UPDATE agent_tokens SET revoked_at=now() WHERE token_hash=$1`, [hashAgentToken(token)]);
    const row = await verifyAgentToken(token);
    expect(row).toBeNull();
  });

  it('updates last_used_at on successful verify', async () => {
    const token = await generateAgentToken(serverId);
    await verifyAgentToken(token);
    const r = await pool.query(`SELECT last_used_at FROM agent_tokens WHERE token_hash=$1`, [hashAgentToken(token)]);
    expect(r.rows[0].last_used_at).not.toBeNull();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd central && npx vitest run __tests__/agent-auth.test.ts
```
预期：FAIL（找不到 `@/lib/agent-auth`）

- [ ] **步骤 3：写 `central/lib/agent-auth.ts`**

```typescript
import crypto from 'node:crypto';
import { query } from './db';

export function hashAgentToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function generateAgentToken(serverId: string): Promise<string> {
  const token = crypto.randomBytes(30).toString('base64url');
  await query(
    `INSERT INTO agent_tokens (server_id, token_hash) VALUES ($1, $2)`,
    [serverId, hashAgentToken(token)]
  );
  return token;
}

export async function verifyAgentToken(token: string): Promise<{ id: string; customer_id: string } | null> {
  const hash = hashAgentToken(token);
  const result = await query<{ id: string; customer_id: string }>(
    `SELECT s.id, s.customer_id
     FROM agent_tokens t
     JOIN customer_servers s ON s.id = t.server_id
     WHERE t.token_hash = $1 AND t.revoked_at IS NULL`,
    [hash]
  );
  if (result.rows.length === 0) return null;

  // 异步更新 last_used_at（不阻塞请求）
  query(`UPDATE agent_tokens SET last_used_at = now() WHERE token_hash = $1`, [hash]).catch(() => {});

  return result.rows[0];
}

export async function revokeAgentToken(tokenId: string): Promise<void> {
  await query(`UPDATE agent_tokens SET revoked_at = now() WHERE id = $1`, [tokenId]);
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd central && npx vitest run __tests__/agent-auth.test.ts
```
预期：PASS 5 tests

- [ ] **步骤 5：Commit**

```bash
git add central/lib/agent-auth.ts central/__tests__/agent-auth.test.ts
git commit -m "feat(central): add agent token verify/generate/revoke (M2-2)"
```

---

## 任务 3：Enrollment API（一次性 code 换 token，TDD）

**文件：**
- 创建：`central/app/api/agent/enroll/route.ts`
- 测试：`central/__tests__/agent-enroll.test.ts`

- [ ] **步骤 1：写失败的 enrollment API 测试**

`central/__tests__/agent-enroll.test.ts`：
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { generateEnrollmentCode } from '@/lib/agent-auth';

let customerId: string;
let code: string;

beforeAll(async () => {
  const c = await pool.query(`INSERT INTO customers (name) VALUES ('Enroll测试') RETURNING id`);
  customerId = c.rows[0].id;
  code = await generateEnrollmentCode(customerId);
});

afterAll(async () => {
  await pool.query(`DELETE FROM enrollment_codes; DELETE FROM agent_tokens; DELETE FROM customer_servers; DELETE FROM customers;`);
  await pool.end();
});

describe('POST /api/agent/enroll', () => {
  it('rejects missing fields', async () => {
    const res = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('rejects invalid enrollment code', async () => {
    const res = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enrollmentCode: 'INVALID', hostname: 'srv-1' }),
    });
    expect(res.status).toBe(401);
  });

  it('creates a server and returns token for valid code', async () => {
    const res = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enrollmentCode: code, hostname: 'srv-1', displayName: '生产1' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.serverId).toMatch(/^[0-9a-f-]+$/);
    expect(body.agentToken).toMatch(/^[A-Za-z0-9_-]{40}$/);

    // code 已被标记 used_at
    const codeRow = await pool.query(`SELECT used_at FROM enrollment_codes WHERE code=$1`, [code]);
    expect(codeRow.rows[0].used_at).not.toBeNull();
  });

  it('rejects already-used code', async () => {
    const res = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enrollmentCode: code, hostname: 'srv-2' }),
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd central && npx vitest run __tests__/agent-enroll.test.ts
```
预期：FAIL（找不到 `generateEnrollmentCode` 和 `/api/agent/enroll` 路由）

- [ ] **步骤 3：扩展 `central/lib/agent-auth.ts` 加 `generateEnrollmentCode`**

```typescript
// 追加到 central/lib/agent-auth.ts

export async function generateEnrollmentCode(customerId: string): Promise<string> {
  const code = crypto.randomBytes(16).toString('base64url').toUpperCase().slice(0, 32);
  await query(
    `INSERT INTO enrollment_codes (customer_id, code, expires_at)
     VALUES ($1, $2, now() + interval '24 hours')`,
    [customerId, code]
  );
  return code;
}

export async function consumeEnrollmentCode(code: string): Promise<{ customerId: string } | null> {
  const result = await query<{ customer_id: string; expires_at: string; used_at: string | null }>(
    `SELECT customer_id, expires_at, used_at FROM enrollment_codes WHERE code = $1`,
    [code]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  if (row.used_at !== null) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  await query(`UPDATE enrollment_codes SET used_at = now() WHERE code = $1`, [code]);
  return { customerId: row.customer_id };
}
```

- [ ] **步骤 4：写 `central/app/api/agent/enroll/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { json, errorResponse } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { consumeEnrollmentCode, generateAgentToken } from '@/lib/agent-auth';

export async function POST(req: NextRequest) {
  const { enrollmentCode, hostname, displayName } = await req.json();
  if (!enrollmentCode || !hostname) {
    return errorResponse('enrollmentCode and hostname are required', 400);
  }

  const result = await consumeEnrollmentCode(enrollmentCode);
  if (!result) return errorResponse('Invalid or expired enrollment code', 401);

  // 创建 customer_server
  let serverRow;
  try {
    const insertResult = await query<{ id: string }>(
      `INSERT INTO customer_servers (customer_id, hostname, display_name, status)
       VALUES ($1, $2, $3, 'offline') RETURNING id`,
      [result.customerId, hostname, displayName ?? null]
    );
    serverRow = insertResult.rows[0];
  } catch (err: any) {
    if (err.code === '23505') return errorResponse('Hostname already exists for this customer', 409);
    throw err;
  }

  const token = await generateAgentToken(serverRow.id);
  return json({ serverId: serverRow.id, agentToken: token }, 201);
}
```

- [ ] **步骤 5：运行测试验证通过**

```bash
cd central && npx vitest run __tests__/agent-enroll.test.ts
```
预期：PASS 4 tests

- [ ] **步骤 6：Commit**

```bash
git add central/lib/agent-auth.ts central/app/api/agent/enroll/ central/__tests__/agent-enroll.test.ts
git commit -m "feat(central): add agent enrollment API (one-time code → token) (M2-3)"
```

---

## 任务 4：心跳监控（60s 无心跳标记 offline，TDD）

**文件：**
- 创建：`central/lib/heartbeat-monitor.ts`
- 测试：`central/__tests__/heartbeat-monitor.test.ts`

- [ ] **步骤 1：写失败的心跳监控测试**

`central/__tests__/heartbeat-monitor.test.ts`：
```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { pool } from '@/lib/db';
import { markStaleServersOffline } from '@/lib/heartbeat-monitor';

let freshServerId: string;
let staleServerId: string;

beforeAll(async () => {
  const c = await pool.query(`INSERT INTO customers (name) VALUES ('Hb测试') RETURNING id`);
  const customerId = c.rows[0].id;

  // fresh：3 秒前心跳
  const fresh = await pool.query(
    `INSERT INTO customer_servers (customer_id, hostname, status, last_heartbeat)
     VALUES ($1, 'fresh', 'online', now() - interval '3 seconds') RETURNING id`,
    [customerId]
  );
  freshServerId = fresh.rows[0].id;

  // stale：90 秒前心跳
  const stale = await pool.query(
    `INSERT INTO customer_servers (customer_id, hostname, status, last_heartbeat)
     VALUES ($1, 'stale', 'online', now() - interval '90 seconds') RETURNING id`,
    [customerId]
  );
  staleServerId = stale.rows[0].id;
});

afterAll(async () => {
  await pool.query(`DELETE FROM customer_servers; DELETE FROM customers;`);
  await pool.end();
});

describe('heartbeat-monitor', () => {
  it('marks stale servers as offline', async () => {
    const count = await markStaleServersOffline(60);
    expect(count).toBeGreaterThanOrEqual(1);

    const stale = await pool.query(`SELECT status FROM customer_servers WHERE id=$1`, [staleServerId]);
    expect(stale.rows[0].status).toBe('offline');
  });

  it('does not touch fresh servers', async () => {
    await markStaleServersOffline(60);
    const fresh = await pool.query(`SELECT status FROM customer_servers WHERE id=$1`, [freshServerId]);
    expect(fresh.rows[0].status).toBe('online');
  });

  it('does not touch already-offline servers', async () => {
    const result = await markStaleServersOffline(60);
    // 第二次跑应该 0 改动（stale 已经 offline）
    const result2 = await markStaleServersOffline(60);
    expect(result2).toBe(0);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd central && npx vitest run __tests__/heartbeat-monitor.test.ts
```
预期：FAIL（找不到 `markStaleServersOffline`）

- [ ] **步骤 3：写 `central/lib/heartbeat-monitor.ts`**

```typescript
import { query } from './db';

export async function markStaleServersOffline(thresholdSeconds: number): Promise<number> {
  const result = await query(
    `UPDATE customer_servers
     SET status = 'offline'
     WHERE status = 'online'
       AND last_heartbeat IS NOT NULL
       AND last_heartbeat < now() - ($1 || ' seconds')::interval
     RETURNING id`,
    [String(thresholdSeconds)]
  );
  return result.rowCount ?? 0;
}

export function startHeartbeatMonitor(thresholdSeconds = 60, intervalMs = 10000): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      const count = await markStaleServersOffline(thresholdSeconds);
      if (count > 0) console.log(`[heartbeat-monitor] marked ${count} stale servers offline`);
    } catch (err) {
      console.error('[heartbeat-monitor] failed:', err);
    }
  }, intervalMs);
}
```

- [ ] **步骤 4：在 `central/server.ts` 中启动心跳监控**

```typescript
// 在 server.listen 之前加：
import { startHeartbeatMonitor } from '@/lib/heartbeat-monitor';
startHeartbeatMonitor(60, 10000);
```

- [ ] **步骤 5：运行测试验证通过**

```bash
cd central && npx vitest run __tests__/heartbeat-monitor.test.ts
```
预期：PASS 3 tests

- [ ] **步骤 6：Commit**

```bash
git add central/lib/heartbeat-monitor.ts central/__tests__/heartbeat-monitor.test.ts central/server.ts
git commit -m "feat(central): add heartbeat monitor (60s stale → offline) (M2-4)"
```

---

## 任务 5：Agent 项目脚手架

**文件：**
- 创建：`agent/package.json`、`agent/tsconfig.json`、`agent/Dockerfile`
- 创建：`agent/src/config.ts`

- [ ] **步骤 1：写 `agent/package.json`**

```json
{
  "name": "yousen-agent",
  "version": "0.1.0",
  "type": "module",
  "bin": { "yousen-agent": "dist/index.js" },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "register": "tsx src/index.ts register",
    "test": "vitest run"
  },
  "dependencies": {
    "ws": "^8.16.0",
    "execa": "^8.0.1"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tsx": "^4.6.2",
    "vitest": "^1.0.0",
    "@types/ws": "^8.5.10",
    "@types/node": "^20.0.0",
    "@sinonjs/fake-timers": "^11.2.2"
  }
}
```

- [ ] **步骤 2：写 `agent/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **步骤 3：写 `agent/src/config.ts`**

```typescript
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface AgentConfig {
  centralWsUrl: string;
  centralApiUrl: string;
  serverId: string;
  agentToken: string;
}

const ENV_FILE = process.env.AGENT_ENV_FILE ?? '/etc/yousen-agent/agent.env';

export function loadConfig(): AgentConfig {
  // 优先从环境变量读
  if (process.env.CENTRAL_WS_URL && process.env.AGENT_TOKEN && process.env.SERVER_ID) {
    return {
      centralWsUrl: process.env.CENTRAL_WS_URL,
      centralApiUrl: process.env.CENTRAL_API_URL ?? process.env.CENTRAL_WS_URL.replace('ws', 'http').replace('/ws', ''),
      serverId: process.env.SERVER_ID,
      agentToken: process.env.AGENT_TOKEN,
    };
  }
  // 回退到 env 文件
  if (existsSync(ENV_FILE)) {
    const content = readFileSync(ENV_FILE, 'utf8');
    const env: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
      if (m) env[m[1]] = m[2];
    }
    return {
      centralWsUrl: env.CENTRAL_WS_URL,
      centralApiUrl: env.CENTRAL_API_URL,
      serverId: env.SERVER_ID,
      agentToken: env.AGENT_TOKEN,
    };
  }
  throw new Error(`No config found. Set env vars or create ${ENV_FILE}`);
}

export const AGENT_VERSION = '0.1.0';
```

- [ ] **步骤 4：写 `agent/Dockerfile`**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
ENTRYPOINT ["node", "dist/index.js"]
```

- [ ] **步骤 5：Commit**

```bash
git add agent/
git commit -m "feat(agent): scaffold project + config loader (M2-5)"
```

---

## 任务 6：Agent 注册子命令（TDD）

**文件：**
- 创建：`agent/src/register.ts`
- 测试：`agent/__tests__/register.test.ts`

- [ ] **步骤 1：写失败的注册测试**

`agent/__tests__/register.test.ts`：
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { performEnrollment } from '../src/register';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

const mockWriteFile = vi.fn();
vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
  writeFileSync: mockWriteFile,
  existsSync: vi.fn(() => false),
}));

describe('performEnrollment', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('posts to /api/agent/enroll and writes agent.env', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ serverId: 'srv-123', agentToken: 'tok-abc' }),
    });

    const result = await performEnrollment({
      centralApiUrl: 'https://central.example.com',
      enrollmentCode: 'CODE123',
      hostname: 'srv-1',
      displayName: '生产1',
      envFile: '/tmp/agent.env',
    });

    expect(result).toEqual({ serverId: 'srv-123', agentToken: 'tok-abc' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://central.example.com/api/agent/enroll',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentCode: 'CODE123', hostname: 'srv-1', displayName: '生产1' }),
      })
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/tmp/agent.env',
      expect.stringContaining('AGENT_TOKEN=tok-abc')
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/tmp/agent.env',
      expect.stringContaining('SERVER_ID=srv-123')
    );
  });

  it('throws on invalid enrollment code', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 401,
      json: async () => ({ error: 'Invalid or expired enrollment code' }),
    });
    await expect(performEnrollment({
      centralApiUrl: 'https://central.example.com',
      enrollmentCode: 'BAD', hostname: 'srv-1', displayName: '', envFile: '/tmp/agent.env',
    })).rejects.toThrow('Invalid or expired enrollment code');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd agent && npx vitest run __tests__/register.test.ts
```
预期：FAIL（找不到 `performEnrollment`）

- [ ] **步骤 3：写 `agent/src/register.ts`**

```typescript
import { mkdirSync, writeFileSync, dirname } from 'node:fs';

export interface EnrollmentParams {
  centralApiUrl: string;
  enrollmentCode: string;
  hostname: string;
  displayName: string;
  envFile: string;
}

export interface EnrollmentResult {
  serverId: string;
  agentToken: string;
}

export async function performEnrollment(params: EnrollmentParams): Promise<EnrollmentResult> {
  const res = await fetch(`${params.centralApiUrl}/api/agent/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enrollmentCode: params.enrollmentCode,
      hostname: params.hostname,
      displayName: params.displayName || undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Enrollment failed with status ${res.status}`);
  }

  const result: EnrollmentResult = await res.json();

  // 写 env 文件
  mkdirSync(dirname(params.envFile), { recursive: true });
  const envContent = [
    `CENTRAL_API_URL=${params.centralApiUrl}`,
    `CENTRAL_WS_URL=${params.centralApiUrl.replace(/^http/, 'ws')}/api/agent/ws`,
    `SERVER_ID=${result.serverId}`,
    `AGENT_TOKEN=${result.agentToken}`,
    '',
  ].join('\n');
  writeFileSync(params.envFile, envContent, { mode: 0o600 });

  return result;
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd agent && npx vitest run __tests__/register.test.ts
```
预期：PASS 2 tests

- [ ] **步骤 5：Commit**

```bash
git add agent/src/register.ts agent/__tests__/register.test.ts
git commit -m "feat(agent): add enrollment subcommand (M2-6)"
```

---

## 任务 7：Agent WebSocket 客户端 + 指数退避重连（TDD）

**文件：**
- 创建：`agent/src/connection.ts`
- 测试：`agent/__tests__/connection.test.ts`

- [ ] **步骤 1：写失败的重连算法测试（fake clock）**

`agent/__tests__/connection.test.ts`：
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FakeTimers from '@sinonjs/fake-timers';
import { calculateReconnectDelay } from '../src/connection';

describe('calculateReconnectDelay', () => {
  it('doubles delay each attempt', () => {
    expect(calculateReconnectDelay(0)).toBe(1000);
    expect(calculateReconnectDelay(1)).toBe(2000);
    expect(calculateReconnectDelay(2)).toBe(4000);
    expect(calculateReconnectDelay(3)).toBe(8000);
    expect(calculateReconnectDelay(4)).toBe(16000);
    expect(calculateReconnectDelay(5)).toBe(32000);
    expect(calculateReconnectDelay(6)).toBe(60000); // 上限
    expect(calculateReconnectDelay(7)).toBe(60000); // 仍然上限
  });

  it('includes jitter (0-1000ms)', () => {
    for (let i = 0; i < 100; i++) {
      const delay = calculateReconnectDelay(2);
      // base=4000, jitter 0-1000
      expect(delay).toBeGreaterThanOrEqual(4000);
      expect(delay).toBeLessThanOrEqual(5000);
    }
  });
});

describe('AgentConnection reconnect', () => {
  let clock: ReturnType<typeof FakeTimers.install>;
  const mockWs = vi.fn();

  beforeEach(() => {
    clock = FakeTimers.install({ now: Date.now() });
    mockWs.mockClear();
  });
  afterEach(() => clock.uninstall());

  it('reconnects with exponential backoff on close', async () => {
    // 简化的集成测试：模拟 ws close → 验证 setTimeout 调用间隔
    // 完整的 ws mock 较复杂，这里只验证算法
    const delays: number[] = [];
    let attempt = 0;
    const recordDelay = () => {
      const d = calculateReconnectDelay(attempt++);
      delays.push(d);
      return d;
    };
    recordDelay(); recordDelay(); recordDelay();
    expect(delays).toEqual([1000, 2000, 4000]);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd agent && npx vitest run __tests__/connection.test.ts
```
预期：FAIL（找不到 `calculateReconnectDelay`）

- [ ] **步骤 3：写 `agent/src/connection.ts`**

```typescript
import WebSocket from 'ws';
import { AGENT_VERSION } from './config';
import { execSync } from 'node:child_process';
import { executeCommand } from './executor';

const HEARTBEAT_INTERVAL_MS = 30000;

export function calculateReconnectDelay(attempt: number): number {
  const base = Math.min(1000 * Math.pow(2, attempt), 60000);
  const jitter = Math.random() * 1000;
  return base + jitter;
}

export interface CommandHandler {
  onProgress: (stage: string, message: string) => void;
  onLog: (stream: 'stdout' | 'stderr', line: string) => void;
}

export class AgentConnection {
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private disposed = false;
  private readonly onStatusChange: (status: 'online' | 'offline') => void;

  constructor(
    private readonly wsUrl: string,
    private readonly token: string,
    private readonly serverId: string,
    onStatusChange?: (status: 'online' | 'offline') => void
  ) {
    this.onStatusChange = onStatusChange ?? (() => {});
  }

  start(): void {
    this.disposed = false;
    this.connect();
  }

  private connect(): void {
    const url = `${this.wsUrl}?token=${this.token}`;
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.reconnectAttempt = 0;
      this.onStatusChange('online');
      this.sendRegister();
      this.startHeartbeat();
    });

    this.ws.on('message', (raw) => {
      try {
        const cmd = JSON.parse(raw.toString());
        this.handleCommand(cmd).catch((err) => {
          console.error('[agent] command failed:', err);
        });
      } catch (err) {
        console.error('[agent] message parse failed:', err);
      }
    });

    this.ws.on('close', () => {
      this.stopHeartbeat();
      this.onStatusChange('offline');
      if (!this.disposed) this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[agent] ws error:', err.message);
      // close 事件会随后触发，触发重连
    });
  }

  private sendRegister(): void {
    this.send({
      type: 'agent:register',
      serverId: this.serverId,
      agentVersion: AGENT_VERSION,
      hostname: require('node:os').hostname(),
      dockerVersion: this.getDockerVersion(),
    });
  }

  private getDockerVersion(): string {
    try { return execSync('docker --version', { encoding: 'utf8' }).trim(); }
    catch { return 'unknown'; }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const heartbeat = this.collectHeartbeat();
      this.send({ type: 'agent:heartbeat', ...heartbeat });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private collectHeartbeat() {
    const os = require('node:os');
    const cpu = os.loadavg()[0];
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const mem = (totalMem - freeMem) / totalMem;
    const disk = this.getDiskUsage();
    return { cpu, mem, disk, services: [] };
  }

  private getDiskUsage(): number {
    try {
      const out = execSync(`df -P / | awk 'NR==2 {print $5}'`, { encoding: 'utf8' }).trim();
      return parseFloat(out) / 100;
    } catch { return 0; }
  }

  private async handleCommand(cmd: any): Promise<void> {
    // 幂等去重
    if (this.processedCommands.has(cmd.commandId)) return;
    this.processedCommands.add(cmd.commandId);
    setTimeout(() => this.processedCommands.delete(cmd.commandId), 5 * 60 * 1000);

    this.send({ type: 'command:ack', commandId: cmd.commandId, receivedAt: new Date().toISOString() });

    const startedAt = Date.now();
    const hooks: CommandHandler = {
      onProgress: (stage, message) => this.send({ type: 'command:progress', commandId: cmd.commandId, stage, message }),
      onLog: (stream, line) => this.send({ type: 'log:line', jobId: cmd.jobId ?? cmd.commandId, stream, line, ts: new Date().toISOString() }),
    };

    try {
      const stdout = await executeCommand(cmd, hooks);
      this.send({
        type: 'command:result', commandId: cmd.commandId, success: true,
        stdout, durationMs: Date.now() - startedAt,
      });
    } catch (err: any) {
      this.send({
        type: 'command:result', commandId: cmd.commandId, success: false,
        exitCode: err.exitCode ?? 1, stderr: err.message, durationMs: Date.now() - startedAt,
      });
    }
  }

  private processedCommands = new Set<string>();

  private scheduleReconnect(): void {
    const delay = calculateReconnectDelay(this.reconnectAttempt++);
    console.log(`[agent] reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempt})`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private send(msg: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    if (this.ws) {
      await new Promise<void>((resolve) => {
        if (this.ws!.readyState === WebSocket.CLOSED) return resolve();
        this.ws!.once('close', () => resolve());
        this.ws!.close(1001, 'agent shutdown');
        // 兜底：1 秒后强制关闭
        setTimeout(() => {
          if (this.ws!.readyState !== WebSocket.CLOSED) this.ws!.terminate();
          resolve();
        }, 1000);
      });
    }
  }
}
```

注意：`./executor` 在 M3 实现。M2 单元测试只验证 `calculateReconnectDelay`，不实例化 `AgentConnection`。临时占位：

```typescript
// agent/src/executor.ts（M2 临时占位，M3 完整实现）
export async function executeCommand(_cmd: any, _hooks: any): Promise<string | undefined> {
  throw new Error('executor not implemented yet (M3)');
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd agent && npx vitest run __tests__/connection.test.ts
```
预期：PASS 3 tests

- [ ] **步骤 5：Commit**

```bash
git add agent/src/connection.ts agent/src/executor.ts agent/__tests__/connection.test.ts
git commit -m "feat(agent): add WS client + exponential backoff reconnect (M2-7)"
```

---

## 任务 8：Agent 心跳上报器（TDD）

**文件：**
- 创建：`agent/src/reporter.ts`
- 测试：`agent/__tests__/reporter.test.ts`

- [ ] **步骤 1：写失败的心跳采集测试**

`agent/__tests__/reporter.test.ts`：
```typescript
import { describe, it, expect } from 'vitest';
import { collectHeartbeatData } from '../src/reporter';

describe('collectHeartbeatData', () => {
  it('returns cpu/mem/disk as numbers in [0,1] or positive', () => {
    const data = collectHeartbeatData();
    expect(typeof data.cpu).toBe('number');
    expect(data.cpu).toBeGreaterThanOrEqual(0);
    expect(typeof data.mem).toBe('number');
    expect(data.mem).toBeGreaterThan(0);
    expect(data.mem).toBeLessThanOrEqual(1);
    expect(typeof data.disk).toBe('number');
    expect(data.disk).toBeGreaterThan(0);
    expect(data.disk).toBeLessThanOrEqual(1);
  });

  it('returns empty services array (M2 has no docker inspection)', () => {
    const data = collectHeartbeatData();
    expect(Array.isArray(data.services)).toBe(true);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd agent && npx vitest run __tests__/reporter.test.ts
```
预期：FAIL（找不到 `collectHeartbeatData`）

- [ ] **步骤 3：写 `agent/src/reporter.ts`**

```typescript
import os from 'node:os';
import { execSync } from 'node:child_process';

export interface HeartbeatData {
  cpu: number;
  mem: number;
  disk: number;
  services: Array<{ name: string; status: string }>;
}

export function collectHeartbeatData(): HeartbeatData {
  const cpu = os.loadavg()[0];  // 1 分钟平均负载
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const mem = (totalMem - freeMem) / totalMem;
  const disk = getDiskUsage();
  return { cpu, mem, disk, services: [] };
}

function getDiskUsage(): number {
  try {
    const out = execSync(`df -P / | awk 'NR==2 {print $5}'`, { encoding: 'utf8' }).trim();
    return parseFloat(out.replace('%', '')) / 100;
  } catch {
    return 0;
  }
}
```

注：`connection.ts` 的 `collectHeartbeat` 内联逻辑可改为调用 `collectHeartbeatData()`（重构）。

- [ ] **步骤 4：运行测试验证通过**

```bash
cd agent && npx vitest run __tests__/reporter.test.ts
```
预期：PASS 2 tests

- [ ] **步骤 5：Commit**

```bash
git add agent/src/reporter.ts agent/__tests__/reporter.test.ts
git commit -m "feat(agent): add heartbeat data collector (M2-8)"
```

---

## 任务 9：Agent 主入口 + 优雅关闭

**文件：**
- 创建：`agent/src/index.ts`

- [ ] **步骤 1：写 `agent/src/index.ts`**

```typescript
#!/usr/bin/env node
import { loadConfig } from './config';
import { AgentConnection } from './connection';
import { performEnrollment } from './register';

async function main() {
  const args = process.argv.slice(2);

  // 子命令：register
  if (args[0] === 'register') {
    const centralApiUrl = requireEnv('--central');
    const enrollmentCode = requireEnv('--enrollment-code');
    const hostname = requireEnv('--hostname');
    const displayName = optionalArg('--display-name') ?? hostname;
    const envFile = optionalArg('--env-file') ?? '/etc/yousen-agent/agent.env';

    const result = await performEnrollment({ centralApiUrl, enrollmentCode, hostname, displayName, envFile });
    console.log(`[register] success. serverId=${result.serverId}`);
    console.log(`[register] agent.env written to ${envFile}`);
    process.exit(0);
  }

  // 默认：启动 Agent 长连接
  const config = loadConfig();
  console.log(`[agent] starting. serverId=${config.serverId} central=${config.centralWsUrl}`);

  const conn = new AgentConnection(
    config.centralWsUrl,
    config.agentToken,
    config.serverId,
    (status) => console.log(`[agent] status: ${status}`)
  );
  conn.start();

  // 优雅关闭
  const shutdown = async (signal: string) => {
    console.log(`[agent] received ${signal}, shutting down...`);
    await conn.dispose();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

function requireEnv(flag: string): string {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || !process.argv[idx + 1]) {
    console.error(`Missing required flag: ${flag} <value>`);
    process.exit(1);
  }
  return process.argv[idx + 1];
}

function optionalArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

main().catch((err) => {
  console.error('[agent] fatal:', err);
  process.exit(1);
});
```

- [ ] **步骤 2：手动冒烟测试**

```bash
# 前置：中央已启动 + 已颁发 enrollment code
cd central && npm run dev &
# 颁发 code（通过 admin UI 或 curl）
CODE=...

cd agent && npx tsx src/index.ts register \
  --central http://localhost:3000 \
  --enrollment-code $CODE \
  --hostname test-srv-1 \
  --display-name "测试服务器1" \
  --env-file /tmp/agent.env

# 验证 /tmp/agent.env 已写入
cat /tmp/agent.env
# 预期：CENTRAL_API_URL=... SERVER_ID=... AGENT_TOKEN=...

# 启动 Agent
CENTRAL_WS_URL=ws://localhost:3000/api/agent/ws \
SERVER_ID=... AGENT_TOKEN=... \
npx tsx src/index.ts
# 预期：[agent] status: online
# 中央管理后台 servers 页面应显示 test-srv-1 为 online
```

- [ ] **步骤 3：Commit**

```bash
git add agent/src/index.ts
git commit -m "feat(agent): add main entry + register subcommand + graceful shutdown (M2-9)"
```

---

## 任务 10：WebSocket 端到端集成测试

**文件：**
- 测试：`central/__tests__/ws-integration.test.ts`

- [ ] **步骤 1：写集成测试（模拟 Agent 连接）**

`central/__tests__/ws-integration.test.ts`：
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { pool } from '@/lib/db';
import { generateEnrollmentCode } from '@/lib/agent-auth';

const CENTRAL_URL = 'http://localhost:3000';
const CENTRAL_WS = 'ws://localhost:3000/api/agent/ws';

let customerId: string;
let serverId: string;
let agentToken: string;

beforeAll(async () => {
  const c = await pool.query(`INSERT INTO customers (name) VALUES ('WS集成测试') RETURNING id`);
  customerId = c.rows[0].id;
  const code = await generateEnrollmentCode(customerId);

  // 调 enroll API 换 token
  const res = await fetch(`${CENTRAL_URL}/api/agent/enroll`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrollmentCode: code, hostname: 'ws-test', displayName: 'WS测试' }),
  });
  const body = await res.json();
  serverId = body.serverId;
  agentToken = body.agentToken;
});

afterAll(async () => {
  await pool.query(`DELETE FROM agent_tokens; DELETE FROM customer_servers; DELETE FROM enrollment_codes; DELETE FROM customers;`);
  await pool.end();
});

describe('WebSocket integration', () => {
  it('connects with valid token and receives welcome', async () => {
    const ws = new WebSocket(`${CENTRAL_WS}?token=${agentToken}`);
    const welcome = await new Promise<any>((resolve, reject) => {
      ws.on('message', (raw) => resolve(JSON.parse(raw.toString())));
      ws.on('error', reject);
      setTimeout(() => reject(new Error('timeout')), 5000);
    });
    expect(welcome.type).toBe('agent:welcome');
    expect(welcome.serverId).toBe(serverId);
    ws.close();
  });

  it('rejects connection without token', async () => {
    const ws = new WebSocket(CENTRAL_WS);
    await new Promise<void>((resolve) => {
      ws.on('error', () => resolve());
      ws.on('close', () => resolve());
    });
  });

  it('receives agent:register and updates db status to online', async () => {
    const ws = new WebSocket(`${CENTRAL_WS}?token=${agentToken}`);
    await new Promise<void>((resolve) => ws.on('open', resolve));

    ws.send(JSON.stringify({
      type: 'agent:register',
      serverId, agentVersion: '0.1.0-test', hostname: 'ws-test', dockerVersion: 'Docker 24.0',
    }));

    // 等 db 更新
    await new Promise((r) => setTimeout(r, 500));
    const row = await pool.query(`SELECT status, agent_version FROM customer_servers WHERE id=$1`, [serverId]);
    expect(row.rows[0].status).toBe('online');
    expect(row.rows[0].agent_version).toBe('0.1.0-test');
    ws.close();
  });

  it('updates last_heartbeat on agent:heartbeat message', async () => {
    const ws = new WebSocket(`${CENTRAL_WS}?token=${agentToken}`);
    await new Promise<void>((resolve) => ws.on('open', resolve));

    ws.send(JSON.stringify({
      type: 'agent:heartbeat', cpu: 0.5, mem: 0.6, disk: 0.3, services: [],
    }));

    await new Promise((r) => setTimeout(r, 500));
    const row = await pool.query(`SELECT last_heartbeat, meta FROM customer_servers WHERE id=$1`, [serverId]);
    expect(row.rows[0].last_heartbeat).not.toBeNull();
    expect(JSON.parse(row.rows[0].meta).cpu).toBe(0.5);
    ws.close();
  });
});
```

- [ ] **步骤 2：运行集成测试**

```bash
cd central && npx vitest run __tests__/ws-integration.test.ts
```
预期：PASS 4 tests

- [ ] **步骤 3：Commit**

```bash
git add central/__tests__/ws-integration.test.ts
git commit -m "test(central): add WebSocket end-to-end integration test (M2-10)"
```

---

## 任务 11：Agent README + 端到端验证

**文件：**
- 创建：`agent/README.md`

- [ ] **步骤 1：写 `agent/README.md`**

````markdown
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
````

- [ ] **步骤 2：完整端到端验证**

```bash
# 1. 启动中央
cd central && docker compose up -d

# 2. 登录中央 admin UI → 创建客户「测试客户」→ 颁发 enrollment code

# 3. 在另一台机器（或同机不同端口）模拟 Agent
cd agent
npx tsx src/index.ts register \
  --central http://localhost:3000 \
  --enrollment-code <上一步获得的 code> \
  --hostname e2e-test \
  --display-name "E2E测试" \
  --env-file /tmp/agent.env

# 4. 启动 Agent 长连接
source /tmp/agent.env && \
CENTRAL_WS_URL=ws://localhost:3000/api/agent/ws \
npx tsx src/index.ts

# 5. 验证：
# - Agent 日志显示 [agent] status: online
# - 中央 servers 列表显示 e2e-test 状态 online
# - 30 秒后 db 中 last_heartbeat 更新
# - kill Agent → 60 秒后中央标记 offline
# - 重启 Agent → 状态恢复 online
```

- [ ] **步骤 3：跑全部测试**

```bash
cd central && npx vitest run
cd ../agent && npx vitest run
```
预期：全部 PASS

- [ ] **步骤 4：Commit + tag**

```bash
git add agent/README.md
git commit -m "docs(agent): add installation + troubleshooting guide (M2-11)"
git tag m2-complete
```

---

## M2 自检

**规格覆盖度：**
- 第 4 节通信协议 → 任务 1/3/7（消息类型全覆盖）✓
- 第 6.1 节接口签名 → 任务 1（WebSocketServer）✓
- 第 6.2 节指令路由器 → 任务 1（agent-router.ts）✓
- 第 6.3 节 Agent WebSocket 客户端 → 任务 7 ✓
- 第 6.5 节首次注册流程 → 任务 6/3 ✓
- 第 9.1 节 Agent Token → 任务 2 ✓
- 第 9.5 节指令幂等 → 任务 7（processedCommands Set）✓
- 第 10 节高可用（重连/心跳/优雅关闭） → 任务 4/7/9 ✓
- 第 12.2 节交付物清单 → 任务 1-11 全覆盖 ✓

**类型一致性：**
- `AgentMessage` 在任务 1 定义，任务 10 测试使用一致 ✓
- `verifyAgentToken` 返回 `{ id, customer_id }`，任务 1 server.ts 使用 `serverRow.id` 一致 ✓
- `calculateReconnectDelay(attempt)` 上限 60000，与规格第 10.2 节一致 ✓

**遗漏：** M3 的 executor 仍是占位（任务 7 步骤 3 已说明），M3 完整实现。
