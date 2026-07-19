// 真实 PG + fetch 集成测试（对齐 api-bundles.test.ts / ws-integration.test.ts）。
// 运行前提：central dev server 在 localhost:3000 运行
//   cd central && set -a && source .env && set +a && npm run dev
//
// 为什么不用 vi.mock mock @/lib/connections（对规格原 mock 方案的修正）：
//   本测试通过真实 HTTP 打 dev server（独立进程，tsx server.ts），vitest 的
//   vi.mock 只作用于测试进程自身的模块图，无法拦截 dev server 进程里的
//   isOnline/sendToServer（先例见 api-bundles.test.ts 头部注释；
//   deploy-flow.test.ts 的 mock 有效是因为它在测试进程内直接调用 handler）。
//   改用更强的真实方案：测试进程用 ws 客户端以 agent token 连上 dev server 的
//   /api/agent/ws —— dev server 的 connections 表真实注册，isOnline 真实为 true，
//   sendToServer 下发的 command 经真实 WebSocket 被测试客户端捕获（端到端覆盖强于 mock）。
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { pool } from '@/lib/db';
import { hashPassword, signJwt } from '@/lib/auth';
import { generateAgentToken } from '@/lib/agent-auth';

const BASE = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/api/agent/ws';

let adminToken: string;
let customerId: string;
let serverId: string;
let agentToken: string;
let offlineServerId: string;

beforeAll(async () => {
  const hash = await hashPassword('Test123!');
  const u = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('prov@x.local',$1,'admin') RETURNING id`,
    [hash]
  );
  adminToken = await signJwt({ sub: u.rows[0].id, email: 'prov@x.local', role: 'admin' });
  const c = await pool.query(`INSERT INTO customers (name) VALUES ('Provision测试') RETURNING id`);
  customerId = c.rows[0].id;
  const s = await pool.query(
    `INSERT INTO customer_servers (customer_id, hostname) VALUES ($1,'prov-srv') RETURNING id`,
    [customerId]
  );
  serverId = s.rows[0].id;
  agentToken = await generateAgentToken(serverId);
  const o = await pool.query(
    `INSERT INTO customer_servers (customer_id, hostname) VALUES ($1,'prov-offline') RETURNING id`,
    [customerId]
  );
  offlineServerId = o.rows[0].id;
  await pool.query(
    `INSERT INTO customer_configs (customer_id, version, env_overrides, published_at) VALUES ($1,1,$2,NOW())`,
    [customerId, JSON.stringify({ DATABASE_HOST: 'postgres' })]
  );
});

afterAll(async () => {
  await pool.query(
    `TRUNCATE TABLE audit_logs, job_logs, deploy_jobs, agent_tokens, customer_servers, enrollment_codes, customer_configs, customers, admin_users, bundles CASCADE;`
  );
  await pool.end();
});

async function insertBundle(status: string): Promise<string> {
  const b = await pool.query(
    `INSERT INTO bundles (ref, filename, status) VALUES ('main','',$1) RETURNING id`,
    [status]
  );
  return b.rows[0].id;
}

/** 以 agent 身份连上 dev server 的 WS，返回消息收集器。 */
function connectAgent(): Promise<{ ws: WebSocket; waitForCommand: () => Promise<any> }> {
  const ws = new WebSocket(`${WS_URL}?token=${agentToken}`);
  const messages: any[] = [];
  ws.on('message', (raw) => messages.push(JSON.parse(raw.toString())));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('welcome timeout')), 5000);
    const check = setInterval(() => {
      if (messages.some((m) => m.type === 'agent:welcome')) {
        clearTimeout(timer);
        clearInterval(check);
        resolve({
          ws,
          waitForCommand: () =>
            new Promise<any>((res, rej) => {
              const t = setTimeout(() => rej(new Error('command timeout')), 5000);
              const c = setInterval(() => {
                const cmd = messages.find((m) => typeof m.type === 'string' && m.type.startsWith('command:'));
                if (cmd) {
                  clearTimeout(t);
                  clearInterval(c);
                  res(cmd);
                }
              }, 20);
            }),
        });
      }
    }, 20);
    ws.on('error', reject);
  });
}

// 必须是函数：模块求值时 beforeAll 尚未运行，adminToken 还是 undefined
function adminHeaders() {
  return { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` };
}

