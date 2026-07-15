# M3：Agent 指令执行器 + config-sync/restart/status/logs 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。

**目标：** 维护者从中央 UI 一键下发配置同步、重启、状态查询、日志拉取指令，Agent 执行并实时上报结果到中央，任务历史可查。

**架构：** Agent 端用 `execa` 调 `docker compose` 子命令；中央新增 `/api/admin/servers/[id]/command` POST 触发指令、`/api/admin/jobs/*` 查询任务历史。复用 M2 的 `agent-router.ts` 处理 `command:result` / `command:progress` / `log:line`。

**技术栈：** `execa`（子进程）、AbortController（取消）、Vitest。

**关联规格：** [2026-07-15-multi-tenant-central-control.md](../specs/2026-07-15-multi-tenant-central-control.md) 第 4.2、6.4、9.5、12.3 节

**前置依赖：** M2 已完成（Agent 能连接 + 心跳；agent-router 已处理 result 消息）

---

## 文件结构

```
agent/
├── src/
│   ├── executor.ts                   # 完整实现（替换 M2 占位）
│   ├── commands/
│   │   ├── config-sync.ts
│   │   ├── restart.ts
│   │   ├── status.ts
│   │   └── logs.ts
│   └── lib/
│       ├── compose.ts                # runCompose 封装
│       ├── env-file.ts               # .env 读写
│       └── abort-registry.ts         # commandId → AbortController
├── __tests__/
│   ├── executor.test.ts
│   ├── config-sync.test.ts
│   ├── restart.test.ts
│   ├── status.test.ts
│   ├── logs.test.ts
│   └── env-file.test.ts
central/
├── app/api/admin/
│   ├── servers/[id]/command/route.ts # POST 下发指令
│   ├── jobs/route.ts                 # GET 任务列表
│   └── jobs/[id]/route.ts            # GET 任务详情
├── app/(dashboard)/
│   ├── servers/[id]/page.tsx         # 扩展：4 个指令按钮
│   ├── servers/[id]/logs/page.tsx    # 日志查看页
│   ├── jobs/page.tsx
│   └── jobs/[id]/page.tsx
├── lib/
│   └── job-manager.ts                # 状态机 + 超时
└── __tests__/
    ├── job-manager.test.ts
    └── command-flow.test.ts
```

---

## 任务 1：Agent 子进程封装 `runCompose` + abort registry

**文件：**
- 创建：`agent/src/lib/compose.ts`
- 创建：`agent/src/lib/abort-registry.ts`
- 测试：`agent/__tests__/executor.test.ts`（部分）

- [ ] **步骤 1：写 `agent/src/lib/abort-registry.ts`**

```typescript
const registry = new Map<string, AbortController>();

export function createAbortController(commandId: string): AbortController {
  const existing = registry.get(commandId);
  if (existing) return existing;
  const controller = new AbortController();
  registry.set(commandId, controller);
  return controller;
}

export function abortCommand(commandId: string): boolean {
  const controller = registry.get(commandId);
  if (!controller) return false;
  controller.abort();
  registry.delete(commandId);
  return true;
}

export function cleanupAbortController(commandId: string): void {
  registry.delete(commandId);
}
```

- [ ] **步骤 2：写 `agent/src/lib/compose.ts`**

```typescript
import { execa, type ResultPromise } from 'execa';

export interface ComposeOptions {
  cwd: string;
  signal?: AbortSignal;
}

export interface ComposeHooks {
  onLog: (stream: 'stdout' | 'stderr', line: string) => void;
}

export async function runCompose(
  args: string[],
  opts: ComposeOptions,
  hooks?: ComposeHooks
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const subprocess = execa('docker', ['compose', ...args], {
    cwd: opts.cwd,
    signal: opts.signal,
    reject: false,
  }) as ResultPromise<{}>;

  let stdout = '';
  let stderr = '';
  subprocess.stdout?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    stdout += text;
    if (hooks) {
      for (const line of text.split('\n')) {
        if (line) hooks.onLog('stdout', line);
      }
    }
  });
  subprocess.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    stderr += text;
    if (hooks) {
      for (const line of text.split('\n')) {
        if (line) hooks.onLog('stderr', line);
      }
    }
  });

  const result = await subprocess;
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode ?? 0,
  };
}
```

- [ ] **步骤 3：写失败的 executor 测试**

`agent/__tests__/executor.test.ts`：
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeCommand } from '../src/executor';
import * as composeMod from '../src/lib/compose';

vi.mock('../src/lib/compose');

