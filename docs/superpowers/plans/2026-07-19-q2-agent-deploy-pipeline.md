# Q2 部署管道统一走 central agent 全自动 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 弃用"rsync + 手动脚本"与"agent git pull"双轨，统一为 central 全自动管道：central 构建发布包（bundle）→ agent 下载同步 → compose 重建 → 健康检查 → KB 初始化；全新服务器开通 = central 生成一条引导脚本（装 docker→enroll→拉包→起 agent），之后 provision 命令全自动完成剩余一切。

**架构：** 发布包是唯一代码分发载体（去 GitHub 依赖）：central 本机仓库 `git archive <ref>` 产出 tar.gz，存 `bundles` 表 + 文件系统；agent 凭已有 agent token 经 HTTP 下载（复用 enroll 的 token 哈希鉴权）。agent `deploy` 命令的"git pull"步骤替换为"bundle 下载+rsync 同步"（保留 --delete 语义防陈旧文件）；新增 `provision` 命令编排从零开通；bootstrap 引导脚本只解决"agent 如何上第一台裸机"的鸡生蛋问题，之后全部走 WS 命令。

**技术栈：** central（Next.js route handlers + pg + child_process）、agent（Node fetch/tar/rsync/docker compose）、vitest。

**规格来源：** `docs/superpowers/specs/2026-07-19-master-site-hardening-design.md` Q2 节（决策 D6=central agent 全自动含从零开通编排、弃 rsync；D2=不建客户自助账号）。

**前置依赖：** Q5 已合入（bootstrap 自检自愈保障 fresh 实例首启建表；provision 不再依赖手动数据修复脚本）。

---

## 关键事实（实施前必读，已核实）

- agent token 鉴权已有现成实现：`central/lib/agent-auth.ts` 的 `verifyAgentToken(token)` 返回 `{ id, customer_id }`，download 路由直接复用。
- central DB 迁移：执行器 `central/db/migrate.ts` **只执行 `schema.sql`**（全文件 `CREATE TABLE IF NOT EXISTS` 幂等，跑 `npx tsx db/migrate.ts`）；`db/migrations/`（002/003）无任何代码引用，仅历史档案。新表 = 改 `schema.sql` + 跑 migrate.ts，**不要新建 004 文件**。
- central 测试模式：API 路由测试 = **真实 PG + fetch `http://localhost:3000` 集成测试**（先例 `api-servers.test.ts`/`api-enrollment.test.ts`：beforeAll 插数据 + `signJwt` 拿 admin token、afterAll `TRUNCATE ... CASCADE`），运行需 central dev server 与已迁移 DB 在跑。需要 mock 的模块用 `vi.hoisted` + `vi.mock` factory（先例 `deploy-flow.test.ts` mock `execa`）。
- enroll 行为（已核实 `agent/enroll/route.ts:41-54`）：enroll **自动 INSERT customer_servers**（同 customer 下 hostname 重复返回 409），不要求 server 预先存在 → 裸机引导脚本按 **customer 维度**生成（enrollment code 本就绑定 customer），enroll 时裸机 hostname 自动登记为新 server；运营方在服务器列表看到上线后再 provision。
- central 部署路由范式：`app/api/admin/servers/[id]/deploy/route.ts`——requireAdmin → 校验 server/config → isOnline → createJob → sendToServer → writeAuditLog → 202 { jobId, streamUrl }。provision 路由照此范式。body 现状 `{ configId?, mode='nginx', envVars? }`，configId 缺省取最新 published。
- agent executor：`agent/src/executor.ts` Command union + switch 分发；deploy 分支动态 import handleDeploy，签名 `(cmd, dataDir, hooks, composeRunner, signal, opts?)`。
- agent 配置：`agent/src/config.ts` `loadConfig()` 返回 `{ centralWsUrl, centralApiUrl, serverId, agentToken }`——bundle 下载用它取 token 和 API base。
- agent compose/健康检查：`agent/src/lib/compose.ts` `runCompose(args, {cwd,signal}, hooks)`、`agent/src/lib/healthcheck.ts` `waitForServicesHealthy(services, opts)`。
- agent enroll：`agent/src/register.ts` `performEnrollment({ centralApiUrl, enrollmentCode, hostname, ... })` → POST /api/agent/enroll → 写 agent.env。
- 现有 `agent/src/lib/git-pull.ts` 仅被 deploy.ts 使用，本计划删除。
- `scripts/agent-compose.yml` 已存在（裸机起 agent 的 compose 模板），引导脚本直接引用。
- central/agent 单元测试都在各自 `__tests__/`，vitest；central API 测试是真实 DB 集成风格（见上），agent 测试是注入依赖风格（见 `agent/__tests__/deploy.test.ts`）。
- 环境变量约定：central 侧新增 `CENTRAL_CODE_REPO`（central 主机上的代码仓库路径，git archive 来源）、`CENTRAL_BUNDLE_DIR`（默认 `<central>/data/bundles`）。

## 文件结构

central：
- 修改：`central/db/schema.sql`（追加 bundles 表——migrate.ts 只执行此文件）
- 创建：`central/lib/bundles.ts` — buildBundle/bundlePath（exec/stat/query 注入可测）
- 创建：`central/app/api/admin/bundles/route.ts` — GET 列表 / POST 构建
- 创建：`central/app/api/agent/bundles/[id]/download/route.ts` — token 鉴权流式下载
- 创建：`central/app/api/admin/servers/[id]/provision/route.ts` — 下发 command:provision
- 创建：`central/app/api/admin/customers/[id]/bootstrap-script/route.ts` — 按客户生成开通引导脚本（enroll 自动登记 server，故挂 customer 维度）
- 修改：`central/app/api/admin/servers/[id]/deploy/route.ts` — 解析 bundle 并注入 bundleUrl
- 修改：`central/app/(dashboard)/servers/[id]/page.tsx` — 加「一键开通」按钮（部署按钮已有）
- 修改：`central/app/(dashboard)/customers/[id]/page.tsx` — 加「下载开通脚本」按钮
- 创建：`central/app/(dashboard)/bundles/page.tsx` — 发布包列表+构建按钮；`central/app/(dashboard)/layout.tsx` 加入口
- 测试：`central/__tests__/bundles-lib.test.ts`（lib 纯函数）、`central/__tests__/api-bundles.test.ts`（路由集成）、`central/__tests__/api-provision.test.ts`（provision/deploy/bootstrap-script 路由集成）

agent：
- 创建：`agent/src/lib/bundle.ts` — downloadBundle/extractBundle/syncBundleToDir
- 修改：`agent/src/commands/deploy.ts` — git pull 步骤替换为 bundle 同步
- 删除：`agent/src/lib/git-pull.ts`（唯一使用者 deploy.ts 已改造）
- 创建：`agent/src/commands/provision.ts` — 从零开通编排
- 修改：`agent/src/executor.ts` — Command union + provision 分支 + deploy 注入 bundleUrl
- 测试：`agent/__tests__/bundle.test.ts`、`agent/__tests__/provision.test.ts`；修改：`agent/__tests__/deploy.test.ts`

---

### 任务 1：bundles 表 + central/lib/bundles.ts

**文件：**
- 修改：`central/db/schema.sql`（文件末尾追加 bundles 表）
- 创建：`central/lib/bundles.ts`
- 测试：`central/__tests__/bundles-lib.test.ts`（lib 纯函数注入测试，不做路由）

- [ ] **步骤 1：编写失败的测试**

创建 `central/__tests__/bundles-lib.test.ts`：