describe('POST /api/admin/servers/[id]/deploy（bundle 注入）', () => {
  it('有 ready bundle → command 含 bundleUrl 与 bundleId，envVars 保留 config 差异', async () => {
    const bundleId = await insertBundle('ready');
    const { ws, waitForCommand } = await connectAgent();
    try {
      const res = await fetch(`${BASE}/api/admin/servers/${serverId}/deploy`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(202);
      const cmd = await waitForCommand();
      expect(cmd.type).toBe('command:deploy');
      expect(cmd.bundleId).toBe(bundleId);
      expect(cmd.bundleUrl).toBe(`/api/agent/bundles/${bundleId}/download`);
      expect(cmd.envVars.DATABASE_HOST).toBe('postgres');
      expect(cmd.mode).toBe('nginx');
    } finally {
      ws.close();
    }
  });

  it('无 ready bundle → 400 提示先构建发布包', async () => {
    await pool.query(`DELETE FROM bundles`);
    const res = await fetch(`${BASE}/api/admin/servers/${serverId}/deploy`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/bundle/i);
  });
});

describe('POST /api/admin/servers/[id]/provision', () => {
  it('生成随机密钥入 envVars（APP_KEYS 为 4 段逗号拼接），下发 command:provision', async () => {
    const bundleId = await insertBundle('ready');
    const { ws, waitForCommand } = await connectAgent();
    try {
      const res = await fetch(`${BASE}/api/admin/servers/${serverId}/provision`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.jobId).toBeDefined();
      expect(body.streamUrl).toBe(`/api/admin/jobs/${body.jobId}/stream`);

      const cmd = await waitForCommand();
      expect(cmd.type).toBe('command:provision');
      expect(cmd.bundleId).toBe(bundleId);
      expect(cmd.bundleUrl).toBe(`/api/agent/bundles/${bundleId}/download`);
      // agent executor 强依赖 centralApiUrl 拼接下载地址（env 优先，origin 兜底）
      expect(cmd.centralApiUrl).toBeTruthy();
      // APP_KEYS：4 段逗号拼接（3 个逗号），每段为足够长的随机密钥
      const appKeys = cmd.envVars.APP_KEYS.split(',');
      expect(appKeys).toHaveLength(4);
      for (const k of appKeys) expect(k.length).toBeGreaterThanOrEqual(32);
      // 自动生成的密钥不经过人手
      expect(cmd.envVars.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
      // config.env_overrides 的差异值保留
      expect(cmd.envVars.DATABASE_HOST).toBe('postgres');
      expect(cmd.mode).toBe('nginx');
    } finally {
      ws.close();
    }
  });

  it('agent 离线 → 409', async () => {
    await insertBundle('ready');
    const res = await fetch(`${BASE}/api/admin/servers/${offlineServerId}/provision`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(409);
  });

  it('显式传非 ready bundleId → 404', async () => {
    const buildingBundleId = await insertBundle('building');
    const res = await fetch(`${BASE}/api/admin/servers/${serverId}/provision`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ bundleId: buildingBundleId }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found or not ready/i);
  });

  it('显式传其他 customer 的 configId → 404', async () => {
    const other = await pool.query(`INSERT INTO customers (name) VALUES ('其他客户') RETURNING id`);
    const otherCfg = await pool.query(
      `INSERT INTO customer_configs (customer_id, version, env_overrides, published_at) VALUES ($1,1,'{}',NOW()) RETURNING id`,
      [other.rows[0].id]
    );
    const res = await fetch(`${BASE}/api/admin/servers/${serverId}/provision`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ configId: otherCfg.rows[0].id }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/config not found/i);
  });
});

describe('GET /api/admin/customers/[id]/bootstrap-script', () => {
  it('返回 text/plain 脚本：含 enrollment code、enroll URL、bundle 下载 URL、agent 启动段', async () => {
    const bundleId = await insertBundle('ready');
    const res = await fetch(`${BASE}/api/admin/customers/${customerId}/bootstrap-script`, {
      headers: { cookie: `central_admin_session=${adminToken}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    const body = await res.text();
    // enrollment code 真实落库（24h 一次性）
    const codeRow = await pool.query(
      `SELECT code FROM enrollment_codes WHERE customer_id=$1 ORDER BY issued_at DESC LIMIT 1`,
      [customerId]
    );
    expect(codeRow.rows.length).toBe(1);
    expect(body).toContain(codeRow.rows[0].code);
    // enroll / bundle 下载 / agent 启动段
    expect(body).toContain('/api/agent/enroll');
    expect(body).toContain(`/api/agent/bundles/${bundleId}/download`);
    expect(body).toContain('docker');
    expect(body).toContain('agent-compose.yml');
  });

  it('customer 不存在 → 404', async () => {
    const res = await fetch(`${BASE}/api/admin/customers/00000000-0000-0000-0000-000000000000/bootstrap-script`, {
      headers: { cookie: `central_admin_session=${adminToken}` },
    });
    expect(res.status).toBe(404);
  });

  it('无 ready bundle → 409', async () => {
    await pool.query(`DELETE FROM bundles`);
    const res = await fetch(`${BASE}/api/admin/customers/${customerId}/bootstrap-script`, {
      headers: { cookie: `central_admin_session=${adminToken}` },
    });
    expect(res.status).toBe(409);
  });
});