describe('executeCommand dispatch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dispatches config-sync command', async () => {
    const mockedRunCompose = vi.mocked(composeMod.runCompose);
    mockedRunCompose.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    const hooks = { onProgress: vi.fn(), onLog: vi.fn() };
    // mock fs.writeFileSync
    const fs = await import('node:fs');
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    await executeCommand({
      type: 'command:config-sync',
      commandId: 'c1',
      envVars: { FOO: 'bar', BAZ: 'qux' },
      restart: true,
    }, hooks);

    expect(hooks.onProgress).toHaveBeenCalledWith('config-written', expect.any(String));
    expect(mockedRunCompose).toHaveBeenCalledWith(
      ['restart', 'backend', 'frontend'],
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('throws on unknown command type', async () => {
    await expect(executeCommand({ type: 'unknown', commandId: 'x' }, { onProgress: vi.fn(), onLog: vi.fn() }))
      .rejects.toThrow(/unknown command type/i);
  });
});
```

- [ ] **步骤 4：写 `agent/src/executor.ts`（完整实现）**

```typescript
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { runCompose, ComposeHooks } from './lib/compose';
import { createAbortController, abortCommand, cleanupAbortController } from './lib/abort-registry';
import { syncEnvFile, readEnvFile } from './lib/env-file';
import { handleConfigSync } from './commands/config-sync';
import { handleRestart } from './commands/restart';
import { handleStatus } from './commands/status';
import { handleLogs } from './commands/logs';

const DATA_DIR = process.env.AGENT_DATA_DIR ?? '/data';

export interface CommandHandler {
  onProgress: (stage: string, message: string) => void;
  onLog: (stream: 'stdout' | 'stderr', line: string) => void;
}

export type Command =
  | { type: 'command:config-sync'; commandId: string; envVars: Record<string, string>; restart: boolean }
  | { type: 'command:restart'; commandId: string; services: string[] }
  | { type: 'command:status'; commandId: string }
  | { type: 'command:logs'; commandId: string; service: string; tail: number }
  | { type: 'command:deploy'; commandId: string; jobId?: string; imageTag?: string; envVars?: Record<string, string>; mode?: 'nginx' | 'direct' }
  | { type: 'command:cancel'; commandId: string };

export async function executeCommand(cmd: Command, hooks: CommandHandler): Promise<string | undefined> {
  const composeHooks: ComposeHooks = { onLog: hooks.onLog };
  const controller = createAbortController(cmd.commandId);

  try {
    switch (cmd.type) {
      case 'command:config-sync':
        return await handleConfigSync(cmd, DATA_DIR, hooks, composeHooks, controller.signal);

      case 'command:restart':
        return await handleRestart(cmd, DATA_DIR, hooks, composeHooks, controller.signal);

      case 'command:status':
        return await handleStatus(cmd, DATA_DIR, composeHooks, controller.signal);

      case 'command:logs':
        return await handleLogs(cmd, DATA_DIR, composeHooks, controller.signal);

      case 'command:deploy':
        // M4 实现
        throw new Error('deploy not implemented yet (M4)');

      case 'command:cancel': {
        // 取消正在执行的任务
        const aborted = abortCommand(cmd.commandId);
        return aborted ? 'cancelled' : 'no running task';
      }

      default:
        throw new Error(`unknown command type: ${(cmd as any).type}`);
    }
  } finally {
    cleanupAbortController(cmd.commandId);
  }
}
```

- [ ] **步骤 5：Commit**

```bash
git add agent/src/executor.ts agent/src/lib/central/__tests__/executor.test.ts
git commit -m "feat(agent): add executor dispatcher + compose wrapper + abort registry (M3-1)"
```

---

## 任务 2：.env 文件读写工具（TDD）

**文件：**
- 创建：`agent/src/lib/env-file.ts`
- 测试：`agent/__tests__/env-file.test.ts`

- [ ] **步骤 1：写失败的 .env 测试**

`agent/__tests__/env-file.test.ts`：
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs';
import { syncEnvFile, readEnvFile, parseEnv, stringifyEnv } from '../src/lib/env-file';

const TMP = '/tmp/test.env';

describe('parseEnv + stringifyEnv', () => {
  it('roundtrips basic key=value pairs', () => {
    const content = 'FOO=bar\nBAZ=qux\n';
    const parsed = parseEnv(content);
    expect(parsed).toEqual({ FOO: 'bar', BAZ: 'qux' });
    expect(stringifyEnv(parsed)).toBe('FOO=bar\nBAZ=qux\n');
  });

  it('preserves quotes and special chars', () => {
    const content = 'KEY="hello world"\nNUM=42\n';
    const parsed = parseEnv(content);
    expect(parsed.KEY).toBe('hello world');
    expect(parsed.NUM).toBe('42');
  });

  it('skips comments and empty lines', () => {
    const content = '# comment\n\nFOO=bar\n';
    const parsed = parseEnv(content);
    expect(parsed).toEqual({ FOO: 'bar' });
  });
});

describe('syncEnvFile', () => {
  beforeEach(() => writeFileSync(TMP, 'EXISTING=old\nOTHER=val\n', { mode: 0o600 }));
  afterEach(() => { if (existsSync(TMP)) unlinkSync(TMP); });

  it('updates existing keys and adds new ones, preserves others', () => {
    syncEnvFile(TMP, { EXISTING: 'new', NEW_KEY: 'added' });
    const content = readFileSync(TMP, 'utf8');
    expect(content).toContain('EXISTING=new');
    expect(content).toContain('NEW_KEY=added');
    expect(content).toContain('OTHER=val');  // 保留
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd agent && npx vitest run __tests__/env-file.test.ts
```
预期：FAIL

- [ ] **步骤 3：写 `agent/src/lib/env-file.ts`**

```typescript
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // 去引号
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function stringifyEnv(env: Record<string, string>): string {
  return Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
}

export function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  return parseEnv(readFileSync(path, 'utf8'));
}

export function syncEnvFile(path: string, updates: Record<string, string>): void {
  const existing = readEnvFile(path);
  const merged = { ...existing, ...updates };
  writeFileSync(path, stringifyEnv(merged), { mode: 0o600 });
}

export function writeEnvFile(path: string, env: Record<string, string>): void {
  writeFileSync(path, stringifyEnv(env), { mode: 0o600 });
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd agent && npx vitest run __tests__/env-file.test.ts
```
预期：PASS 4 tests

- [ ] **步骤 5：Commit**

```bash
git add agent/src/lib/env-file.ts agent/__tests__/env-file.test.ts
git commit -m "feat(agent): add .env parse/stringify/sync utilities (M3-2)"
```

---

## 任务 3：config-sync 命令（TDD）

**文件：**
- 创建：`agent/src/commands/config-sync.ts`
- 测试：`agent/__tests__/config-sync.test.ts`

- [ ] **步骤 1：写失败的 config-sync 测试**

`agent/__tests__/config-sync.test.ts`：
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleConfigSync } from '../src/commands/config-sync';
import * as composeMod from '../src/lib/compose';
import * as envMod from '../src/lib/env-file';

