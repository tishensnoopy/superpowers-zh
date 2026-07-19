// 真实 PG + fetch 集成测试（对齐 api-servers.test.ts / api-enrollment.test.ts）。
// 运行前提：
//   1. central dev server 在 localhost:3000 运行，且启动时带上 bundle 相关 env：
//        cd central && set -a && source .env && set +a && \
//        CENTRAL_CODE_REPO=/tmp/central-code-repo-test \
//        CENTRAL_BUNDLE_DIR=/tmp/central-bundles-test \
//        npm run dev
//   2. DATABASE_URL 指向的 PG 可达且已迁移（bundles 表存在）。
//
// 为什么不用 vi.mock 替换 buildBundle（原计划的 mock 方案不可行）：
//   本测试通过真实 HTTP 打 dev server（独立进程，tsx server.ts），vitest 的
//   vi.mock 只作用于测试进程自身的模块图，无法拦截 dev server 进程里的
//   buildBundle 调用（先例：现有全部 fetch 集成测试均不使用 vi.mock；
//   deploy-flow.test.ts 的 mock 有效是因为它在测试进程内直接调用 handleDeploy）。
//   因此改为真实 fixture：beforeAll 在固定路径建一个带 main 分支的 git repo，
//   buildBundle 真实执行 git fetch + git archive —— 端到端覆盖更强。
//   buildBundle 自身的注入式单测在 bundles-lib.test.ts。
//
// 路径必须是固定的（不能用 mkdtemp）：lib/bundles.ts 的 BUNDLE_DIR/REPO_PATH
// 在 dev server 进程模块加载时读取，测试进程里设 process.env 对 dev server 无效，
// 两边必须用同一个事先约定的目录。
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';

import { pool } from '@/lib/db';
import { hashPassword, signJwt } from '@/lib/auth';
import { generateAgentToken } from '@/lib/agent-auth';

const BASE = 'http://localhost:3000';
const REPO_DIR = process.env.CENTRAL_CODE_REPO ?? '/tmp/central-code-repo-test';
const BUNDLE_DIR = process.env.CENTRAL_BUNDLE_DIR ?? '/tmp/central-bundles-test';

let adminToken: string;
let adminId: string;
let serverId: string;
let agentToken: string;

beforeAll(async () => {
  // fixture git repo：buildBundle 会真实执行 git fetch --all + git archive main。
  // 幂等：重复运行时 commit 无变化会失败，用 || true 吞掉（repo 已就绪即可）。
  mkdirSync(REPO_DIR, { recursive: true });
  mkdirSync(BUNDLE_DIR, { recursive: true });
  execSync(
    'git init -b main -q && git config user.email t@t.local && git config user.name t && ' +
      'echo hello > README.md && git add . && (git commit -qm init || true)',
    { cwd: REPO_DIR, shell: '/bin/bash' }
  );

  const hash = await hashPassword('Test123!');
  const u = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('bundle@x.local',$1,'admin') RETURNING id`,
    [hash]
  );
  adminId = u.rows[0].id;
  adminToken = await signJwt({ sub: adminId, email: 'bundle@x.local', role: 'admin' });
  const c = await pool.query(`INSERT INTO customers (name) VALUES ('Bundle测试') RETURNING id`);
  const s = await pool.query(
    `INSERT INTO customer_servers (customer_id, hostname) VALUES ($1,'bundle-srv') RETURNING id`,
    [c.rows[0].id]
  );
  serverId = s.rows[0].id;
  agentToken = await generateAgentToken(serverId);
});

afterAll(async () => {
  await pool.query(
    `TRUNCATE TABLE audit_logs, job_logs, deploy_jobs, agent_tokens, customer_servers, enrollment_codes, customer_configs, customers, admin_users, bundles CASCADE;`
  );
  await pool.end();
  rmSync(REPO_DIR, { recursive: true, force: true });
  rmSync(BUNDLE_DIR, { recursive: true, force: true });
});

describe('POST /api/admin/bundles', () => {
  it('创建记录 → buildBundle 真实构建 → 201 返回 ready 记录', async () => {
    const res = await fetch(`${BASE}/api/admin/bundles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ ref: 'main' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.bundle.ref).toBe('main');
    expect(body.bundle.status).toBe('ready');
    // BIGINT 经 pg 驱动序列化为字符串（int8 默认行为）
    expect(Number(body.bundle.size_bytes)).toBeGreaterThan(0);
    // 真实构建产物落盘
    expect(existsSync(path.join(BUNDLE_DIR, `${body.bundle.id}.tar.gz`))).toBe(true);
    // DB 记录归属当前 admin
    const dbRow = await pool.query(`SELECT created_by FROM bundles WHERE id=$1`, [body.bundle.id]);
    expect(dbRow.rows[0].created_by).toBe(adminId);
  });

  it('ref 缺失 → 400', async () => {
    const res = await fetch(`${BASE}/api/admin/bundles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('buildBundle 失败（不存在的 ref）→ 500，lib 内部落库 failed', async () => {
    const res = await fetch(`${BASE}/api/admin/bundles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ ref: 'no-such-ref' }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    // git 报错文案随 locale 变化（中文 locale：不是一个有效的对象名），
    // 但 ref 名恒定出现在 err.message（命令行 + git 输出），用它断言错误透传。
    expect(body.error).toContain('no-such-ref');
    // lib 内部已把该 bundle 标记 failed
    const dbRow = await pool.query(
      `SELECT status, error FROM bundles WHERE ref='no-such-ref' ORDER BY created_at DESC LIMIT 1`
    );
    expect(dbRow.rows[0].status).toBe('failed');
    expect(dbRow.rows[0].error).toContain('no-such-ref');
  });
});

describe('GET /api/admin/bundles', () => {
  it('返回 bundle 列表（含刚构建的记录）', async () => {
    const res = await fetch(`${BASE}/api/admin/bundles`, {
      headers: { cookie: `central_admin_session=${adminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.bundles)).toBe(true);
    const mainBundle = body.bundles.find((b: { ref: string }) => b.ref === 'main');
    expect(mainBundle).toBeDefined();
    expect(mainBundle.status).toBe('ready');
  });
});

describe('GET /api/agent/bundles/[id]/download', () => {
  async function insertBundle(status: string): Promise<string> {
    const b = await pool.query(
      `INSERT INTO bundles (ref, filename, status) VALUES ('main','',$1) RETURNING id`,
      [status]
    );
    return b.rows[0].id;
  }

  it('无 Authorization → 401', async () => {
    const res = await fetch(`${BASE}/api/agent/bundles/any-id/download`);
    expect(res.status).toBe(401);
  });

  it('token 无效 → 401', async () => {
    const id = await insertBundle('ready');
    const res = await fetch(`${BASE}/api/agent/bundles/${id}/download`, {
      headers: { Authorization: 'Bearer wrong-token' },
    });
    expect(res.status).toBe(401);
  });

  it('token 有效但 bundle 非 ready → 409', async () => {
    const id = await insertBundle('building');
    const res = await fetch(`${BASE}/api/agent/bundles/${id}/download`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    expect(res.status).toBe(409);
  });

  it('token 有效 + ready → 200 流式返回带 content-length 与字节内容', async () => {
    const id = await insertBundle('ready');
    const fileBytes = Buffer.from('fake-tar-gz-content');
    writeFileSync(path.join(BUNDLE_DIR, `${id}.tar.gz`), fileBytes);
    const res = await fetch(`${BASE}/api/agent/bundles/${id}/download`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-length')).toBe(String(fileBytes.length));
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.equals(fileBytes)).toBe(true);
  });
});