```typescript
import { describe, it, expect, vi } from 'vitest';
import { buildBundle } from '@/lib/bundles';

describe('bundles.buildBundle', () => {
  it('git fetch + git archive 产出 tar.gz，记录 ready 与大小', async () => {
    const execCalls: string[][] = [];
    const execImpl = vi.fn(async (cmd: string, args: string[]) => {
      execCalls.push([cmd, ...args]);
      return { stdout: '', stderr: '' };
    });
    const statImpl = vi.fn(async () => ({ size: 123456 }));
    const queryImpl = vi.fn(async () => ({ rows: [], rowCount: 1 }));

    const result = await buildBundle(
      { id: 'b-1', ref: 'main' },
      { repoPath: '/srv/repo', bundleDir: '/srv/bundles', execImpl, statImpl, queryImpl }
    );

    expect(execCalls[0]).toEqual(['git', '-C', '/srv/repo', 'fetch', '--all', '--tags', '--prune']);
    expect(execCalls[1]).toEqual([
      'git', '-C', '/srv/repo', 'archive', '--format=tar.gz',
      '-o', '/srv/bundles/b-1.tar.gz', 'main',
    ]);
    expect(queryImpl).toHaveBeenCalledWith(
      expect.stringContaining("status='ready'"),
      expect.arrayContaining([123456, 'b-1'])
    );
    expect(result).toEqual({ id: 'b-1', path: '/srv/bundles/b-1.tar.gz', sizeBytes: 123456 });
  });

  it('git archive 失败 → 记录 failed + error，抛错', async () => {
    const execImpl = vi.fn()
      .mockResolvedValueOnce({ stdout: '', stderr: '' }) // fetch ok
      .mockRejectedValueOnce(new Error('fatal: Not a valid object name'));
    const queryImpl = vi.fn(async () => ({ rows: [], rowCount: 1 }));

    await expect(
      buildBundle(
        { id: 'b-2', ref: 'no-such-ref' },
        { repoPath: '/srv/repo', bundleDir: '/srv/bundles', execImpl, statImpl: vi.fn(), queryImpl }
      )
    ).rejects.toThrow('Not a valid object name');

    expect(queryImpl).toHaveBeenCalledWith(
      expect.stringContaining("status='failed'"),
      expect.arrayContaining(['fatal: Not a valid object name', 'b-2'])
    );
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd central && npx vitest run __tests__/bundles-lib.test.ts`
预期：FAIL——`@/lib/bundles` 不存在。

- [ ] **步骤 3：实现 schema + lib**

`central/db/schema.sql` 末尾追加（migrate.ts 只执行此文件，全量 `IF NOT EXISTS` 幂等）：

```sql
CREATE TABLE IF NOT EXISTS bundles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ref         TEXT NOT NULL,
  filename    TEXT NOT NULL,
  size_bytes  BIGINT,
  status      TEXT NOT NULL DEFAULT 'building',  -- building|ready|failed
  error       TEXT,
  created_by  UUID REFERENCES admin_users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bundles_created ON bundles(created_at DESC);
```

创建 `central/lib/bundles.ts`：

```typescript
import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { query } from './db';

const REPO_PATH = process.env.CENTRAL_CODE_REPO ?? '/opt/central-code-repo';
const BUNDLE_DIR = process.env.CENTRAL_BUNDLE_DIR ?? path.join(process.cwd(), 'data', 'bundles');

export interface BundleDeps {
  repoPath?: string;
  bundleDir?: string;
  execImpl?: (cmd: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
  statImpl?: (p: string) => Promise<{ size: number }>;
  queryImpl?: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>;
}

const defaultExec = (cmd: string, args: string[]) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) =>
      err ? reject(Object.assign(err, { stderr })) : resolve({ stdout, stderr })
    );
  });

export async function buildBundle(
  bundle: { id: string; ref: string },
  deps: BundleDeps = {}
): Promise<{ id: string; path: string; sizeBytes: number }> {
  const repoPath = deps.repoPath ?? REPO_PATH;
  const bundleDir = deps.bundleDir ?? BUNDLE_DIR;
  const execImpl = deps.execImpl ?? defaultExec;
  const statImpl = deps.statImpl ?? stat;
  const queryImpl = deps.queryImpl ?? query;

  await mkdir(bundleDir, { recursive: true });
  const filePath = path.join(bundleDir, `${bundle.id}.tar.gz`);

  try {
    await execImpl('git', ['-C', repoPath, 'fetch', '--all', '--tags', '--prune']);
    await execImpl('git', ['-C', repoPath, 'archive', '--format=tar.gz', '-o', filePath, bundle.ref]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await queryImpl(`UPDATE bundles SET status='failed', error=$1 WHERE id=$2`, [message, bundle.id]);
    throw err;
  }

  const { size } = await statImpl(filePath);
  await queryImpl(`UPDATE bundles SET status='ready', size_bytes=$1 WHERE id=$2`, [size, bundle.id]);
  return { id: bundle.id, path: filePath, sizeBytes: size };
}

export function bundlePath(id: string, deps: BundleDeps = {}): string {
  return path.join(deps.bundleDir ?? BUNDLE_DIR, `${id}.tar.gz`);
}
```

- [ ] **步骤 4：运行测试 + 应用迁移**

运行：`cd central && npx vitest run __tests__/bundles-lib.test.ts`
预期：2/2 PASS。
然后应用迁移：`cd central && npx tsx db/migrate.ts`（幂等），验证：`psql $DATABASE_URL -c '\d bundles'` 表存在。

- [ ] **步骤 5：Commit**

```bash
git add central/db/schema.sql central/lib/bundles.ts central/__tests__/bundles-lib.test.ts
git commit -m "feat(central): bundles 表与发布包构建（git archive 去 GitHub 运行时依赖）"
```

---

### 任务 2：bundles API（admin 构建/列表 + agent 下载）

**文件：**
- 创建：`central/app/api/admin/bundles/route.ts`
- 创建：`central/app/api/agent/bundles/[id]/download/route.ts`
- 测试：`central/__tests__/api-bundles.test.ts`（新建，真实 DB 集成风格）

- [ ] **步骤 1：编写失败的测试**

创建 `central/__tests__/api-bundles.test.ts`（真实 PG + fetch 集成风格，对齐 `api-servers.test.ts`；`buildBundle` 涉及真实 git archive，用 vi.hoisted + vi.mock factory 替换——先例 `deploy-flow.test.ts` mock `execa`）：

```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// buildBundle 会真实执行 git archive（依赖 CENTRAL_CODE_REPO），路由测试用 mock 替换。
// 注意 vi.mock 是文件级：本文件只测路由；buildBundle 本身的注入测试在 bundles-lib.test.ts。
const { buildBundleMock } = vi.hoisted(() => ({ buildBundleMock: vi.fn() }));
vi.mock('@/lib/bundles', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/bundles')>();
  return { ...original, buildBundle: buildBundleMock };
});

import { pool } from '@/lib/db';
import { hashPassword, signJwt } from '@/lib/auth';
import { generateAgentToken } from '@/lib/agent-auth';

const BASE = 'http://localhost:3000';
let adminToken: string;
let serverId: string;
let agentToken: string;
let bundleDir: string;

beforeAll(async () => {
  const hash = await hashPassword('Test123!');
  const u = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('bundle@x.local',$1,'admin') RETURNING id`,
    [hash]
  );
  adminToken = await signJwt({ sub: u.rows[0].id, email: 'bundle@x.local', role: 'admin' });
  const c = await pool.query(`INSERT INTO customers (name) VALUES ('Bundle测试') RETURNING id`);
  const s = await pool.query(
    `INSERT INTO customer_servers (customer_id, hostname) VALUES ($1,'bundle-srv') RETURNING id`,
    [c.rows[0].id]
  );
  serverId = s.rows[0].id;
  agentToken = await generateAgentToken(serverId);
  bundleDir = mkdtempSync(path.join(tmpdir(), 'bundles-test-'));
  process.env.CENTRAL_BUNDLE_DIR = bundleDir;
});