vi.mock('../src/lib/compose');
vi.mock('../src/lib/env-file');

describe('handleConfigSync', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes .env with provided vars, no restart when restart=false', async () => {
    const mockedWriteEnv = vi.mocked(envMod.writeEnvFile);
    const mockedRunCompose = vi.mocked(composeMod.runCompose);

    const hooks = { onProgress: vi.fn(), onLog: vi.fn() };
    await handleConfigSync(
      { type: 'command:config-sync', commandId: 'c1', envVars: { FOO: 'bar' }, restart: false },
      '/data', hooks, hooks, undefined
    );

    expect(mockedWriteEnv).toHaveBeenCalledWith('/data/.env', { FOO: 'bar' });
    expect(hooks.onProgress).toHaveBeenCalledWith('config-written', '.env updated');
    expect(mockedRunCompose).not.toHaveBeenCalled();
  });

  it('restarts backend + frontend when restart=true', async () => {
    const mockedRunCompose = vi.mocked(composeMod.runCompose);
    mockedRunCompose.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    const hooks = { onProgress: vi.fn(), onLog: vi.fn() };
    await handleConfigSync(
      { type: 'command:config-sync', commandId: 'c2', envVars: {}, restart: true },
      '/data', hooks, hooks, undefined
    );

    expect(mockedRunCompose).toHaveBeenCalledWith(
      ['restart', 'backend', 'frontend'],
      { cwd: '/data', signal: undefined },
      hooks
    );
    expect(hooks.onProgress).toHaveBeenCalledWith('restart', 'restarting backend + frontend');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd agent && npx vitest run __tests__/config-sync.test.ts
```
预期：FAIL

- [ ] **步骤 3：写 `agent/src/commands/config-sync.ts`**

```typescript
import { writeEnvFile } from '../lib/env-file';
import { runCompose, ComposeHooks } from '../lib/compose';
import { CommandHandler } from '../executor';

export type ConfigSyncCommand = {
  type: 'command:config-sync';
  commandId: string;
  envVars: Record<string, string>;
  restart: boolean;
};

export async function handleConfigSync(
  cmd: ConfigSyncCommand,
  dataDir: string,
  handler: CommandHandler,
  composeHooks: ComposeHooks,
  signal?: AbortSignal
): Promise<string> {
  const envPath = `${dataDir}/.env`;
  writeEnvFile(envPath, cmd.envVars);
  handler.onProgress('config-written', '.env updated');

  if (cmd.restart) {
    handler.onProgress('restart', 'restarting backend + frontend');
    const result = await runCompose(['restart', 'backend', 'frontend'], { cwd: dataDir, signal }, composeHooks);
    if (result.exitCode !== 0) {
      throw new Error(`restart failed: ${result.stderr}`);
    }
    handler.onProgress('restart-complete', 'services restarted');
  }

  return 'ok';
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd agent && npx vitest run __tests__/config-sync.test.ts
```
预期：PASS 2 tests

- [ ] **步骤 5：Commit**

```bash
git add agent/src/commands/config-sync.ts agent/__tests__/config-sync.test.ts
git commit -m "feat(agent): add config-sync command (write .env + optional restart) (M3-3)"
```

---

## 任务 4：restart / status / logs 命令（TDD）

**文件：**
- 创建：`agent/src/commands/restart.ts`
- 创建：`agent/src/commands/status.ts`
- 创建：`agent/src/commands/logs.ts`
- 测试：`agent/__tests__/restart.test.ts`、`status.test.ts`、`logs.test.ts`

- [ ] **步骤 1：写三个失败测试**

`agent/__tests__/restart.test.ts`：
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRestart } from '../src/commands/restart';
import * as composeMod from '../src/lib/compose';
vi.mock('../src/lib/compose');

describe('handleRestart', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs docker compose restart with given services', async () => {
    const mocked = vi.mocked(composeMod.runCompose);
    mocked.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    const hooks = { onProgress: vi.fn(), onLog: vi.fn() };
    await handleRestart(
      { type: 'command:restart', commandId: 'r1', services: ['backend', 'redis'] },
      '/data', hooks, hooks, undefined
    );

    expect(mocked).toHaveBeenCalledWith(['restart', 'backend', 'redis'], { cwd: '/data', signal: undefined }, hooks);
    expect(hooks.onProgress).toHaveBeenCalledWith('restart', 'restarting: backend, redis');
  });

  it('throws on non-zero exit', async () => {
    vi.mocked(composeMod.runCompose).mockResolvedValue({ stdout: '', stderr: 'service not found', exitCode: 1 });
    await expect(handleRestart(
      { type: 'command:restart', commandId: 'r2', services: ['unknown'] },
      '/data', { onProgress: vi.fn(), onLog: vi.fn() }, { onLog: vi.fn() }, undefined
    )).rejects.toThrow(/service not found/);
  });
});
```

`agent/__tests__/status.test.ts`：
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleStatus } from '../src/commands/status';
import * as composeMod from '../src/lib/compose';
vi.mock('../src/lib/compose');

describe('handleStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs docker compose ps --format json and returns stdout', async () => {
    vi.mocked(composeMod.runCompose).mockResolvedValue({
      stdout: '{"Service":"backend","State":"running"}\n{"Service":"redis","State":"running"}\n',
      stderr: '', exitCode: 0,
    });

    const result = await handleStatus(
      { type: 'command:status', commandId: 's1' },
      '/data', { onLog: vi.fn() }, undefined
    );
    expect(result).toContain('"Service":"backend"');
    expect(result).toContain('"Service":"redis"');
  });
});
```

`agent/__tests__/logs.test.ts`：
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleLogs } from '../src/commands/logs';
import * as composeMod from '../src/lib/compose';
vi.mock('../src/lib/compose');

describe('handleLogs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs docker compose logs --tail N service', async () => {
    const mocked = vi.mocked(composeMod.runCompose);
    mocked.mockResolvedValue({
      stdout: 'line1\nline2\nline3\n',
      stderr: '', exitCode: 0,
    });
    const onLog = vi.fn();

    const result = await handleLogs(
      { type: 'command:logs', commandId: 'l1', service: 'backend', tail: 100 },
      '/data', { onLog }, undefined
    );

    expect(mocked).toHaveBeenCalledWith(['logs', '--tail', '100', 'backend'], expect.any(Object), { onLog });
    expect(result).toContain('line1');
    // 每行应通过 onLog 流式上报
    expect(onLog).toHaveBeenCalledWith('stdout', 'line1');
    expect(onLog).toHaveBeenCalledWith('stdout', 'line2');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd agent && npx vitest run __tests__/restart.test.ts __tests__/status.test.ts __tests__/logs.test.ts
```
预期：FAIL

- [ ] **步骤 3：写三个命令实现**

`agent/src/commands/restart.ts`：
```typescript
import { runCompose, ComposeHooks } from '../lib/compose';
import { CommandHandler } from '../executor';

export type RestartCommand = {
  type: 'command:restart';
  commandId: string;
  services: string[];
};

export async function handleRestart(
  cmd: RestartCommand,
  dataDir: string,
  handler: CommandHandler,
  composeHooks: ComposeHooks,
  signal?: AbortSignal
): Promise<string> {
  handler.onProgress('restart', `restarting: ${cmd.services.join(', ')}`);
  const result = await runCompose(['restart', ...cmd.services], { cwd: dataDir, signal }, composeHooks);
  if (result.exitCode !== 0) throw new Error(`restart failed: ${result.stderr}`);
  return 'ok';
}
```

`agent/src/commands/status.ts`：
```typescript
import { runCompose, ComposeHooks } from '../lib/compose';

export type StatusCommand = {
  type: 'command:status';
  commandId: string;
};

export async function handleStatus(
  _cmd: StatusCommand,
  dataDir: string,
  composeHooks: ComposeHooks,
  signal?: AbortSignal
): Promise<string> {
  const result = await runCompose(['ps', '--format', 'json'], { cwd: dataDir, signal }, composeHooks);
  if (result.exitCode !== 0) throw new Error(`status failed: ${result.stderr}`);
  return result.stdout;
}
```

`agent/src/commands/logs.ts`：
```typescript
import { runCompose, ComposeHooks } from '../lib/compose';

export type LogsCommand = {
  type: 'command:logs';
  commandId: string;
  service: string;
  tail: number;
};

export async function handleLogs(
  cmd: LogsCommand,
  dataDir: string,
  composeHooks: ComposeHooks,
  signal?: AbortSignal
): Promise<string> {
  const result = await runCompose(
    ['logs', '--tail', String(cmd.tail), cmd.service],
    { cwd: dataDir, signal },
    composeHooks
  );
  if (result.exitCode !== 0) throw new Error(`logs failed: ${result.stderr}`);
  return result.stdout;
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd agent && npx vitest run __tests__/restart.test.ts __tests__/status.test.ts __tests__/logs.test.ts
```
预期：PASS 4 tests

- [ ] **步骤 5：Commit**

```bash
git add agent/src/commands/ agent/__tests__/restart.test.ts agent/__tests__/status.test.ts agent/__tests__/logs.test.ts
git commit -m "feat(agent): add restart/status/logs commands (M3-4)"
```

---

## 任务 5：中央 job-manager（状态机 + 超时）

**文件：**
- 创建：`central/lib/job-manager.ts`
- 测试：`central/__tests__/job-manager.test.ts`

- [ ] **步骤 1：写失败的 job-manager 测试**