afterAll(async () => {
  await pool.query(
    `TRUNCATE TABLE audit_logs, job_logs, deploy_jobs, agent_tokens, customer_servers, enrollment_codes, customer_configs, customers, admin_users, bundles CASCADE;`
  );
  await pool.end();
  rmSync(bundleDir, { recursive: true, force: true });
});

describe('POST /api/admin/bundles', () => {
  it('创建记录 → buildBundle 标 ready → 201 返回 ready 记录', async () => {
    // mock 模拟真实 buildBundle 的 DB 副作用（status building→ready）
    buildBundleMock.mockImplementation(async ({ id }: { id: string }) => {
      await pool.query(`UPDATE bundles SET status='ready', size_bytes=123456 WHERE id=$1`, [id]);
      return { id, path: `${bundleDir}/${id}.tar.gz`, sizeBytes: 123456 };
    });
    const res = await fetch(`${BASE}/api/admin/bundles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ ref: 'main' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.bundle.ref).toBe('main');
    expect(body.bundle.status).toBe('ready');
    expect(body.bundle.size_bytes).toBe(123456);
    expect(buildBundleMock).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'main' })
    );
  });

  it('ref 缺失 → 400', async () => {
    const res = await fetch(`${BASE}/api/admin/bundles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('buildBundle 抛错 → 500（failed 状态由 lib 内部落库，路由只透传错误）', async () => {
    buildBundleMock.mockRejectedValueOnce(new Error('fatal: Not a valid object name'));
    const res = await fetch(`${BASE}/api/admin/bundles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ ref: 'no-such-ref' }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Not a valid object name');
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
    writeFileSync(path.join(bundleDir, `${id}.tar.gz`), fileBytes);
    const res = await fetch(`${BASE}/api/agent/bundles/${id}/download`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-length')).toBe(String(fileBytes.length));
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.equals(fileBytes)).toBe(true);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd central && npx vitest run __tests__/api-bundles.test.ts`（需 dev server + 已迁移 DB）
预期：FAIL——两个路由均不存在（404）。

- [ ] **步骤 3：实现路由**

创建 `central/app/api/admin/bundles/route.ts`：

```typescript
import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { buildBundle } from '@/lib/bundles';
import { writeAuditLog } from '@/lib/audit';

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const result = await query(
    `SELECT id, ref, size_bytes, status, error, created_at FROM bundles ORDER BY created_at DESC LIMIT 50`
  );
  return json({ bundles: result.rows });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const body = await req.json().catch(() => ({}));
  const ref = typeof body.ref === 'string' && body.ref.trim();
  if (!ref) return errorResponse('ref is required (branch/tag/commit)', 400);

  const inserted = await query(
    `INSERT INTO bundles (ref, filename, created_by) VALUES ($1, $2, $3) RETURNING id`,
    [ref, '', admin.sub]
  );
  const id = (inserted.rows[0] as { id: string }).id;

  try {
    await buildBundle({ id, ref });
  } catch (err) {
    return errorResponse(`bundle build failed: ${err instanceof Error ? err.message : err}`, 500);
  }

  await writeAuditLog({
    adminId: admin.sub,
    action: 'bundle:build',
    targetType: 'bundle',
    targetId: id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: req.headers.get('user-agent') ?? undefined,
    detail: { ref },
  });

  const row = await query(`SELECT id, ref, size_bytes, status, created_at FROM bundles WHERE id=$1`, [id]);
  return json({ bundle: row.rows[0] }, 201);
}
```

创建 `central/app/api/agent/bundles/[id]/download/route.ts`：

```typescript
import { NextRequest } from 'next/server';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { query } from '@/lib/db';
import { verifyAgentToken } from '@/lib/agent-auth';
import { bundlePath } from '@/lib/bundles';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return Response.json({ error: 'missing token' }, { status: 401 });

  const server = await verifyAgentToken(token);
  if (!server) return Response.json({ error: 'invalid token' }, { status: 401 });

  const result = await query(`SELECT status FROM bundles WHERE id=$1`, [params.id]);
  if (result.rows.length === 0) return Response.json({ error: 'bundle not found' }, { status: 404 });
  const bundle = result.rows[0] as { status: string };
  if (bundle.status !== 'ready') {
    return Response.json({ error: `bundle not ready (status=${bundle.status})` }, { status: 409 });
  }

  const filePath = bundlePath(params.id);
  if (!existsSync(filePath)) {
    return Response.json({ error: 'bundle file missing on disk' }, { status: 410 });
  }

  const { size } = statSync(filePath);
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, {
    headers: {
      'content-type': 'application/gzip',
      'content-length': String(size),
      'content-disposition': `attachment; filename="${params.id}.tar.gz"`,
    },
  });
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd central && npx vitest run __tests__/api-bundles.test.ts`
预期：全部 PASS。

- [ ] **步骤 5：Commit**

```bash
git add central/app/api/admin/bundles/route.ts central/app/api/agent/bundles central/__tests__/api-bundles.test.ts
git commit -m "feat(central): bundles API——admin 构建/列表，agent token 鉴权下载"
```

---

### 任务 3：agent lib/bundle.ts——下载/解压/同步

**文件：**
- 创建：`agent/src/lib/bundle.ts`
- 测试：`agent/__tests__/bundle.test.ts`

- [ ] **步骤 1：编写失败的测试**

创建 `agent/__tests__/bundle.test.ts`：

```typescript
import { describe, it, expect, vi } from 'vitest';
import { downloadBundle, syncBundleToDir } from '../src/lib/bundle';

describe('bundle.downloadBundle', () => {
  it('带 Bearer token 下载，写入目标文件，返回字节数', async () => {
    const written: string[] = [];
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(c) { c.enqueue(new Uint8Array([1, 2, 3])); c.close(); },
      }),
    }));
    const writeImpl = vi.fn(async (file: string, chunk: Uint8Array) => { written.push(file); });

    const size = await downloadBundle(
      { url: 'https://central.example.com/api/agent/bundles/b-1/download', token: 'tok', destFile: '/tmp/x.tar.gz' },
      { fetchImpl: fetchImpl as any, writeImpl }
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://central.example.com/api/agent/bundles/b-1/download',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) })
    );
    expect(size).toBe(3);
    expect(written).toEqual(['/tmp/x.tar.gz']);
  });

  it('HTTP 401/409 → 抛带状态码的错', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 409, body: null }));
    await expect(
      downloadBundle(
        { url: 'http://x/b', token: 'tok', destFile: '/tmp/x' },
        { fetchImpl: fetchImpl as any, writeImpl: vi.fn() }
      )
    ).rejects.toThrow('409');
  });
});

describe('bundle.syncBundleToDir', () => {
  it('下载→解压到临时目录→rsync -a --delete 同步（排除 .env/uploads）', async () => {
    const calls: string[][] = [];
    const execImpl = vi.fn(async (cmd: string, args: string[]) => { calls.push([cmd, ...args]); });
    const downloadImpl = vi.fn(async () => 100);

    await syncBundleToDir(
      { url: 'http://x/b', token: 'tok', dataDir: '/opt/site' },
      { downloadImpl, execImpl }
    );

    const tarCall = calls.find((c) => c[0] === 'tar');
    expect(tarCall).toBeTruthy();
    const rsyncCall = calls.find((c) => c[0] === 'rsync');
    expect(rsyncCall).toBeTruthy();
    expect(rsyncCall).toContain('--delete');
    expect(rsyncCall).toContain('--exclude');
    expect(rsyncCall!.join(' ')).toContain('.env');
    expect(rsyncCall!.join(' ')).toContain('backend/public/uploads/');
    expect(rsyncCall![rsyncCall!.length - 1]).toBe('/opt/site/');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd agent && npx vitest run __tests__/bundle.test.ts`
预期：FAIL——模块不存在。

- [ ] **步骤 3：实现 bundle.ts**

创建 `agent/src/lib/bundle.ts`：

```typescript
import { execFile } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { open } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export interface BundleDeps {
  fetchImpl?: typeof fetch;
  writeImpl?: (file: string, chunk: Uint8Array) => Promise<void>;
  execImpl?: (cmd: string, args: string[]) => Promise<void>;
  downloadImpl?: typeof downloadBundle;
  tmpDir?: string;
}

const defaultExec = (cmd: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    execFile(cmd, args, (err, _stdout, stderr) =>
      err ? reject(new Error(`${cmd} failed: ${stderr || err.message}`)) : resolve()
    );
  });

/** 下载发布包到本地文件（流式，带 agent token 鉴权） */
export async function downloadBundle(
  opts: { url: string; token: string; destFile: string },
  deps: BundleDeps = {}
): Promise<number> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const res = await fetchImpl(opts.url, {
    headers: { Authorization: `Bearer ${opts.token}` },
  });
  if (!res.ok || !res.body) {
    throw new Error(`bundle download failed: HTTP ${res.status}`);
  }

  let size = 0;
  if (deps.writeImpl) {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      await deps.writeImpl(opts.destFile, value);
    }
    return size;
  }

  // 生产路径：流式写盘
  mkdirSync(path.dirname(opts.destFile), { recursive: true });
  const fh = await open(opts.destFile, 'w');
  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      await fh.write(value);
    }
  } finally {
    await fh.close();
  }
  return size;
}

/**
 * 发布包同步到部署目录（rsync --delete 语义，防陈旧文件）。
 * 排除：.env（实例配置）、backend/public/uploads/（实例媒体库）——代码分发绝不覆盖实例数据。
 */
export async function syncBundleToDir(
  opts: { url: string; token: string; dataDir: string },
  deps: BundleDeps = {}
): Promise<void> {
  const execImpl = deps.execImpl ?? defaultExec;
  const tmp = deps.tmpDir ?? path.join(os.tmpdir(), `bundle-${Date.now()}`);
  const tarFile = path.join(tmp, 'release.tar.gz');
  const extractDir = path.join(tmp, 'extract');

  const downloadImpl = deps.downloadImpl ?? ((o: { url: string; token: string; destFile: string }) =>
    downloadBundle(o, { fetchImpl: deps.fetchImpl }));

  mkdirSync(extractDir, { recursive: true });
  await downloadImpl({ url: opts.url, token: opts.token, destFile: tarFile });
  await execImpl('tar', ['-xzf', tarFile, '-C', extractDir]);
  // git archive 根目录无包裹层，直接同步内容
  await execImpl('rsync', [
    '-a', '--delete',
    '--exclude', '.env',
    '--exclude', 'backend/public/uploads/',
    '--exclude', 'node_modules/',
    `${extractDir}/`,
    `${opts.dataDir}/`,
  ]);
  await execImpl('rm', ['-rf', tmp]);
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd agent && npx vitest run __tests__/bundle.test.ts`
预期：3/3 PASS。

- [ ] **步骤 5：Commit**

```bash
git add agent/src/lib/bundle.ts agent/__tests__/bundle.test.ts
git commit -m "feat(agent): 发布包下载/解压/rsync 同步（排除实例 .env 与 uploads）"
```

---

### 任务 4：deploy 命令改造（git pull → bundle）+ provision 命令

**文件：**
- 修改：`agent/src/commands/deploy.ts:71-77`（git pull 步骤替换）
- 删除：`agent/src/lib/git-pull.ts`
- 创建：`agent/src/commands/provision.ts`
- 修改：`agent/src/executor.ts:15-21,49-69`（Command union + 分支）
- 测试：`agent/__tests__/provision.test.ts`（新建）、`agent/__tests__/deploy.test.ts`（改造）

- [ ] **步骤 1：编写失败的测试（provision + deploy 新行为）**

创建 `agent/__tests__/provision.test.ts`：

```typescript
import { describe, it, expect, vi } from 'vitest';
import { handleProvision } from '../src/commands/provision';

function makeDeps() {
  return {
    syncBundle: vi.fn(async () => {}),
    writeEnv: vi.fn(),
    runCompose: vi.fn(async () => ({ exitCode: 0 })),
    waitHealthy: vi.fn(async () => ({ ok: true })),
    agentToken: 'tok',
  };
}

const baseCmd = {
  type: 'command:provision' as const,
  commandId: 'c1',
  jobId: 'j1',
  bundleUrl: '/api/agent/bundles/b-1/download',
  centralApiUrl: 'http://central:3100',
  envVars: { APP_KEYS: 'k', JWT_SECRET: 'j' },
  mode: 'direct' as const,
};

describe('provision 从零开通编排', () => {
  it('顺序：写 env → 同步 bundle → compose up --build → 健康检查 → KB resync', async () => {
    const deps = makeDeps();
    const hooks = { onLog: vi.fn(), onProgress: vi.fn() };
    const order: string[] = [];
    deps.writeEnv.mockImplementation(() => { order.push('env'); });
    deps.syncBundle.mockImplementation(async () => { order.push('bundle'); });
    deps.runCompose.mockImplementation(async (args: string[]) => {
      order.push(args.includes('exec') ? 'kb-resync' : 'compose-up');
      return { exitCode: 0 };
    });
    deps.waitHealthy.mockImplementation(async () => { order.push('health'); return { ok: true }; });

    const result = await handleProvision(baseCmd, '/data', hooks, new AbortController().signal, deps);

    expect(order).toEqual(['env', 'bundle', 'compose-up', 'health', 'kb-resync']);
    expect(deps.syncBundle).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://central:3100/api/agent/bundles/b-1/download', token: 'tok', dataDir: '/data' })
    );
    expect(result.success).toBe(true);
  });

  it('健康检查失败 → success:false，不跑 KB resync', async () => {
    const deps = makeDeps();
    deps.waitHealthy.mockResolvedValue({ ok: false, failedService: 'backend' });
    const hooks = { onLog: vi.fn(), onProgress: vi.fn() };

    const result = await handleProvision(baseCmd, '/data', hooks, new AbortController().signal, deps);

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('backend');
    const execCalls = deps.runCompose.mock.calls.filter((c) => c[0].includes('exec'));
    expect(execCalls.length).toBe(0);
  });

  it('KB resync 失败只告警不致命（内容 CRUD 会补派生）', async () => {
    const deps = makeDeps();
    deps.runCompose.mockImplementation(async (args: string[]) => ({
      exitCode: args.includes('exec') ? 1 : 0,
    }));
    const hooks = { onLog: vi.fn(), onProgress: vi.fn() };

    const result = await handleProvision(baseCmd, '/data', hooks, new AbortController().signal, deps);
    expect(result.success).toBe(true);
    expect(hooks.onLog).toHaveBeenCalledWith('stderr', expect.stringContaining('KB resync'));
  });
});
```

`agent/__tests__/deploy.test.ts` 改造：把所有用例中「git pull」相关 mock/断言（`pullLatest` mock）替换为 bundle 同步：mock `syncBundle`（注入方式与 provision 相同的 deps 参数），断言「bundleUrl 缺失时返回 success:false 且 stderr 含 bundleUrl」。逐个用例对齐新签名 `handleDeploy(cmd, dataDir, hooks, composeRunner, signal, opts)`，其中 `opts.syncBundle`、`opts.agentToken` 注入 mock。

- [ ] **步骤 2：运行测试验证失败**

运行：`cd agent && npx vitest run __tests__/provision.test.ts __tests__/deploy.test.ts`
预期：FAIL——`commands/provision` 不存在；deploy 旧实现仍走 git pull。

- [ ] **步骤 3：实现**

**修改 `agent/src/commands/deploy.ts`：**

① `DeployCommand` 接口加字段：

```typescript
export interface DeployCommand {
  commandId: string;
  type: 'command:deploy';
  jobId: string;
  imageTag: string;              // 保留字段，本期忽略
  bundleUrl?: string;            // 相对路径（/api/agent/bundles/<id>/download）
  centralApiUrl?: string;        // bundle 下载 base；缺省从 agent config 取
  envVars?: Record<string, string>;
  mode: 'nginx' | 'direct';
}
```

② `DeployOptions` 加注入点：

```typescript
export interface DeployOptions {
  healthcheckIntervalMs?: number;
  healthcheckMaxAttempts?: number;
  syncBundle?: (opts: { url: string; token: string; dataDir: string }) => Promise<void>;
  agentToken?: string;
  centralApiUrl?: string;
}
```

③ 删除文件顶部 `import { pullLatest } from '../lib/git-pull';`，步骤 2（原第 71-77 行 git pull 块）替换为：

```typescript
  // 步骤 2：发布包同步（替代 git pull，去 GitHub 依赖）
  if (!cmd.bundleUrl) {
    return { success: false, stderr: 'bundleUrl is required (deploy pipeline is bundle-based)', durationMs: Date.now() - start };
  }
  hooks.onProgress('bundle-sync', 'downloading and syncing release bundle');
  try {
    const { syncBundleToDir } = await import('../lib/bundle');
    const sync = opts.syncBundle ?? syncBundleToDir;
    const token = opts.agentToken ?? (await import('../config')).loadConfig().agentToken;
    const apiBase = cmd.centralApiUrl ?? opts.centralApiUrl ?? (await import('../config')).loadConfig().centralApiUrl;
    await sync({ url: `${apiBase}${cmd.bundleUrl}`, token, dataDir });
    hooks.onProgress('bundle-synced', 'release bundle synced');
  } catch (err: any) {
    return { success: false, stderr: `bundle sync failed: ${err.message}`, durationMs: Date.now() - start };
  }
```

④ 删除 `agent/src/lib/git-pull.ts`（`git ls-files` 确认无其他引用后）。

**创建 `agent/src/commands/provision.ts`：**

```typescript
import type { ComposeHooks } from '../lib/compose';

export interface ProvisionCommand {
  type: 'command:provision';
  commandId: string;
  jobId: string;
  bundleUrl: string;             // 相对路径
  centralApiUrl: string;
  envVars: Record<string, string>;
  mode: 'nginx' | 'direct';
  postSyncKb?: boolean;          // 默认 true
}

export interface ProvisionDeps {
  syncBundle: (opts: { url: string; token: string; dataDir: string }) => Promise<void>;
  writeEnv: (envPath: string, vars: Record<string, string>) => void;
  runCompose: (args: string[], opts: { cwd: string; signal?: AbortSignal }, hooks: ComposeHooks) => Promise<{ exitCode: number }>;
  waitHealthy: (services: string[], opts: { cwd: string; onProgress?: (i: unknown) => void }) => Promise<{ ok: boolean; failedService?: string }>;
  agentToken: string;
}

export interface ProvisionResult {
  success: boolean;
  stderr?: string;
  durationMs: number;
}

const SERVICES_NGINX = ['postgres', 'redis', 'meilisearch', 'backend', 'frontend', 'nginx'];
const SERVICES_DIRECT = ['postgres', 'redis', 'meilisearch', 'backend', 'frontend'];

/**
 * 从零开通编排：env → bundle → compose up --build → 健康检查 → KB 初始化。
 * 幂等可重跑：env 覆盖写、bundle rsync --delete、compose up 幂等。
 */
export async function handleProvision(
  cmd: ProvisionCommand,
  dataDir: string,
  hooks: { onLog: (s: 'stdout' | 'stderr', l: string) => void; onProgress: (stage: string, msg: string) => void },
  signal: AbortSignal,
  deps: ProvisionDeps
): Promise<ProvisionResult> {
  const start = Date.now();
  const composeHooks: ComposeHooks = { onLog: hooks.onLog };

  // 1. 写 .env（central 下发的完整配置，含随机生成的密钥）
  hooks.onProgress('env', 'writing .env from central config');
  deps.writeEnv(`${dataDir}/.env`, cmd.envVars);

  // 2. 发布包同步
  hooks.onProgress('bundle', 'downloading and syncing release bundle');
  await deps.syncBundle({ url: `${cmd.centralApiUrl}${cmd.bundleUrl}`, token: deps.agentToken, dataDir });

  // 3. compose up --build
  hooks.onProgress('build', 'building and starting containers');
  const upArgs = cmd.mode === 'nginx'
    ? ['-f', 'docker-compose.yml', '-f', 'docker-compose.nginx.yml', 'up', '-d', '--build']
    : ['up', '-d', '--build'];
  const up = await deps.runCompose(upArgs, { cwd: dataDir, signal }, composeHooks);
  if (up.exitCode !== 0) {
    return { success: false, stderr: 'docker compose up failed', durationMs: Date.now() - start };
  }

  // 4. 健康检查（backend bootstrap 自检自愈会在此阶段建 pgvector/KB 表/索引）
  hooks.onProgress('healthcheck', 'waiting for healthchecks');
  const services = cmd.mode === 'nginx' ? SERVICES_NGINX : SERVICES_DIRECT;
  const health = await deps.waitHealthy(services, {
    cwd: dataDir,
    onProgress: (info: any) => hooks.onLog('stdout', `[healthcheck] ${info.service} attempt=${info.attempt} healthy=${info.healthy}`),
  });
  if (!health.ok) {
    return { success: false, stderr: `healthcheck failed for service: ${health.failedService}`, durationMs: Date.now() - start };
  }

  // 5. KB 初始化（由本实例种子内容派生；失败不致命，后续内容 CRUD 会补派生）
  if (cmd.postSyncKb !== false) {
    hooks.onProgress('kb-sync', 'initializing knowledge base from instance content');
    const kb = await deps.runCompose(
      ['exec', '-T', 'backend', 'npx', 'tsx', 'scripts/resync-knowledge-base.ts'],
      { cwd: dataDir, signal },
      composeHooks
    );
    if (kb.exitCode !== 0) {
      hooks.onLog('stderr', 'KB resync failed (non-fatal): 可在内容发布后自动补派生，或手动重跑');
    }
  }

  return { success: true, durationMs: Date.now() - start };
}
```

**修改 `agent/src/executor.ts`：**

① Command union 加：

```typescript
  | { type: 'command:provision'; commandId: string; jobId?: string; bundleUrl: string; centralApiUrl: string; envVars: Record<string, string>; mode?: 'nginx' | 'direct'; postSyncKb?: boolean }
```

deploy 项改为：

```typescript
  | { type: 'command:deploy'; commandId: string; jobId?: string; imageTag?: string; bundleUrl?: string; centralApiUrl?: string; envVars?: Record<string, string>; mode?: 'nginx' | 'direct' }
```

② switch 中 deploy 分支的 handleDeploy 调用改为传 opts（token 从 config 取）：

```typescript
      case 'command:deploy': {
        const { handleDeploy } = await import('./commands/deploy');
        const { loadConfig } = await import('./config');
        const cfg = loadConfig();
        const deployResult = await handleDeploy(
          cmd as any,
          DATA_DIR,
          hooks,
          {
            runCompose: async (args, opts, composeHooks) => {
              const r = await runCompose(args, opts, composeHooks);
              return { exitCode: r.exitCode };
            },
          },
          controller.signal,
          { agentToken: cfg.agentToken, centralApiUrl: cfg.centralApiUrl }
        );
        if (!deployResult.success) {
          throw Object.assign(new Error(deployResult.stderr ?? 'deploy failed'), {
            exitCode: deployResult.exitCode ?? 1,
          });
        }
        return `deploy completed in ${deployResult.durationMs}ms`;
      }

      case 'command:provision': {
        const { handleProvision } = await import('./commands/provision');
        const { syncEnvFile } = await import('./lib/env-file');
        const { syncBundleToDir } = await import('./lib/bundle');
        const { waitForServicesHealthy } = await import('./lib/healthcheck');
        const { loadConfig } = await import('./config');
        const cfg = loadConfig();
        const result = await handleProvision(
          { ...cmd, mode: cmd.mode ?? 'direct' },
          DATA_DIR,
          hooks,
          controller.signal,
          {
            syncBundle: syncBundleToDir,
            writeEnv: syncEnvFile,
            runCompose: async (args, opts, composeHooks) => {
              const r = await runCompose(args, opts, composeHooks);
              return { exitCode: r.exitCode };
            },
            waitHealthy: (services, o) =>
              waitForServicesHealthy(services, { cwd: o.cwd, intervalMs: 5000, maxAttempts: 24, onProgress: o.onProgress }),
            agentToken: cfg.agentToken,
          }
        );
        if (!result.success) {
          throw Object.assign(new Error(result.stderr ?? 'provision failed'), { exitCode: 1 });
        }
        return `provision completed in ${result.durationMs}ms`;
      }
```

③ 确认 `syncEnvFile`（agent/src/lib/env-file.ts）语义是「合并写」还是「覆盖写」——provision 需要**覆盖写**完整 .env。若 syncEnvFile 是合并写（从 config-sync 的用途看是写全量键值），provision 场景目标机无 .env，两者等价；若已有 .env，合并写会残留旧键——这是可接受行为（实例专属键不被清掉），不改 env-file.ts。

- [ ] **步骤 4：运行测试验证通过**

运行：`cd agent && npx vitest run`
预期：全部 PASS（含改造后的 deploy.test.ts、executor.test.ts 不回归——executor.test.ts 的 deploy 用例若 mock 了旧签名需同步更新）。

- [ ] **步骤 5：Commit**

```bash
git add agent/src/commands/deploy.ts agent/src/commands/provision.ts agent/src/executor.ts agent/__tests__/
git rm agent/src/lib/git-pull.ts
git commit -m "feat(agent): deploy 切换发布包模式（弃 git pull），新增 provision 从零开通编排"
```

---

### 任务 5：central provision 路由 + deploy 路由注入 bundle + 开通引导脚本

**文件：**
- 创建：`central/app/api/admin/servers/[id]/provision/route.ts`
- 修改：`central/app/api/admin/servers/[id]/deploy/route.ts`
- 创建：`central/app/api/admin/customers/[id]/bootstrap-script/route.ts`（customer 维度：裸机尚无 server 记录，enroll 时才自动登记）
- 测试：`central/__tests__/api-provision.test.ts`（新建，对齐现有 api-*.test.ts 命名习惯）

- [ ] **步骤 1：编写失败的测试**

创建 `central/__tests__/api-provision.test.ts`（mock 模式对齐 `api-servers.test.ts`/`deploy-flow.test.ts`）：

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('POST /api/admin/servers/[id]/deploy（bundle 注入）', () => {
  it('有 ready bundle → command 含 bundleUrl 与 bundleId', async () => {
    // mock query：server 存在、config 已发布、latest bundle { id:'b-1', status:'ready' }
    // mock isOnline → true；mock sendToServer → true 并捕获 command
    // 期望 command.bundleUrl === '/api/agent/bundles/b-1/download'
  });

  it('无 ready bundle → 400 提示先构建发布包', async () => {
    // bundle 查询返回空 → 400 'Build a bundle first'
  });
});

describe('POST /api/admin/servers/[id]/provision', () => {
  it('生成随机密钥并入 envVars（APP_KEYS 为 4 段逗号拼接），下发 command:provision', async () => {
    // config.env_overrides = { DATABASE_HOST: 'postgres' }
    // 捕获 sendToServer 的 command：
    //   type === 'command:provision'
    //   envVars.APP_KEYS 含 3 个逗号
    //   envVars.JWT_SECRET 长度 >= 32
    //   envVars.DATABASE_HOST === 'postgres'（config 值保留）
    //   bundleUrl 形如 /api/agent/bundles/<id>/download
  });

  it('agent 离线 → 409', async () => {
    // isOnline → false → 409
  });
});

describe('GET /api/admin/customers/[id]/bootstrap-script', () => {
  it('返回 text/plain 脚本：含 enrollment code、enroll URL、bundle 下载 URL、agent 启动段', async () => {
    // mock query：customer 存在；bundle latest ready { id: 'b-1' }
    // mock generateEnrollmentCode → 'CODE123'
    // body 包含：'CODE123'、'/api/agent/enroll'、'/api/agent/bundles/b-1/download'、'docker'、'agent-compose.yml'
    // content-type 含 text/plain
  });

  it('customer 不存在 → 404；无 ready bundle → 409', async () => {});
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd central && npx vitest run __tests__/api-provision.test.ts`
预期：FAIL——provision/bootstrap-script 路由不存在；deploy 路由尚无 bundleUrl。

- [ ] **步骤 3：实现**

**修改 `central/app/api/admin/servers/[id]/deploy/route.ts`：** 在校验 config 之后、createJob 之前插入 bundle 解析：

```typescript
  // 解析发布包（部署管道统一走 bundle；无 ready bundle 拒绝部署）
  let bundleId: string = body.bundleId;
  if (!bundleId) {
    const latest = await query(
      `SELECT id FROM bundles WHERE status='ready' ORDER BY created_at DESC LIMIT 1`
    );
    if (latest.rows.length === 0) {
      return errorResponse('No ready bundle. Build a bundle first (POST /api/admin/bundles).', 400);
    }
    bundleId = (latest.rows[0] as { id: string }).id;
  } else {
    const b = await query(`SELECT id FROM bundles WHERE id=$1 AND status='ready'`, [bundleId]);
    if (b.rows.length === 0) return errorResponse('Bundle not found or not ready', 404);
  }
```

command 对象加两个字段：

```typescript
  const command = {
    commandId: job.id,
    type: 'command:deploy',
    jobId: job.id,
    imageTag: 'unused',
    bundleId,
    bundleUrl: `/api/agent/bundles/${bundleId}/download`,
    envVars: deployEnvVars,
    mode,
  };
```

audit detail 加 `bundleId`。

**创建 `central/app/api/admin/servers/[id]/provision/route.ts`：**

```typescript
import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { createJob, updateJobStatus } from '@/lib/job-manager';
import { sendToServer, isOnline } from '@/lib/connections';
import { writeAuditLog } from '@/lib/audit';

// provision 时自动生成的密钥键名（值不经过人手，central 生成直送 agent）
const GENERATED_SECRET_KEYS = ['JWT_SECRET', 'ADMIN_JWT_SECRET', 'API_TOKEN_SALT', 'TRANSFER_TOKEN_SALT', 'ENCRYPTION_KEY', 'DATABASE_PASSWORD', 'REDIS_PASSWORD', 'MEILI_MASTER_KEY'];

function randomSecret(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const body = await req.json().catch(() => ({}));
  const { configId, bundleId: bodyBundleId, mode = 'nginx' } = body;

  const srv = await query(`SELECT id, customer_id FROM customer_servers WHERE id=$1`, [params.id]);
  if (srv.rows.length === 0) return errorResponse('Server not found', 404);
  const customerId = (srv.rows[0] as { customer_id: string }).customer_id;

  // 配置（env_overrides 为实例差异唯一来源）
  let resolvedConfigId = configId;
  if (!resolvedConfigId) {
    const latest = await query(
      `SELECT id FROM customer_configs WHERE customer_id=$1 AND published_at IS NOT NULL ORDER BY version DESC LIMIT 1`,
      [customerId]
    );
    if (latest.rows.length === 0) return errorResponse('No published config for this customer.', 400);
    resolvedConfigId = (latest.rows[0] as { id: string }).id;
  }
  const cfg = await query(`SELECT env_overrides FROM customer_configs WHERE id=$1`, [resolvedConfigId]);
  const envOverrides = (cfg.rows[0] as { env_overrides: Record<string, string> } | undefined)?.env_overrides ?? {};

  // 发布包
  let bundleId: string = bodyBundleId;
  if (!bundleId) {
    const latest = await query(`SELECT id FROM bundles WHERE status='ready' ORDER BY created_at DESC LIMIT 1`);
    if (latest.rows.length === 0) return errorResponse('No ready bundle. Build a bundle first.', 400);
    bundleId = (latest.rows[0] as { id: string }).id;
  }

  if (!isOnline(params.id)) return errorResponse('Agent is offline.', 409);

  // 组装完整 envVars：config 差异 + 自动密钥（APP_KEYS 特殊：4 段逗号拼接）
  const envVars: Record<string, string> = { ...envOverrides };
  envVars.APP_KEYS = envVars.APP_KEYS ?? [randomSecret(), randomSecret(), randomSecret(), randomSecret()].join(',');
  for (const key of GENERATED_SECRET_KEYS) {
    envVars[key] = envVars[key] ?? randomSecret();
  }

  const job = await createJob({ serverId: params.id, type: 'provision', triggeredBy: admin.sub, configId: resolvedConfigId });

  const command = {
    commandId: job.id,
    type: 'command:provision',
    jobId: job.id,
    bundleId,
    bundleUrl: `/api/agent/bundles/${bundleId}/download`,
    envVars,
    mode,
  };

  const sent = await sendToServer(params.id, command);
  if (!sent) {
    // 与 deploy 路由相同的原子清理策略
    try {
      await updateJobStatus(job.id, 'failed', { errorMessage: 'agent disconnected' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/job not found/.test(msg)) throw err;
      if (/invalid transition/.test(msg)) {
        await updateJobStatus(job.id, 'cancelled', { errorMessage: 'send failed' }).catch(() => {});
      } else throw err;
    }
    return errorResponse('Failed to send provision command', 503);
  }

  await writeAuditLog({
    adminId: admin.sub,
    action: 'job:provision',
    targetType: 'server',
    targetId: params.id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: req.headers.get('user-agent') ?? undefined,
    detail: { jobId: job.id, configId: resolvedConfigId, bundleId, mode },
  });

  return json({ jobId: job.id, status: 'queued', streamUrl: `/api/admin/jobs/${job.id}/stream` }, 202);
}
```

**创建 `central/app/api/admin/customers/[id]/bootstrap-script/route.ts`：**

```typescript
import { NextRequest } from 'next/server';
import { errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { generateEnrollmentCode } from '@/lib/agent-auth';
import { writeAuditLog } from '@/lib/audit';

/**
 * 生成新客户裸机开通引导脚本（一次性 enrollment code，24h 有效）。
 * 挂 customer 维度：裸机尚无 customer_servers 记录——enroll 时路由自动 INSERT 登记
 * （已核实 enroll/route.ts:44-53，同 customer 下 hostname 重复返回 409）。
 * 运营方把脚本拷到裸机执行：装 docker → enroll 拿 token → 下载发布包 → 起 agent。
 * 之后一切（写 env/部署/初始化）由 central provision 命令全自动完成。
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const cust = await query(`SELECT id, name FROM customers WHERE id=$1`, [params.id]);
  if (cust.rows.length === 0) return errorResponse('Customer not found', 404);

  const latest = await query(`SELECT id FROM bundles WHERE status='ready' ORDER BY created_at DESC LIMIT 1`);
  if (latest.rows.length === 0) return errorResponse('No ready bundle. Build a bundle first.', 409);
  const bundleId = (latest.rows[0] as { id: string }).id;

  const code = await generateEnrollmentCode(params.id);
  const centralApiUrl = process.env.CENTRAL_PUBLIC_URL ?? req.nextUrl.origin;

  const script = `#!/usr/bin/env bash
# 客户裸机开通引导脚本（central 生成，enrollment code 24h 一次性有效）
# 用法: sudo bash bootstrap-agent.sh
set -euo pipefail

CENTRAL_API="${centralApiUrl}"
ENROLL_CODE="${code}"
DEPLOY_DIR="/opt/customer-site"
AGENT_ENV_DIR="/etc/yousen-agent"

echo "[1/4] 检查 docker..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
docker compose version >/dev/null 2>&1 || apt-get update -qq && apt-get install -y -qq docker-compose-v2
command -v rsync >/dev/null 2>&1 || apt-get install -y -qq rsync

echo "[2/4] 向 central 注册（enroll）..."
RESP=$(curl -sf -X POST "$CENTRAL_API/api/agent/enroll" \\
  -H 'Content-Type: application/json' \\
  -d "{\\"enrollmentCode\\":\\"$ENROLL_CODE\\",\\"hostname\\":\\"$(hostname)\\"}")
SERVER_ID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["serverId"])')
TOKEN=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["agentToken"])')

echo "[3/4] 下载发布包..."
mkdir -p "$DEPLOY_DIR"
curl -sf -H "Authorization: Bearer $TOKEN" \\
  "$CENTRAL_API/api/agent/bundles/${bundleId}/download" -o /tmp/release.tar.gz
tar -xzf /tmp/release.tar.gz -C "$DEPLOY_DIR"
rm -f /tmp/release.tar.gz

echo "[4/4] 启动 agent..."
mkdir -p "$AGENT_ENV_DIR"
cat > "$AGENT_ENV_DIR/agent.env" <<ENVEOF
CENTRAL_API_URL=$CENTRAL_API
CENTRAL_WS_URL=\${CENTRAL_API/http/ws}/api/agent/ws
SERVER_ID=$SERVER_ID
AGENT_TOKEN=$TOKEN
ENVEOF
chmod 600 "$AGENT_ENV_DIR/agent.env"
cd "$DEPLOY_DIR"
DEPLOY_PATH="$DEPLOY_DIR" CENTRAL_WS_URL="\${CENTRAL_API/http/ws}/api/agent/ws" \\
  envsubst < scripts/agent-compose.yml | docker compose -f - up -d --build

echo "✅ agent 已上线。请回 central 对该服务器执行「一键开通」（provision）完成部署。"
`;

  await writeAuditLog({
    adminId: admin.sub,
    action: 'enrollment:issue',
    targetType: 'customer',
    targetId: params.id,
    detail: { via: 'bootstrap-script', bundleId },
  });

  return new Response(script, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'content-disposition': 'attachment; filename="bootstrap-agent.sh"',
    },
  });
}
```

enroll 自动登记行为已在「关键事实」核实（enroll/route.ts:44-53 自动 INSERT customer_servers），本路由无需预建 server 占位记录——裸机 enroll 后运营方在服务器列表看到上线，再对该 server 执行 provision。

- [ ] **步骤 4：运行测试验证通过**

运行：`cd central && npx vitest run`
预期：全部 PASS（含 deploy-flow.test.ts 等既有测试——deploy 命令体新增字段不影响既有断言；若有 snapshot 类断言则同步更新）。

- [ ] **步骤 5：Commit**

```bash
git add central/app/api/admin/servers central/__tests__/api-provision.test.ts
git commit -m "feat(central): provision 路由 + deploy 注入 bundleUrl + 裸机开通引导脚本"
```

---

### 任务 6：dashboard UI（bundles 页 + 服务器操作区）

**文件：**
- 创建：`central/app/(dashboard)/bundles/page.tsx`
- 修改：`central/app/(dashboard)/servers/[id]/page.tsx`（加「一键开通」）
- 修改：`central/app/(dashboard)/customers/[id]/page.tsx`（加「下载开通脚本」）
- 修改：`central/app/(dashboard)/layout.tsx`（导航加「发布包」入口）

- [ ] **步骤 1：bundles 页**

创建 `central/app/(dashboard)/bundles/page.tsx`（样式/布局对齐 `central/app/(dashboard)/servers/page.tsx` 的现有表格模式，执行时先读该文件复用其 className 约定）：

```tsx
'use client';

import { useEffect, useState } from 'react';

interface Bundle {
  id: string;
  ref: string;
  size_bytes: number | null;
  status: 'building' | 'ready' | 'failed';
  error: string | null;
  created_at: string;
}

export default function BundlesPage() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [ref, setRef] = useState('main');
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const res = await fetch('/api/admin/bundles');
    if (res.ok) setBundles((await res.json()).bundles);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // building 状态轮询
    return () => clearInterval(t);
  }, []);

  async function build() {
    setBuilding(true);
    setError('');
    const res = await fetch('/api/admin/bundles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref }),
    });
    if (!res.ok) setError((await res.json()).error ?? 'build failed');
    await load();
    setBuilding(false);
  }

  return (
    <div>
      <h1>发布包</h1>
      <div>
        <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="分支/tag/commit，如 main" />
        <button onClick={build} disabled={building}>
          {building ? '构建中…' : '构建发布包'}
        </button>
        {error && <span role="alert">{error}</span>}
      </div>
      <table>
        <thead>
          <tr><th>Ref</th><th>大小</th><th>状态</th><th>错误</th><th>构建时间</th></tr>
        </thead>
        <tbody>
          {bundles.map((b) => (
            <tr key={b.id}>
              <td>{b.ref}</td>
              <td>{b.size_bytes ? `${(b.size_bytes / 1024 / 1024).toFixed(1)} MB` : '—'}</td>
              <td>{b.status}</td>
              <td>{b.error ?? '—'}</td>
              <td>{new Date(b.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

并在 dashboard 导航（`(dashboard)/layout.tsx`）加「发布包」入口。

- [ ] **步骤 2：服务器页加「一键开通」+ 客户页加「下载开通脚本」**

先读 `central/app/(dashboard)/servers/[id]/page.tsx`，在其现有「部署」按钮旁加（复用页面已有 fetch/状态模式）：

```tsx
// servers/[id]/page.tsx —— 一键开通（provision，server 维度：agent 已在线）
async function provision() {
  const res = await fetch(`/api/admin/servers/${serverId}/provision`, { method: 'POST' });
  // 与现有 deploy 按钮一致：成功后跳 /jobs/[jobId] 看流式日志
}
```

再读 `central/app/(dashboard)/customers/[id]/page.tsx`，在页面操作区加（复用该页现有模式）：

```tsx
// customers/[id]/page.tsx —— 下载开通引导脚本（customer 维度：裸机第一步）
function downloadBootstrap() {
  window.location.href = `/api/admin/customers/${customerId}/bootstrap-script`;
}
```

UI 文案：
- 客户页「下载开通脚本」——裸机第一步：拷到目标服务器 `sudo bash bootstrap-agent.sh`
- 服务器页「一键开通」——agent 上线后：全自动 env+部署+初始化
- 服务器页「部署」（已有）——日常发版（自动取最新 ready 发布包）

- [ ] **步骤 3：Commit**

```bash
git add central/app/\(dashboard\)/bundles central/app/\(dashboard\)/servers central/app/\(dashboard\)/customers central/app/\(dashboard\)/layout.tsx
git commit -m "feat(central-ui): 发布包管理页 + 服务器开通/部署操作区 + 客户页开通脚本下载"
```

---

### 任务 7：端到端验证 + 文档收尾

**文件：** 无新增（验证驱动）

- [ ] **步骤 1：central/agent 全量测试**

运行：`cd central && npx vitest run` 与 `cd agent && npx vitest run`
预期：全部 PASS。

- [ ] **步骤 2：真实端到端验证（需用户协调一台测试机，或复用现有测试服务器）**

验证清单（按序执行，逐项记录证据）：
1. central 构建发布包：`POST /api/admin/bundles { "ref": "main" }` → status ready
2. 裸机执行引导脚本 → agent 上线（central 服务器列表心跳绿）
3. central 点「一键开通」→ job 流式日志：env→bundle→build→health→kb-sync 全绿
4. 目标机验证：`curl localhost:1337/_health`、前端 200、后台可建超管
5. 日常发版：push 一个改动 → 构建新发布包 → 「部署」→ 目标机改动生效
6. 幂等重跑：再点一次「一键开通」→ 不报错、配置不丢

- [ ] **步骤 3：更新 deploy.sh 头部注释**

`deploy.sh` 顶部注释加一行指引（不删脚本本身——它仍是 provision/引导脚本的底层执行器）：

```bash
# 注意：日常部署已统一走 central agent（发布包模式）。本脚本保留为底层执行器，
# 由 provision/引导流程调用；手动使用仅限应急（--no-pull 配合 rsync）。
```

```bash
git add deploy.sh
git commit -m "docs(deploy): 标注部署主入口已统一为 central agent 发布包模式"
```

---

## 自检记录

- **规格覆盖：** 缺口 3（从零开通无端到端编排）=任务 4/5/6（bootstrap-script 解决裸机鸡生蛋，provision 编排其余）；缺口 4（部署模式分裂）=任务 3/4/5（agent deploy 弃 git pull 统一 bundle；rsync 降为 bundle 内部分发机制不再是独立路线）；缺口 1/2（客户自助账号/品牌预览）=D2 明确不做 ✅
- **类型一致性：** `command:provision` 字段在 central 路由（任务5）、agent executor（任务4）、handleProvision（任务4）三处一致（bundleUrl/centralApiUrl/envVars/mode/jobId/commandId）；`syncBundle(opts{url,token,dataDir})` 签名在 bundle.ts/deploy.ts/provision.ts/executor.ts 四处一致 ✅
- **安全：** bundle 下载复用 agent token 哈希鉴权；密钥由 central 生成直送 agent 不经人手；引导脚本 enrollment code 一次性 24h（复用现有机制）；rsync 排除实例 .env/uploads ✅
- **幂等：** provision 可重跑（env 覆盖写、bundle --delete、compose up 幂等、KB resync 幂等）✅