`central/__tests__/job-manager.test.ts`：
```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { pool } from '@/lib/db';
import { createJob, updateJobStatus, getJob, markStaleJobsFailed } from '@/lib/job-manager';

let serverId: string;
let adminId: string;

beforeAll(async () => {
  const c = await pool.query(`INSERT INTO customers (name) VALUES ('Job测试') RETURNING id`);
  const s = await pool.query(`INSERT INTO customer_servers (customer_id, hostname) VALUES ($1,'job-srv') RETURNING id`, [c.rows[0].id]);
  const a = await pool.query(`INSERT INTO admin_users (email, password_hash, role) VALUES ('job@x.local','x','admin') RETURNING id`);
  serverId = s.rows[0].id;
  adminId = a.rows[0].id;
});

afterAll(async () => {
  await pool.query(`DELETE FROM deploy_jobs; DELETE FROM customer_servers; DELETE FROM customers; DELETE FROM admin_users;`);
  await pool.end();
});

describe('job-manager', () => {
  it('creates a job in queued status', async () => {
    const job = await createJob({ serverId, type: 'restart', triggeredBy: adminId });
    expect(job.status).toBe('queued');
    expect(job.type).toBe('restart');
  });

  it('transitions queued → running → success', async () => {
    const job = await createJob({ serverId, type: 'config-sync', triggeredBy: adminId });
    await updateJobStatus(job.id, 'running');
    await updateJobStatus(job.id, 'success', { exitCode: 0 });
    const updated = await getJob(job.id);
    expect(updated.status).toBe('success');
    expect(updated.exit_code).toBe(0);
    expect(updated.finished_at).not.toBeNull();
  });

  it('rejects invalid status transition', async () => {
    const job = await createJob({ serverId, type: 'restart', triggeredBy: adminId });
    await updateJobStatus(job.id, 'running');
    await expect(updateJobStatus(job.id, 'queued')).rejects.toThrow(/invalid transition/);
  });

  it('marks stale running jobs as failed (5min timeout)', async () => {
    // 创建一个 6 分钟前进入 running 的 job
    const job = await createJob({ serverId, type: 'status', triggeredBy: adminId });
    await pool.query(`UPDATE deploy_jobs SET status='running', started_at=now() - interval '6 minutes' WHERE id=$1`, [job.id]);
    const count = await markStaleJobsFailed(300000);
    expect(count).toBeGreaterThanOrEqual(1);
    const updated = await getJob(job.id);
    expect(updated.status).toBe('failed');
    expect(updated.error_message).toContain('timeout');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd central && npx vitest run __tests__/job-manager.test.ts
```
预期：FAIL

- [ ] **步骤 3：写 `central/lib/job-manager.ts`**

```typescript
import { query } from './db';

export type JobType = 'deploy' | 'config-sync' | 'restart' | 'status' | 'logs';
export type JobStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  queued: ['running', 'cancelled'],
  running: ['success', 'failed', 'cancelled'],
  success: [],
  failed: [],
  cancelled: [],
};

export interface CreateJobParams {
  serverId: string;
  type: JobType;
  triggeredBy: string;
  configId?: string;
}

export async function createJob(params: CreateJobParams) {
  const result = await query<any>(
    `INSERT INTO deploy_jobs (server_id, type, triggered_by, config_id, status)
     VALUES ($1, $2, $3, $4, 'queued') RETURNING *`,
    [params.serverId, params.type, params.triggeredBy, params.configId ?? null]
  );
  return result.rows[0];
}

export async function updateJobStatus(
  jobId: string,
  newStatus: JobStatus,
  extras?: { exitCode?: number; errorMessage?: string }
): Promise<void> {
  const current = await query<{ status: JobStatus }>(`SELECT status FROM deploy_jobs WHERE id=$1`, [jobId]);
  if (current.rows.length === 0) throw new Error('job not found');
  const currentStatus = current.rows[0].status;
  if (!VALID_TRANSITIONS[currentStatus].includes(newStatus)) {
    throw new Error(`invalid transition: ${currentStatus} → ${newStatus}`);
  }

  const sets: string[] = [`status = $2`];
  const params: any[] = [jobId, newStatus];
  let paramIdx = 3;
  if (newStatus === 'running') sets.push(`started_at = now()`);
  if (newStatus === 'success' || newStatus === 'failed' || newStatus === 'cancelled') {
    sets.push(`finished_at = now()`);
  }
  if (extras?.exitCode !== undefined) { sets.push(`exit_code = $${paramIdx++}`); params.push(extras.exitCode); }
  if (extras?.errorMessage !== undefined) { sets.push(`error_message = $${paramIdx++}`); params.push(extras.errorMessage); }

  await query(`UPDATE deploy_jobs SET ${sets.join(', ')} WHERE id=$1`, params);
}

export async function getJob(jobId: string) {
  const result = await query<any>(`SELECT * FROM deploy_jobs WHERE id=$1`, [jobId]);
  return result.rows[0];
}

export async function listJobs(filter: { serverId?: string; limit?: number; offset?: number }) {
  const conditions: string[] = [];
  const params: any[] = [];
  if (filter.serverId) {
    params.push(filter.serverId);
    conditions.push(`server_id = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(filter.limit ?? 50);
  params.push(filter.offset ?? 0);
  const result = await query<any>(
    `SELECT * FROM deploy_jobs ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows;
}

export async function markStaleJobsFailed(timeoutMs: number): Promise<number> {
  const result = await query(
    `UPDATE deploy_jobs
     SET status = 'failed', error_message = 'timeout: no result within ${timeoutMs}ms',
         finished_at = now()
     WHERE status = 'running'
       AND started_at < now() - ($1 || ' milliseconds')::interval
     RETURNING id`,
    [String(timeoutMs)]
  );
  return result.rowCount ?? 0;
}

export function startJobTimeoutMonitor(timeoutMs = 5 * 60 * 1000, intervalMs = 60000): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      const count = await markStaleJobsFailed(timeoutMs);
      if (count > 0) console.log(`[job-manager] marked ${count} stale jobs failed`);
    } catch (err) {
      console.error('[job-manager] timeout check failed:', err);
    }
  }, intervalMs);
}
```

- [ ] **步骤 4：在 `central/server.ts` 中启动 timeout monitor**

```typescript
import { startJobTimeoutMonitor } from '@/lib/job-manager';
startJobTimeoutMonitor(5 * 60 * 1000, 60000);
```

- [ ] **步骤 5：运行测试验证通过**

```bash
cd central && npx vitest run __tests__/job-manager.test.ts
```
预期：PASS 4 tests

- [ ] **步骤 6：Commit**

```bash
git add central/lib/job-manager.ts central/__tests__/job-manager.test.ts central/server.ts
git commit -m "feat(central): add job-manager with state machine + 5min timeout (M3-5)"
```

---

## 任务 6：中央下发指令 API + 任务历史 API

**文件：**
- 创建：`central/app/api/admin/servers/[id]/command/route.ts`
- 创建：`central/app/api/admin/jobs/route.ts`
- 创建：`central/app/api/admin/jobs/[id]/route.ts`

- [ ] **步骤 1：写 `central/app/api/admin/servers/[id]/command/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { createJob } from '@/lib/job-manager';
import { sendToServer, isOnline } from '@/lib/connections';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const body = await req.json();
  const { type, ...rest } = body;
  const validTypes = ['config-sync', 'restart', 'status', 'logs'];
  if (!validTypes.includes(type)) {
    return errorResponse(`Invalid type. Must be one of: ${validTypes.join(', ')}`, 400);
  }

  // 验证 server 存在
  const srv = await query(`SELECT id FROM customer_servers WHERE id=$1`, [params.id]);
  if (srv.rows.length === 0) return errorResponse('Server not found', 404);

  // 检查 Agent 在线
  if (!isOnline(params.id)) {
    return errorResponse('Agent is offline. Cannot send command.', 409);
  }

  // 创建 job
  const job = await createJob({
    serverId: params.id,
    type: type as any,
    triggeredBy: admin.sub,
  });

  // 生成 commandId（与 jobId 相同）
  const command = {
    commandId: job.id,
    type: `command:${type}`,
    ...rest,
  };

  const sent = await sendToServer(params.id, command);
  if (!sent) {
    return errorResponse('Failed to send command (agent disconnected)', 503);
  }

  return json({ jobId: job.id, status: 'queued' }, 202);
}
```

- [ ] **步骤 2：写 `central/app/api/admin/jobs/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { listJobs } from '@/lib/job-manager';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { searchParams } = req.nextUrl;
  const serverId = searchParams.get('serverId') ?? undefined;
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  const items = await listJobs({ serverId, limit, offset });
  return json({ items });
}
```

- [ ] **步骤 3：写 `central/app/api/admin/jobs/[id]/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { getJob } from '@/lib/job-manager';
import { query } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const job = await getJob(params.id);
  if (!job) return errorResponse('Job not found', 404);

  // 附带日志（最近 500 行）
  const logs = await query(
    `SELECT ts, stream, line FROM job_logs WHERE job_id=$1 ORDER BY ts ASC LIMIT 500`,
    [params.id]
  );

  return json({ ...job, logs: logs.rows });
}
```

- [ ] **步骤 4：Commit**

```bash
git add central/app/api/admin/servers/\[id\]/command/ central/app/api/admin/jobs/
git commit -m "feat(central): add command dispatch + job history API (M3-6)"
```

---

## 任务 7：中央 UI - 服务器详情页（4 个指令按钮）

**文件：**
- 修改：`central/app/(dashboard)/servers/[id]/page.tsx`（扩展）
- 创建：`central/app/(dashboard)/servers/[id]/logs/page.tsx`

- [ ] **步骤 1：扩展 `central/app/(dashboard)/servers/[id]/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function ServerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [server, setServer] = useState<any>(null);
  const [logs, setLogs] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/servers/${id}`).then((r) => r.json()).then(setServer);
  }, [id]);

  async function sendCommand(type: string, extra: any = {}) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/servers/${id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...extra }),
      });
      const body = await res.json();
      if (res.ok) {
        alert(`任务已下发，jobId: ${body.jobId}`);
        // 跳转到任务详情
        window.open(`/jobs/${body.jobId}`, '_blank');
      } else {
        alert(`失败: ${body.error}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function viewLogs() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/servers/${id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'logs', service: 'backend', tail: 200 }),
      });
      const body = await res.json();
      if (res.ok) {
        // 跳转到任务详情查看日志
        window.open(`/jobs/${body.jobId}`, '_blank');
      } else {
        alert(`失败: ${body.error}`);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!server) return <p>加载中...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{server.hostname}</h1>
      <dl className="grid grid-cols-2 gap-2 max-w-lg">
        <dt className="font-bold">显示名</dt><dd>{server.display_name ?? '-'}</dd>
        <dt className="font-bold">状态</dt>
        <dd>
          <span className={`text-xs px-2 py-0.5 rounded ${server.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
            {server.status}
          </span>
        </dd>
        <dt className="font-bold">Agent 版本</dt><dd>{server.agent_version ?? '-'}</dd>
        <dt className="font-bold">最后心跳</dt><dd>{server.last_heartbeat ? new Date(server.last_heartbeat).toLocaleString() : '-'}</dd>
      </dl>

      <section>
        <h2 className="text-lg font-bold mb-2">操作</h2>
        <div className="space-x-2">
          <button disabled={busy} onClick={() => sendCommand('status')}
            className="bg-gray-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50">
            查看状态
          </button>
          <button disabled={busy} onClick={viewLogs}
            className="bg-gray-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50">
            查看日志
          </button>
          <button disabled={busy} onClick={() => {
            const services = prompt('重启哪些服务？（逗号分隔）', 'backend') ?? 'backend';
            sendCommand('restart', { services: services.split(',').map((s) => s.trim()) });
          }} className="bg-yellow-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50">
            重启服务
          </button>
          <Link href={`/servers/${id}/sync-config`}
            className="inline-block bg-blue-600 text-white px-3 py-1 rounded text-sm">
            同步配置
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2"><Link href={`/jobs?serverId=${id}`} className="text-blue-600">任务历史 →</Link></h2>
      </section>
    </div>
  );
}
```

- [ ] **步骤 2：Commit**

```bash
git add central/app/\(dashboard\)/servers/\[id\]/
git commit -m "feat(central): add 4 command buttons on server detail UI (M3-7)"
```

---

## 任务 8：中央 UI - 配置同步页 + 任务历史 + 详情

**文件：**
- 创建：`central/app/(dashboard)/servers/[id]/sync-config/page.tsx`
- 创建：`central/app/(dashboard)/jobs/page.tsx`
- 创建：`central/app/(dashboard)/jobs/[id]/page.tsx`

- [ ] **步骤 1：写配置同步页**

`central/app/(dashboard)/servers/[id]/sync-config/page.tsx`：
```tsx
'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function SyncConfigPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [envText, setEnvText] = useState('');
  const [restart, setRestart] = useState(true);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    let envVars: Record<string, string> = {};
    try {
      for (const line of envText.split('\n')) {
        const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
        if (m) envVars[m[1]] = m[2];
      }
    } catch {
      alert('env 格式错误');
      setBusy(false);
      return;
    }

    const res = await fetch(`/api/admin/servers/${id}/command`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'config-sync', envVars, restart }),
    });
    const body = await res.json();
    setBusy(false);
    if (res.ok) router.push(`/jobs/${body.jobId}`);
    else alert(`失败: ${body.error}`);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">同步配置到服务器</h1>
      <p className="text-sm text-gray-500">逐行输入 KEY=VALUE，会覆盖服务器上的 .env</p>
      <textarea
        className="w-full h-80 border p-2 font-mono text-sm"
        placeholder={'NEXT_PUBLIC_SITE_URL=https://...\nDATABASE_PASSWORD=...\nDASHSCOPE_API_KEY=...'}
        value={envText}
        onChange={(e) => setEnvText(e.target.value)}
      />
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={restart} onChange={(e) => setRestart(e.target.checked)} />
        <span>同步后自动重启 backend + frontend</span>
      </label>
      <button onClick={submit} disabled={busy} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
        {busy ? '下发中...' : '下发同步'}
      </button>
    </div>
  );
}
```

- [ ] **步骤 2：写任务列表页**

`central/app/(dashboard)/jobs/page.tsx`：
```tsx
'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function JobsPage() {
  const params = useSearchParams();
  const serverId = params.get('serverId');
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    const url = '/api/admin/jobs' + (serverId ? `?serverId=${serverId}` : '');
    fetch(url).then((r) => r.json()).then((d) => setItems(d.items ?? []));
  }, [serverId]);

  const statusColor: Record<string, string> = {
    queued: 'bg-gray-100 text-gray-700',
    running: 'bg-yellow-100 text-yellow-700',
    success: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">任务历史</h1>
      <table className="w-full bg-white rounded shadow">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-3 text-left">类型</th>
            <th className="p-3 text-left">状态</th>
            <th className="p-3 text-left">开始时间</th>
            <th className="p-3 text-left">耗时</th>
          </tr>
        </thead>
        <tbody>
          {items.map((j) => (
            <tr key={j.id} className="border-t hover:bg-gray-50">
              <td className="p-3"><Link href={`/jobs/${j.id}`} className="text-blue-600">{j.type}</Link></td>
              <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded ${statusColor[j.status] ?? ''}`}>{j.status}</span></td>
              <td className="p-3 text-sm">{j.started_at ? new Date(j.started_at).toLocaleString() : '-'}</td>
              <td className="p-3 text-sm">
                {j.started_at && j.finished_at
                  ? `${Math.round((new Date(j.finished_at).getTime() - new Date(j.started_at).getTime()) / 1000)}s`
                  : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **步骤 3：写任务详情页**

`central/app/(dashboard)/jobs/[id]/page.tsx`：
```tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/admin/jobs/${id}`).then((r) => r.json()).then(setJob);
  }, [id]);

  if (!job) return <p>加载中...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">任务 {job.type}</h1>
      <dl className="grid grid-cols-2 gap-2 max-w-lg">
        <dt className="font-bold">状态</dt><dd>{job.status}</dd>
        <dt className="font-bold">开始</dt><dd>{job.started_at ? new Date(job.started_at).toLocaleString() : '-'}</dd>
        <dt className="font-bold">结束</dt><dd>{job.finished_at ? new Date(job.finished_at).toLocaleString() : '-'}</dd>
        <dt className="font-bold">Exit Code</dt><dd>{job.exit_code ?? '-'}</dd>
        {job.error_message && (<><dt className="font-bold">错误</dt><dd className="text-red-600">{job.error_message}</dd></>)}
      </dl>
      <section>
        <h2 className="text-lg font-bold mb-2">日志</h2>
        <pre className="bg-black text-gray-100 p-4 rounded text-xs overflow-x-auto max-h-[600px] overflow-y-auto">
          {(job.logs ?? []).map((l: any, i: number) => (
            <div key={i} className={l.stream === 'stderr' ? 'text-red-400' : 'text-gray-100'}>
              [{new Date(l.ts).toLocaleTimeString()}] {l.line}
            </div>
          ))}
          {(job.logs ?? []).length === 0 && <div className="text-gray-500">无日志</div>}
        </pre>
      </section>
    </div>
  );
}
```

- [ ] **步骤 4：Commit**

```bash
git add central/app/\(dashboard\)/servers/\[id\]/sync-config/ central/app/\(dashboard\)/jobs/
git commit -m "feat(central): add sync-config page + jobs list/detail UI (M3-8)"
```

---

## 任务 9：端到端指令流程集成测试

**文件：**
- 测试：`central/__tests__/command-flow.test.ts`

- [ ] **步骤 1：写集成测试（模拟 Agent ws + 真实中央 API）**

`central/__tests__/command-flow.test.ts`：
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { pool } from '@/lib/db';
import { generateEnrollmentCode } from '@/lib/agent-auth';
import { hashPassword, signJwt } from '@/lib/auth';

const CENTRAL_URL = 'http://localhost:3000';
const CENTRAL_WS = 'ws://localhost:3000/api/agent/ws';

let adminToken: string;
let serverId: string;
let agentToken: string;
let agentWs: WebSocket;

beforeAll(async () => {
  const hash = await hashPassword('Test123!');
  const u = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('flow@x.local',$1,'admin') RETURNING id`,
    [hash]
  );
  adminToken = await signJwt({ sub: u.rows[0].id, email: 'flow@x.local', role: 'admin' });

  const c = await pool.query(`INSERT INTO customers (name) VALUES ('Flow测试') RETURNING id`);
  const code = await generateEnrollmentCode(c.rows[0].id);

  const enrollRes = await fetch(`${CENTRAL_URL}/api/agent/enroll`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrollmentCode: code, hostname: 'flow-srv', displayName: 'Flow测试' }),
  });
  const enrollBody = await enrollRes.json();
  serverId = enrollBody.serverId;
  agentToken = enrollBody.agentToken;

  // 建立 ws 连接（模拟 Agent）
  agentWs = new WebSocket(`${CENTRAL_WS}?token=${agentToken}`);
  await new Promise<void>((resolve) => agentWs.on('open', resolve));
  // 发送 register
  agentWs.send(JSON.stringify({ type: 'agent:register', serverId, agentVersion: 'test', hostname: 'flow-srv', dockerVersion: 'test' }));
  await new Promise((r) => setTimeout(r, 500));
});

afterAll(async () => {
  if (agentWs.readyState === WebSocket.OPEN) agentWs.close();
  await pool.query(`DELETE FROM deploy_jobs; DELETE FROM job_logs; DELETE FROM agent_tokens; DELETE FROM customer_servers; DELETE FROM enrollment_codes; DELETE FROM customers; DELETE FROM admin_users;`);
  await pool.end();
});

describe('command flow integration', () => {
  it('admin issues status command, agent responds with result', async () => {
    // Agent 端：监听指令并响应
    const commandReceived = new Promise<any>((resolve) => {
      agentWs.once('message', (raw) => resolve(JSON.parse(raw.toString())));
    });

    // Admin 端：下发指令
    const res = await fetch(`${CENTRAL_URL}/api/admin/servers/${serverId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ type: 'status' }),
    });
    expect(res.status).toBe(202);
    const { jobId } = await res.json();

    // Agent 收到指令
    const cmd = await commandReceived;
    expect(cmd.type).toBe('command:status');
    expect(cmd.commandId).toBe(jobId);

    // Agent 回复 ack
    agentWs.send(JSON.stringify({ type: 'command:ack', commandId: jobId, receivedAt: new Date().toISOString() }));

    // Agent 回复 result
    agentWs.send(JSON.stringify({
      type: 'command:result', commandId: jobId, success: true,
      stdout: '{"Service":"backend","State":"running"}',
      durationMs: 100,
    }));

    // 等中央写库
    await new Promise((r) => setTimeout(r, 500));

    // Admin 查询 job 详情
    const jobRes = await fetch(`${CENTRAL_URL}/api/admin/jobs/${jobId}`, {
      headers: { cookie: `central_admin_session=${adminToken}` },
    });
    const job = await jobRes.json();
    expect(job.status).toBe('success');
    expect(job.exit_code).toBe(0);
  });

  it('rejects command when agent is offline', async () => {
    // 关闭 agent ws
    agentWs.close();
    await new Promise((r) => setTimeout(r, 1000));  // 等 central 检测到断开

    const res = await fetch(`${CENTRAL_URL}/api/admin/servers/${serverId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ type: 'status' }),
    });
    expect(res.status).toBe(409);  // Agent offline
  });
});
```

- [ ] **步骤 2：运行集成测试**

```bash
cd central && npx vitest run __tests__/command-flow.test.ts
```
预期：PASS 2 tests

- [ ] **步骤 3：跑全部测试**

```bash
cd central && npx vitest run
cd ../agent && npx vitest run
```

- [ ] **步骤 4：Commit + tag**

```bash
git add central/__tests__/command-flow.test.ts
git commit -m "test(central): add end-to-end command flow integration test (M3-9)"
git tag m3-complete
```

---

## M3 自检

**规格覆盖度：**
- 第 4.2 节中央→Agent 指令 → 任务 1/3/4/6 ✓（config-sync/restart/status/logs 四种）
- 第 6.4 节 Agent 执行器 → 任务 1/3/4 ✓
- 第 9.5 节指令幂等 → M2 任务 7 已实现（processedCommands Set）
- 第 12.3 节交付物清单 → 任务 1-9 全覆盖 ✓

**类型一致性：**
- `Command` 类型在任务 1 定义，`handleConfigSync` 等接收对应子类型一致 ✓
- `runCompose(args, opts, hooks)` 签名在任务 1 定义，所有命令使用一致 ✓
- `JobStatus` 状态机转换在任务 5 定义，agent-router 处理 result 时调用一致 ✓

**遗漏：** deploy 命令在 M4 实现（任务 1 步骤 4 已留 stub）。
