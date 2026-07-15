# M4：command:deploy + 实时日志流（SSE）+ 部署任务面板 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 维护者从中央 UI 一键触发完整部署（git pull + docker compose up --build + 健康检查），浏览器实时看到部署日志流（<1s 延迟）和阶段进度条；部署中可取消。

**架构：** Agent 端新增 `command:deploy` 执行器，复刻 [deploy.sh](../../../deploy.sh) 的分阶段健康检查顺序（postgres → backend → frontend），每条日志通过 `log:line` 消息回传中央。中央新增 SSE 端点 `/api/admin/jobs/[id]/stream`，由 `sse-broadcaster.ts` 维护 jobId → 客户端 Set，将 Agent 上报的 `log:line` / `command:progress` / `command:result` 实时推给浏览器。`agent-router.ts` 在原有 `broadcastToAdmins` 基础上改为调用 `sse-broadcaster`，让日志同时落库（job_logs）+ 推流（SSE）。

**技术栈：** `execa`（git pull / docker compose 子进程）、AbortController（取消部署）、Next.js Route Handler SSE（`text/event-stream` + `ReadableStream`）、EventSource（浏览器端）、Vitest。

**关联规格：** [2026-07-15-multi-tenant-central-control.md](../specs/2026-07-15-multi-tenant-central-control.md) 第 4.2、6.4、9.5、12.4 节

**前置依赖：** M3 已完成（`command:config-sync/restart/status/logs` 可用；`job-manager.ts` 状态机 + 超时；`agent-router.ts` 已处理 `command:result` / `command:progress` / `log:line`）

---

## 文件结构

```
agent/
├── src/
│   ├── commands/
│   │   └── deploy.ts                   # git pull + compose up --build + healthcheck
│   ├── lib/
│   │   ├── healthcheck.ts              # pg → backend → frontend 顺序健康检查
│   │   └── git-pull.ts                 # git pull 封装 + 冲突检测
│   └── executor.ts                     # 修改：deploy case 改为调用 deploy.ts
├── __tests__/
│   ├── deploy.test.ts
│   └── healthcheck.test.ts
central/
├── app/api/admin/
│   ├── servers/[id]/deploy/route.ts    # POST 触发部署
│   └── jobs/[id]/stream/route.ts       # SSE 端点
├── app/(dashboard)/
│   ├── servers/[id]/page.tsx           # 修改：加部署按钮
│   └── jobs/[id]/page.tsx              # 修改：SSE 订阅 + 进度条 + 取消
├── lib/
│   ├── sse-broadcaster.ts              # jobId → client Set
│   └── agent-router.ts                 # 修改：log:line/progress/result 推 SSE
└── __tests__/
    ├── sse-broadcaster.test.ts
    ├── deploy-flow.test.ts
    └── deploy-e2e-harness.ts           # 测试夹具：mock git/docker
```

---

## 任务 1：Agent 健康检查库 `healthcheck.ts`（TDD）

**文件：**
- 创建：`agent/src/lib/healthcheck.ts`
- 测试：`agent/__tests__/healthcheck.test.ts`

- [ ] **步骤 1：写失败的 healthcheck 测试**

`agent/__tests__/healthcheck.test.ts`：
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitForServicesHealthy, checkServiceHealthy } from '../src/lib/healthcheck';
import { execa } from 'execa';

vi.mock('execa');

describe('healthcheck', () => {
  beforeEach(() => vi.clearAllMocks());

  it('checkServiceHealthy returns true when docker compose ps reports healthy', async () => {
    vi.mocked(execa).mockResolvedValue({
      stdout: '{"Service":"backend","Health":"healthy"}',
      stderr: '',
      exitCode: 0,
    } as any);
    const ok = await checkServiceHealthy('backend', { cwd: '/data', timeoutMs: 1000 });
    expect(ok).toBe(true);
  });

  it('checkServiceHealthy returns false on unhealthy', async () => {
    vi.mocked(execa).mockResolvedValue({
      stdout: '{"Service":"backend","Health":"unhealthy"}',
      stderr: '',
      exitCode: 0,
    } as any);
    const ok = await checkServiceHealthy('backend', { cwd: '/data', timeoutMs: 1000 });
    expect(ok).toBe(false);
  });

  it('waitForServicesHealthy returns true when all services healthy in order', async () => {
    vi.mocked(execa).mockResolvedValue({
      stdout: '{"Health":"healthy"}',
      stderr: '',
      exitCode: 0,
    } as any);
    const result = await waitForServicesHealthy(
      ['postgres', 'redis', 'meilisearch', 'backend', 'frontend'],
      { cwd: '/data', intervalMs: 10, maxAttempts: 3, onProgress: () => {} }
    );
    expect(result.ok).toBe(true);
  });

  it('waitForServicesHealthy returns false with timeout when service stays unhealthy', async () => {
    vi.mocked(execa).mockResolvedValue({
      stdout: '{"Health":"starting"}',
      stderr: '',
      exitCode: 0,
    } as any);
    const result = await waitForServicesHealthy(
      ['backend'],
      { cwd: '/data', intervalMs: 10, maxAttempts: 2, onProgress: () => {} }
    );
    expect(result.ok).toBe(false);
    expect(result.failedService).toBe('backend');
  });

  it('waitForServicesHealthy calls onProgress with each attempt', async () => {
    vi.mocked(execa).mockResolvedValue({ stdout: '{"Health":"healthy"}', stderr: '', exitCode: 0 } as any);
    const progress: Array<{ service: string; attempt: number; healthy: boolean }> = [];
    await waitForServicesHealthy(
      ['backend'],
      { cwd: '/data', intervalMs: 5, maxAttempts: 1, onProgress: (p) => progress.push(p) }
    );
    expect(progress.length).toBe(1);
    expect(progress[0]).toEqual({ service: 'backend', attempt: 1, healthy: true });
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd agent && npx vitest run __tests__/healthcheck.test.ts
```
预期：FAIL（`checkServiceHealthy` 不存在）

- [ ] **步骤 3：写 `agent/src/lib/healthcheck.ts`**

```typescript
import { execa } from 'execa';

export interface HealthcheckOptions {
  cwd: string;
  timeoutMs?: number;
}

export interface WaitForHealthyOptions {
  cwd: string;
  intervalMs: number;
  maxAttempts: number;
  onProgress: (info: { service: string; attempt: number; healthy: boolean }) => void;
}

export interface WaitForHealthyResult {
  ok: boolean;
  failedService?: string;
}

/**
 * 查询单个服务的健康状态。
 * 复刻 deploy.sh 的逻辑：docker compose ps <service> --format json，读 Health 字段。
 */
export async function checkServiceHealthy(service: string, opts: HealthcheckOptions): Promise<boolean> {
  try {
    const { stdout } = await execa(
      'docker',
      ['compose', 'ps', service, '--format', 'json'],
      { cwd: opts.cwd, timeout: opts.timeoutMs ?? 10000 }
    );
    if (!stdout.trim()) return false;
    // docker compose ps --format json 可能返回多行 JSON（每服务一行）
    for (const line of stdout.trim().split('\n')) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.Health && parsed.Health !== 'healthy') return false;
      } catch {
        // 忽略解析失败（某些 compose 版本输出格式不同）
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 按顺序等待多个服务健康，复刻 deploy.sh 的分阶段启动顺序：
 * 阶段1: postgres + redis + meilisearch（基础设施）
 * 阶段2: backend（Strapi）
 * 阶段3: frontend（Next.js）
 *
 * 此函数依次等待每个服务，每个服务最多 maxAttempts 次，每次间隔 intervalMs。
 * 如果某个服务在 maxAttempts 次后仍不健康，立即返回失败。
 */
export async function waitForServicesHealthy(
  services: string[],
  opts: WaitForHealthyOptions
): Promise<WaitForHealthyResult> {
  for (const service of services) {
    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      const healthy = await checkServiceHealthy(service, { cwd: opts.cwd });
      opts.onProgress({ service, attempt, healthy });
      if (healthy) break;
      if (attempt === opts.maxAttempts) {
        return { ok: false, failedService: service };
      }
      await new Promise((r) => setTimeout(r, opts.intervalMs));
    }
  }
  return { ok: true };
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd agent && npx vitest run __tests__/healthcheck.test.ts
```
预期：PASS 5 tests

- [ ] **步骤 5：Commit**

```bash
git add agent/src/lib/healthcheck.ts agent/__tests__/healthcheck.test.ts
git commit -m "feat(agent): add healthcheck library mirroring deploy.sh order (M4-1)"
```

---

## 任务 2：Agent git pull 封装 `git-pull.ts`（TDD）

**文件：**
- 创建：`agent/src/lib/git-pull.ts`
- 测试：`agent/__tests__/deploy.test.ts`（部分）

- [ ] **步骤 1：写失败的 git-pull 测试**

`agent/__tests__/deploy.test.ts`：
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execa } from 'execa';
import { pullLatest } from '../src/lib/git-pull';

vi.mock('execa');

describe('git-pull', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pullLatest succeeds with fast-forward', async () => {
    vi.mocked(execa).mockResolvedValue({
      stdout: 'Updating abc1234..def5678\nFast-forward\n',
      stderr: '',
      exitCode: 0,
    } as any);
    const result = await pullLatest('/data');
    expect(result.ok).toBe(true);
    expect(result.output).toContain('Fast-forward');
  });

  it('pullLatest fails on merge conflict', async () => {
    vi.mocked(execa).mockRejectedValue({
      stdout: 'CONFLICT (content): Merge conflict in docker-compose.yml',
      stderr: 'Automatic merge failed; fix conflicts and then commit the result.',
      exitCode: 1,
    } as any);
    const result = await pullLatest('/data');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('CONFLICT');
  });

  it('pullLatest fails on network error', async () => {
    vi.mocked(execa).mockRejectedValue(new Error('fatal: unable to access'));
    const result = await pullLatest('/data');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('unable to access');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd agent && npx vitest run __tests__/deploy.test.ts
```
预期：FAIL（`pullLatest` 不存在）

- [ ] **步骤 3：写 `agent/src/lib/git-pull.ts`**

```typescript
import { execa } from 'execa';

export interface PullResult {
  ok: boolean;
  output?: string;
  error?: string;
}

/**
 * 在指定目录执行 git pull，捕获 stdout/stderr。
 * 不抛异常，返回结构化结果，方便 executor 上报。
 */
export async function pullLatest(cwd: string): Promise<PullResult> {
  try {
    const { stdout, stderr } = await execa('git', ['pull'], { cwd });
    const output = (stdout + stderr).trim();
    if (output.includes('CONFLICT')) {
      return { ok: false, error: output };
    }
    return { ok: true, output };
  } catch (err: any) {
    const output = ((err.stdout ?? '') + (err.stderr ?? '') + (err.message ?? '')).trim();
    return { ok: false, error: output };
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd agent && npx vitest run __tests__/deploy.test.ts
```
预期：PASS 3 tests（仅 git-pull 部分）

- [ ] **步骤 5：Commit**

```bash
git add agent/src/lib/git-pull.ts agent/__tests__/deploy.test.ts
git commit -m "feat(agent): add git-pull wrapper with conflict detection (M4-2)"
```

---

## 任务 3：Agent deploy 命令 `deploy.ts`（TDD）

**文件：**
- 创建：`agent/src/commands/deploy.ts`
- 修改：`agent/__tests__/deploy.test.ts`（追加 deploy 测试）

- [ ] **步骤 1：追加失败的 deploy 命令测试**

在 `agent/__tests__/deploy.test.ts` 末尾追加：
```typescript
import { handleDeploy } from '../src/commands/deploy';
import type { CommandHandler } from '../src/executor';

function makeHooks(): CommandHandler {
  const logs: Array<{ stream: string; line: string }> = [];
  const progresses: Array<{ stage: string; message: string }> = [];
  return {
    onLog: (stream, line) => logs.push({ stream, line }),
    onProgress: (stage, message) => progresses.push({ stage, message }),
    _logs: logs,
    _progresses: progresses,
  } as any;
}

describe('deploy command', () => {
  beforeEach(() => vi.clearAllMocks());

  it('full deploy: env-write → git-pull → build → healthcheck', async () => {
    // git pull + docker compose ps 都成功
    vi.mocked(execa).mockImplementation(async (cmd, args) => {
      if (cmd === 'git') {
        return { stdout: 'Fast-forward', stderr: '', exitCode: 0 } as any;
      }
      if (cmd === 'docker' && args?.[1] === 'ps') {
        return { stdout: '{"Health":"healthy"}', stderr: '', exitCode: 0 } as any;
      }
      // docker compose up --build
      return { stdout: 'Container yousen-backend  Started', stderr: '', exitCode: 0 } as any;
    });

    const hooks = makeHooks();
    const result = await handleDeploy(
      {
        commandId: 'cmd-1',
        type: 'command:deploy',
        jobId: 'job-1',
        imageTag: 'unused',
        envVars: { NEXT_PUBLIC_SITE_URL: 'https://test.example.com' },
        mode: 'nginx',
      },
      '/data',
      hooks,
      { runCompose: async (args, opts) => { /* mock */ return { stdout: '', stderr: '', exitCode: 0 } as any; } } as any,
      new AbortController().signal
    );

    expect(result.success).toBe(true);
    const stages = (hooks as any)._progresses.map((p: any) => p.stage);
    expect(stages).toEqual(['config-written', 'git-pull', 'build', 'healthcheck']);
  });

  it('deploy fails when git pull has conflict', async () => {
    vi.mocked(execa).mockImplementation(async (cmd) => {
      if (cmd === 'git') throw { stdout: 'CONFLICT', stderr: 'merge failed', exitCode: 1 };
      return { stdout: '', stderr: '', exitCode: 0 } as any;
    });

    const hooks = makeHooks();
    const result = await handleDeploy(
      { commandId: 'cmd-2', type: 'command:deploy', jobId: 'job-2', imageTag: 'x', mode: 'direct' },
      '/data',
      hooks,
      { runCompose: async () => ({ stdout: '', stderr: '', exitCode: 0 } as any) } as any,
      new AbortController().signal
    );

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('CONFLICT');
  });

  it('deploy fails when healthcheck times out', async () => {
    vi.mocked(execa).mockImplementation(async (cmd, args) => {
      if (cmd === 'git') return { stdout: 'Fast-forward', stderr: '', exitCode: 0 } as any;
      if (cmd === 'docker' && args?.[1] === 'ps') {
        return { stdout: '{"Health":"starting"}', stderr: '', exitCode: 0 } as any;
      }
      return { stdout: '', stderr: '', exitCode: 0 } as any;
    });

    const hooks = makeHooks();
    const result = await handleDeploy(
      { commandId: 'cmd-3', type: 'command:deploy', jobId: 'job-3', imageTag: 'x', mode: 'direct' },
      '/data',
      hooks,
      { runCompose: async () => ({ stdout: '', stderr: '', exitCode: 0 } as any) } as any,
      new AbortController().signal,
      { healthcheckIntervalMs: 5, healthcheckMaxAttempts: 2 }  // 测试用快速超时
    );

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('backend');  // failedService
  });

  it('deploy is aborted when signal is already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const hooks = makeHooks();
    const result = await handleDeploy(
      { commandId: 'cmd-4', type: 'command:deploy', jobId: 'job-4', imageTag: 'x', mode: 'direct' },
      '/data',
      hooks,
      { runCompose: async () => ({ stdout: '', stderr: '', exitCode: 0 } as any) } as any,
      controller.signal
    );
    expect(result.success).toBe(false);
    expect(result.stderr).toMatch(/abort/i);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd agent && npx vitest run __tests__/deploy.test.ts
```
预期：FAIL（`handleDeploy` 不存在）

- [ ] **步骤 3：写 `agent/src/commands/deploy.ts`**

```typescript
import { pullLatest } from '../lib/git-pull';
import { waitForServicesHealthy } from '../lib/healthcheck';
import { syncEnvFile } from '../lib/env-file';
import type { ComposeHooks } from '../lib/compose';

export interface DeployCommand {
  commandId: string;
  type: 'command:deploy';
  jobId: string;
  imageTag: string;              // 保留字段，本期忽略（仍用 build context 模式）
  envVars?: Record<string, string>;
  mode: 'nginx' | 'direct';
}

export interface CommandHandler {
  onLog: (stream: 'stdout' | 'stderr', line: string) => void;
  onProgress: (stage: string, message: string) => void;
}

export interface ComposeRunner {
  runCompose(args: string[], opts: { cwd: string; signal?: AbortSignal }, hooks: ComposeHooks): Promise<{ exitCode: number }>;
}

// ComposeHooks 来自 M3 任务 1 的 agent/src/lib/compose.ts：
//   interface ComposeHooks { onLog: (stream: 'stdout' | 'stderr', line: string) => void }
// M3 的 runCompose 返回 { stdout, stderr, exitCode }；ComposeRunner 只取 exitCode

export interface DeployOptions {
  healthcheckIntervalMs?: number;
  healthcheckMaxAttempts?: number;
}

export interface DeployResult {
  success: boolean;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  durationMs: number;
}

/**
 * 执行部署：写 .env（可选）→ git pull → docker compose up --build → 健康检查。
 *
 * imageTag 字段保留为未来切换到镜像仓库 pull 模式时使用，本期忽略。
 * 当前实现沿用现有 docker-compose.yml 的 build context 模式。
 */
export async function handleDeploy(
  cmd: DeployCommand,
  dataDir: string,
  hooks: CommandHandler,
  composeRunner: ComposeRunner,
  signal: AbortSignal,
  opts: DeployOptions = {}
): Promise<DeployResult> {
  const start = Date.now();
  const intervalMs = opts.healthcheckIntervalMs ?? 5000;
  const maxAttempts = opts.healthcheckMaxAttempts ?? 24;  // 默认 2 分钟（与 deploy.sh 一致）

  // 步骤 0：检查取消
  if (signal.aborted) {
    return { success: false, stderr: 'aborted before start', durationMs: Date.now() - start };
  }

  // 步骤 1：写 .env（可选）
  // syncEnvFile 来自 M3 任务 2，签名 (path: string, updates: Record<string,string>): void
  // 内部已处理读-合并-写，权限 0o600
  if (cmd.envVars && Object.keys(cmd.envVars).length > 0) {
    try {
      const envPath = `${dataDir}/.env`;
      syncEnvFile(envPath, cmd.envVars);
      hooks.onProgress('config-written', '.env updated');
    } catch (err: any) {
      return { success: false, stderr: `failed to write .env: ${err.message}`, durationMs: Date.now() - start };
    }
  }

  // 步骤 2：git pull
  hooks.onProgress('git-pull', 'pulling latest code');
  const pullResult = await pullLatest(dataDir);
  if (!pullResult.ok) {
    return { success: false, stderr: pullResult.error, durationMs: Date.now() - start };
  }
  if (pullResult.output) hooks.onLog('stdout', pullResult.output);

  // 步骤 3：docker compose up --build
  hooks.onProgress('build', 'building and starting containers');
  const upArgs = cmd.mode === 'nginx'
    ? ['-f', 'docker-compose.yml', '-f', 'docker-compose.nginx.yml', 'up', '-d', '--build']
    : ['up', '-d', '--build'];
  try {
    const upResult = await composeRunner.runCompose(
      upArgs,
      { cwd: dataDir, signal },
      { onLog: (stream, line) => hooks.onLog(stream, line) }
    );
    if (upResult.exitCode !== 0) {
      return { success: false, exitCode: upResult.exitCode, stderr: 'docker compose up failed', durationMs: Date.now() - start };
    }
  } catch (err: any) {
    if (signal.aborted) {
      return { success: false, stderr: 'aborted during build', durationMs: Date.now() - start };
    }
    return { success: false, stderr: err.message, durationMs: Date.now() - start };
  }

  // 步骤 4：健康检查（复刻 deploy.sh 顺序）
  hooks.onProgress('healthcheck', 'waiting for healthchecks');
  const services = cmd.mode === 'nginx'
    ? ['postgres', 'redis', 'meilisearch', 'backend', 'frontend', 'nginx']
    : ['postgres', 'redis', 'meilisearch', 'backend', 'frontend'];
  const healthResult = await waitForServicesHealthy(services, {
    cwd: dataDir,
    intervalMs,
    maxAttempts,
    onProgress: (info) => {
      hooks.onLog('stdout', `[healthcheck] ${info.service} attempt=${info.attempt} healthy=${info.healthy}`);
    },
  });
  if (!healthResult.ok) {
    return {
      success: false,
      stderr: `healthcheck failed for service: ${healthResult.failedService}`,
      durationMs: Date.now() - start,
    };
  }

  return { success: true, exitCode: 0, durationMs: Date.now() - start };
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd agent && npx vitest run __tests__/deploy.test.ts
```
预期：PASS 7 tests（git-pull 3 + deploy 4）

- [ ] **步骤 5：Commit**

```bash
git add agent/src/commands/deploy.ts agent/__tests__/deploy.test.ts
git commit -m "feat(agent): add deploy command with git pull + build + healthcheck (M4-3)"
```

---

## 任务 4：Agent executor 接入 deploy 命令

**文件：**
- 修改：`agent/src/executor.ts`（替换 M3 留的 deploy stub）
- 修改：`agent/__tests__/executor.test.ts`（追加 deploy case）

- [ ] **步骤 1：在 `agent/__tests__/executor.test.ts` 追加测试**

注：M3 中 `executeCommand(cmd, hooks)` 只接收 2 个参数；DATA_DIR 是 executor.ts 内部的模块级常量，AbortController 由 `createAbortController` 内部创建。测试只需提供 cmd + hooks。

```typescript
import { describe, it, expect, vi } from 'vitest';
import { execa } from 'execa';
import { executeCommand } from '../src/executor';
import type { Command } from '../src/executor';

// 复用 M3 的 mock 工厂
vi.mock('execa');

describe('executor deploy command', () => {
  it('dispatches command:deploy to handleDeploy', async () => {
    vi.mocked(execa).mockImplementation(async (cmd, args) => {
      if (cmd === 'git') return { stdout: 'Fast-forward', stderr: '', exitCode: 0 } as any;
      if (cmd === 'docker' && args?.[1] === 'ps') return { stdout: '{"Health":"healthy"}', stderr: '', exitCode: 0 } as any;
      return { stdout: '', stderr: '', exitCode: 0 } as any;
    });

    const cmd: Command = {
      commandId: 'exec-deploy-1',
      type: 'command:deploy',
      jobId: 'job-exec-1',
      imageTag: 'unused',
      mode: 'direct',
    };
    // executeCommand 签名：(cmd, hooks) — 仅 2 参数
    const result = await executeCommand(cmd, {
      onLog: () => {},
      onProgress: () => {},
    });

    // deploy 成功时返回 stdout（M3 签名 Promise<string | undefined>）
    // 失败时 throw
    expect(result).toBeDefined();
  });

  it('returns "cancelled" for command:cancel with no running task', async () => {
    const cmd: Command = {
      commandId: 'exec-cancel-1',
      type: 'command:cancel',
    };
    const result = await executeCommand(cmd, { onLog: () => {}, onProgress: () => {} });
    expect(result).toBe('no running task');
  });
});
```

- [ ] **步骤 2：修改 `agent/src/executor.ts` 替换 deploy stub**

找到 M3 中 `case 'command:deploy': throw new Error('deploy not implemented yet (M4)');` 那行，替换为：

```typescript
case 'command:deploy': {
  const { handleDeploy } = await import('./commands/deploy');
  // runCompose 来自 M3 任务 1 的 agent/src/lib/compose.ts
  // 签名：(args, opts: ComposeOptions, hooks?: ComposeHooks) => Promise<{stdout, stderr, exitCode}>
  // ComposeRunner 只需要 exitCode，所以这里解构取 exitCode
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
    controller.signal
  );
  if (!deployResult.success) {
    throw Object.assign(new Error(deployResult.stderr ?? 'deploy failed'), {
      exitCode: deployResult.exitCode ?? 1,
    });
  }
  return deployResult.stdout;
}
```

注：`runCompose` 来自 M3 任务 1 创建的 `agent/src/lib/compose.ts`，签名 `(args, opts, hooks?) => Promise<{stdout, stderr, exitCode}>`。`DATA_DIR` 是 M3 中定义的模块级常量（默认 `/data`）。`controller` 由 M3 的 `createAbortController(cmd.commandId)` 创建。`composeHooks` 传 `onLog` 回调（与 M3 的 `ComposeHooks` 接口一致）。

- [ ] **步骤 3：运行测试验证通过**

```bash
cd agent && npx vitest run __tests__/executor.test.ts
```
预期：PASS（含 deploy + cancel 两个新 case）

- [ ] **步骤 4：跑 agent 全部测试**

```bash
cd agent && npx vitest run
```
预期：PASS（所有 M3 + M4 测试）

- [ ] **步骤 5：Commit**

```bash
git add agent/src/executor.ts agent/__tests__/executor.test.ts
git commit -m "feat(agent): wire deploy command into executor (M4-4)"
```

---

## 任务 5：中央 SSE 广播器 `sse-broadcaster.ts`（TDD）

**文件：**
- 创建：`central/lib/sse-broadcaster.ts`
- 测试：`central/__tests__/sse-broadcaster.test.ts`

- [ ] **步骤 1：写失败的 sse-broadcaster 测试**

`central/__tests__/sse-broadcaster.test.ts`：
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addSSEClient,
  removeSSEClient,
  broadcastToJob,
  broadcastJobUpdate,
  broadcastJobLog,
  broadcastJobProgress,
} from '@/lib/sse-broadcaster';

// 模拟 Response writer（Next.js Route Handler 用 ReadableStream）
function makeClient() {
  const controller = new WritableStreamDefaultController();
  const enqueue = vi.fn();
  const close = vi.fn();
  const writer = { enqueue, close, closed: false };
  return { writer, enqueue, close };
}

describe('sse-broadcaster', () => {
  beforeEach(() => {
    // 清空所有订阅（通过 removeSSEClient）
    // 由于内部 Map 是模块级状态，测试间需要清理
    // 这里通过一个内部 reset 函数；如果未导出，可手动 removeSSEClient
  });

  it('addSSEClient subscribes a client to a job', () => {
    const { writer } = makeClient();
    addSSEClient('job-1', writer as any);
    // 通过 broadcast 验证订阅生效
    broadcastToJob('job-1', 'test-event', { foo: 'bar' });
    // enqueue 应被调用
  });

  it('broadcastToJob sends SSE-formatted data to all subscribers of a job', () => {
    const c1 = makeClient();
    const c2 = makeClient();
    addSSEClient('job-2', c1.writer as any);
    addSSEClient('job-2', c2.writer as any);
    broadcastToJob('job-2', 'log', { line: 'hello' });
    expect(c1.enqueue).toHaveBeenCalled();
    expect(c2.enqueue).toHaveBeenCalled();
    // 验证 SSE 格式：data: ...\n\n
    const arg = c1.enqueue.mock.calls[0][0];
    expect(arg).toContain('event: log');
    expect(arg).toContain('data: ');
    expect(arg.endsWith('\n\n')).toBe(true);
  });

  it('removeSSEClient removes subscription', () => {
    const c = makeClient();
    addSSEClient('job-3', c.writer as any);
    removeSSEClient('job-3', c.writer as any);
    broadcastToJob('job-3', 'log', {});
    expect(c.enqueue).not.toHaveBeenCalled();
  });

  it('broadcastJobUpdate sends job:update event', () => {
    const c = makeClient();
    addSSEClient('job-4', c.writer as any);
    broadcastJobUpdate('job-4', { status: 'success' });
    const arg = c.enqueue.mock.calls[0][0];
    expect(arg).toContain('event: job:update');
    expect(arg).toContain('"status":"success"');
  });

  it('broadcastJobLog sends job:log event', () => {
    const c = makeClient();
    addSSEClient('job-5', c.writer as any);
    broadcastJobLog('job-5', { stream: 'stdout', line: 'Building...' });
    const arg = c.enqueue.mock.calls[0][0];
    expect(arg).toContain('event: job:log');
    expect(arg).toContain('"stream":"stdout"');
  });

  it('broadcastJobProgress sends job:progress event', () => {
    const c = makeClient();
    addSSEClient('job-6', c.writer as any);
    broadcastJobProgress('job-6', { stage: 'build', message: 'Building images' });
    const arg = c.enqueue.mock.calls[0][0];
    expect(arg).toContain('event: job:progress');
    expect(arg).toContain('"stage":"build"');
  });

  it('does not throw when broadcasting to job with no subscribers', () => {
    expect(() => broadcastToJob('job-empty', 'log', {})).not.toThrow();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd central && npx vitest run __tests__/sse-broadcaster.test.ts
```
预期：FAIL（`addSSEClient` 等不存在）

- [ ] **步骤 3：写 `central/lib/sse-broadcaster.ts`**

```typescript
/**
 * SSE 广播器：维护 jobId → client Set 映射。
 * Agent 上报的 log:line / command:progress / command:result 通过这里推给浏览器。
 *
 * 每个客户端是一个 WritableStreamDefaultWriter（由 Route Handler 创建）。
 */
type SSEClient = WritableStreamDefaultWriter<Uint8Array>;
const clients = new Map<string, Set<SSEClient>>();

export function addSSEClient(jobId: string, writer: SSEClient): void {
  if (!clients.has(jobId)) clients.set(jobId, new Set());
  clients.get(jobId)!.add(writer);
}

export function removeSSEClient(jobId: string, writer: SSEClient): void {
  const set = clients.get(jobId);
  if (!set) return;
  set.delete(writer);
  if (set.size === 0) clients.delete(jobId);
}

/**
 * 向指定 job 的所有 SSE 订阅者推送一条事件。
 * SSE 格式：`event: <event>\ndata: <json>\n\n`
 */
export function broadcastToJob(jobId: string, event: string, data: unknown): void {
  const set = clients.get(jobId);
  if (!set || set.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoded = new TextEncoder().encode(payload);
  for (const writer of set) {
    try {
      writer.write(encoded);
    } catch {
      // 写入失败（客户端已断开），由 Route Handler 的清理逻辑 removeSSEClient
      set.delete(writer);
    }
  }
  if (set.size === 0) clients.delete(jobId);
}

export function broadcastJobUpdate(jobId: string, payload: object): void {
  broadcastToJob(jobId, 'job:update', payload);
}

export function broadcastJobLog(jobId: string, payload: { stream: string; line: string; ts?: string }): void {
  broadcastToJob(jobId, 'job:log', payload);
}

export function broadcastJobProgress(jobId: string, payload: { stage: string; message: string }): void {
  broadcastToJob(jobId, 'job:progress', payload);
}

/** 测试用：清空所有订阅（仅测试环境调用） */
export function __resetSSEClients(): void {
  clients.clear();
}
```

并在测试文件的 `beforeEach` 中加：
```typescript
import { __resetSSEClients } from '@/lib/sse-broadcaster';
beforeEach(() => __resetSSEClients());
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd central && npx vitest run __tests__/sse-broadcaster.test.ts
```
预期：PASS 7 tests

- [ ] **步骤 5：Commit**

```bash
git add central/lib/sse-broadcaster.ts central/__tests__/sse-broadcaster.test.ts
git commit -m "feat(central): add SSE broadcaster for job log streaming (M4-5)"
```

---

## 任务 6：扩展 agent-router 接入 SSE

**文件：**
- 修改：`central/lib/agent-router.ts`（log:line / progress / result 改为同时推 SSE）
- 修改：`central/lib/connections.ts`（`broadcastToAdmins` 改为调用 sse-broadcaster）
- 测试：`central/__tests__/sse-broadcaster.test.ts`（已覆盖广播逻辑）

- [ ] **步骤 1：修改 `central/lib/connections.ts`**

将 `broadcastToAdmins` 的空实现改为：
```typescript
import { broadcastToJob, broadcastJobUpdate, broadcastJobLog, broadcastJobProgress } from './sse-broadcaster';

export function broadcastToAdmins(event: string, data: unknown): void {
  // 兼容 M2 留的接口：根据 event 名转发到对应 SSE 广播器
  if (event === 'job:update' && data && typeof data === 'object' && 'jobId' in data) {
    broadcastJobUpdate((data as any).jobId, data);
  } else if (event === 'job:log' && data && typeof data === 'object' && 'jobId' in data) {
    broadcastJobLog((data as any).jobId, data as any);
  } else if (event === 'job:progress' && data && typeof data === 'object' && 'jobId' in data) {
    broadcastJobProgress((data as any).jobId, data as any);
  }
  // server:heartbeat 等不通过 SSE 推（M5 的 audit/可观测性可选）
}
```

- [ ] **步骤 2：修改 `central/lib/agent-router.ts` 的 `log:line` 分支**

找到 `case 'log:line':` 分支，保持原有写库逻辑不变，广播改为：
```typescript
case 'log:line':
  await query(
    `INSERT INTO job_logs (job_id, stream, line) VALUES ($1,$2,$3)`,
    [msg.jobId, msg.stream, msg.line]
  );
  broadcastJobLog(msg.jobId, { stream: msg.stream, line: msg.line, ts: msg.ts });
  break;
```

`command:progress` 分支改为：
```typescript
case 'command:progress':
  broadcastJobProgress(msg.commandId, { stage: msg.stage, message: msg.message });
  break;
```

`command:result` 分支改为：
```typescript
case 'command:result':
  await query(
    `UPDATE deploy_jobs SET status=$1, finished_at=now(), exit_code=$2, error_message=$3 WHERE id=$4`,
    [msg.success ? 'success' : 'failed', msg.exitCode ?? null, msg.stderr ?? null, msg.commandId]
  );
  broadcastJobUpdate(msg.commandId, {
    jobId: msg.commandId,
    status: msg.success ? 'success' : 'failed',
    exitCode: msg.exitCode,
    stderr: msg.stderr,
    durationMs: msg.durationMs,
  });
  break;
```

- [ ] **步骤 3：运行测试验证不回归**

```bash
cd central && npx vitest run __tests__/agent-router.test.ts __tests__/sse-broadcaster.test.ts
```
预期：PASS（M2 的 agent-router 测试可能需要 mock broadcastToAdmins，确保不报错）

- [ ] **步骤 4：Commit**

```bash
git add central/lib/connections.ts central/lib/agent-router.ts
git commit -m "feat(central): route agent log/progress/result to SSE broadcaster (M4-6)"
```

---

## 任务 7：中央 SSE 端点 `/api/admin/jobs/[id]/stream`

**文件：**
- 创建：`central/app/api/admin/jobs/[id]/stream/route.ts`

- [ ] **步骤 1：写 SSE Route Handler**

`central/app/api/admin/jobs/[id]/stream/route.ts`：
```typescript
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { addSSEClient, removeSSEClient } from '@/lib/sse-broadcaster';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  // 验证 job 存在
  const job = await query(`SELECT id, status FROM deploy_jobs WHERE id=$1`, [params.id]);
  if (job.rows.length === 0) {
    return new Response('Job not found', { status: 404 });
  }

  const jobId = params.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const writer = {
        write: (chunk: Uint8Array) => {
          try {
            controller.enqueue(chunk);
          } catch {
            // controller 已关闭
          }
        },
        close: () => {
          try { controller.close(); } catch {}
        },
        closed: false,
      } as unknown as WritableStreamDefaultWriter<Uint8Array>;

      // 1. 发送 SSE 头部注释（保活）
      controller.enqueue(encoder.encode(`: connected to job ${jobId}\n\n`));

      // 2. 发送当前 job 状态快照
      query(`SELECT * FROM deploy_jobs WHERE id=$1`, [jobId]).then((res) => {
        const snapshot = res.rows[0];
        controller.enqueue(encoder.encode(`event: job:snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`));
      });

      // 3. 发送历史日志（最近 500 行）
      query(
        `SELECT ts, stream, line FROM job_logs WHERE job_id=$1 ORDER BY ts ASC LIMIT 500`,
        [jobId]
      ).then((res) => {
        for (const row of res.rows) {
          controller.enqueue(encoder.encode(
            `event: job:log\ndata: ${JSON.stringify(row)}\n\n`
          ));
        }
      });

      // 4. 注册到 SSE 广播器，接收后续实时日志
      addSSEClient(jobId, writer);

      // 5. 心跳：每 25 秒发注释行，防止代理超时
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      // 6. 客户端断开时清理
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        removeSSEClient(jobId, writer);
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      // ReadableStream 被 cancel（浏览器关闭）
      // removeSSEClient 已在 abort 处理器中调用
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',  // nginx 不缓冲
    },
  });
}
```

- [ ] **步骤 2：Commit**

```bash
git add central/app/api/admin/jobs/\[id\]/stream/route.ts
git commit -m "feat(central): add SSE stream endpoint for job logs (M4-7)"
```

---

## 任务 8：中央触发部署 API `/api/admin/servers/[id]/deploy`

**文件：**
- 创建：`central/app/api/admin/servers/[id]/deploy/route.ts`

- [ ] **步骤 1：写 deploy API**

`central/app/api/admin/servers/[id]/deploy/route.ts`：
```typescript
import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { createJob } from '@/lib/job-manager';
import { sendToServer, isOnline } from '@/lib/connections';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const body = await req.json().catch(() => ({}));
  const { configId, mode = 'nginx', envVars } = body;

  // 验证 server
  const srv = await query(`SELECT id, customer_id FROM customer_servers WHERE id=$1`, [params.id]);
  if (srv.rows.length === 0) return errorResponse('Server not found', 404);

  // 验证 config（可选；未传则取最新 published）
  let resolvedConfigId = configId;
  if (!resolvedConfigId) {
    const latest = await query(
      `SELECT id FROM customer_configs WHERE customer_id=$1 AND published_at IS NOT NULL ORDER BY version DESC LIMIT 1`,
      [srv.rows[0].customer_id]
    );
    if (latest.rows.length === 0) {
      return errorResponse('No published config for this customer. Publish a config first.', 400);
    }
    resolvedConfigId = latest.rows[0].id;
  } else {
    const cfg = await query(`SELECT id FROM customer_configs WHERE id=$1 AND customer_id=$2`, [resolvedConfigId, srv.rows[0].customer_id]);
    if (cfg.rows.length === 0) return errorResponse('Config not found or does not belong to this customer', 404);
  }

  // 检查 agent 在线
  if (!isOnline(params.id)) {
    return errorResponse('Agent is offline. Cannot deploy.', 409);
  }

  // 创建 job
  const job = await createJob({
    serverId: params.id,
    type: 'deploy',
    triggeredBy: admin.sub,
    configId: resolvedConfigId,
  });

  // 组装 envVars（从 config 的 env_overrides 中提取）
  let deployEnvVars = envVars;
  if (!deployEnvVars) {
    const cfg = await query(`SELECT env_overrides FROM customer_configs WHERE id=$1`, [resolvedConfigId]);
    deployEnvVars = cfg.rows[0]?.env_overrides ?? {};
  }

  // 下发 command:deploy
  const command = {
    commandId: job.id,
    type: 'command:deploy',
    jobId: job.id,
    imageTag: 'unused',  // 保留字段，本期忽略
    envVars: deployEnvVars,
    mode,
  };

  const sent = await sendToServer(params.id, command);
  if (!sent) {
    await query(`UPDATE deploy_jobs SET status='failed', error_message='agent disconnected', finished_at=now() WHERE id=$1`, [job.id]);
    return errorResponse('Failed to send deploy command (agent disconnected)', 503);
  }

  return json({ jobId: job.id, status: 'queued', streamUrl: `/api/admin/jobs/${job.id}/stream` }, 202);
}
```

- [ ] **步骤 2：Commit**

```bash
git add central/app/api/admin/servers/\[id\]/deploy/route.ts
git commit -m "feat(central): add deploy trigger API (M4-8)"
```

---

## 任务 9：中央 UI - 服务器详情页加部署按钮

**文件：**
- 修改：`central/app/(dashboard)/servers/[id]/page.tsx`（追加部署按钮）

- [ ] **步骤 1：在服务器详情页操作区追加部署按钮**

在 M3 任务 7 写的页面 `<div className="space-x-2">` 操作区中，在"同步配置"按钮后追加：

```tsx
<button
  disabled={busy || server?.status !== 'online'}
  onClick={async () => {
    if (!confirm('确认触发部署？这将执行 git pull + docker compose up --build，预计需要 3-5 分钟。')) return;
    const mode = confirm('使用 Nginx 模式？取消则用直连模式。') ? 'nginx' : 'direct';
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/servers/${id}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const body = await res.json();
      if (res.ok) {
        window.open(`/jobs/${body.jobId}`, '_blank');
      } else {
        alert(`部署失败: ${body.error}`);
      }
    } finally {
      setBusy(false);
    }
  }}
  className="bg-green-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
>
  部署
</button>
```

- [ ] **步骤 2：Commit**

```bash
git add central/app/\(dashboard\)/servers/\[id\]/page.tsx
git commit -m "feat(central): add deploy button on server detail page (M4-9)"
```

---

## 任务 10：中央 UI - 任务详情页实时日志流 + 进度条 + 取消

**文件：**
- 修改：`central/app/(dashboard)/jobs/[id]/page.tsx`（替换 M3 的静态版本）

- [ ] **步骤 1：重写任务详情页**

`central/app/(dashboard)/jobs/[id]/page.tsx`：
```tsx
'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';

interface JobLog {
  ts: string;
  stream: string;
  line: string;
}

interface Job {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled';
  started_at: string | null;
  finished_at: string | null;
  exit_code: number | null;
  error_message: string | null;
  logs?: JobLog[];
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [progress, setProgress] = useState<{ stage: string; message: string } | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // 1. 初始加载 job 快照
  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/jobs/${id}`).then((r) => r.json()).then((j) => {
      setJob(j);
      if (j.logs) setLogs(j.logs);
    });
  }, [id]);

  // 2. SSE 订阅实时更新
  useEffect(() => {
    if (!id) return;
    // 只对未完成的 job 订阅
    if (job && ['success', 'failed', 'cancelled'].includes(job.status)) return;

    const es = new EventSource(`/api/admin/jobs/${id}/stream`);
    es.onopen = () => setStreamConnected(true);
    es.onerror = () => setStreamConnected(false);

    es.addEventListener('job:snapshot', (e) => {
      const data = JSON.parse(e.data);
      setJob((prev) => prev ? { ...prev, ...data } : data);
    });

    es.addEventListener('job:log', (e) => {
      const data = JSON.parse(e.data);
      setLogs((prev) => [...prev, data]);
    });

    es.addEventListener('job:progress', (e) => {
      const data = JSON.parse(e.data);
      setProgress(data);
    });

    es.addEventListener('job:update', (e) => {
      const data = JSON.parse(e.data);
      setJob((prev) => prev ? { ...prev, ...data } : prev);
      if (['success', 'failed', 'cancelled'].includes(data.status)) {
        es.close();
        setStreamConnected(false);
      }
    });

    return () => es.close();
  }, [id, job?.status]);

  // 3. 自动滚动到底
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 4. 取消任务
  async function cancelJob() {
    if (!confirm('确认取消此任务？')) return;
    const res = await fetch(`/api/admin/servers/${job?.server_id ?? ''}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cancel', commandId: id }),
    });
    if (res.ok) alert('取消指令已下发');
    else alert('取消失败：' + (await res.json()).error);
  }

  if (!job) return <p>加载中...</p>;

  const statusColor: Record<string, string> = {
    queued: 'bg-gray-100 text-gray-700',
    running: 'bg-yellow-100 text-yellow-700 animate-pulse',
    success: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  };

  const stageOrder = ['config-written', 'git-pull', 'build', 'healthcheck'];
  const currentStageIdx = progress ? stageOrder.indexOf(progress.stage) : -1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">任务 {job.type}</h1>
        <div className="flex items-center gap-2">
          {streamConnected && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">● 实时</span>
          )}
          {job.status === 'running' && (
            <button onClick={cancelJob} className="bg-red-600 text-white px-3 py-1 rounded text-sm">
              取消任务
            </button>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 max-w-lg">
        <dt className="font-bold">状态</dt>
        <dd>
          <span className={`text-xs px-2 py-0.5 rounded ${statusColor[job.status] ?? ''}`}>
            {job.status}
          </span>
        </dd>
        <dt className="font-bold">开始</dt><dd>{job.started_at ? new Date(job.started_at).toLocaleString() : '-'}</dd>
        <dt className="font-bold">结束</dt><dd>{job.finished_at ? new Date(job.finished_at).toLocaleString() : '-'}</dd>
        <dt className="font-bold">Exit Code</dt><dd>{job.exit_code ?? '-'}</dd>
        {job.error_message && (<><dt className="font-bold">错误</dt><dd className="text-red-600">{job.error_message}</dd></>)}
      </dl>

      {progress && (
        <section>
          <h2 className="text-lg font-bold mb-2">进度</h2>
          <div className="flex items-center gap-2">
            {stageOrder.map((stage, idx) => (
              <div key={stage} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    idx < currentStageIdx ? 'bg-green-500 text-white' :
                    idx === currentStageIdx ? 'bg-yellow-500 text-white animate-pulse' :
                    'bg-gray-200 text-gray-500'
                  }`}
                >
                  {idx < currentStageIdx ? '✓' : idx + 1}
                </div>
                <span className="text-sm">{stage}</span>
                {idx < stageOrder.length - 1 && <span className="text-gray-400">→</span>}
              </div>
            ))}
          </div>
          {progress.message && <p className="text-sm text-gray-600 mt-1">{progress.message}</p>}
        </section>
      )}

      <section>
        <h2 className="text-lg font-bold mb-2">日志</h2>
        <pre className="bg-black text-gray-100 p-4 rounded text-xs overflow-x-auto max-h-[600px] overflow-y-auto">
          {logs.map((l, i) => (
            <div key={i} className={l.stream === 'stderr' ? 'text-red-400' : 'text-gray-100'}>
              [{new Date(l.ts).toLocaleTimeString()}] {l.line}
            </div>
          ))}
          {logs.length === 0 && <div className="text-gray-500">无日志</div>}
          <div ref={logEndRef} />
        </pre>
      </section>
    </div>
  );
}
```

- [ ] **步骤 2：Commit**

```bash
git add central/app/\(dashboard\)/jobs/\[id\]/page.tsx
git commit -m "feat(central): add real-time SSE log stream + progress + cancel on job detail (M4-10)"
```

---

## 任务 11：部署流程集成测试夹具 `deploy-e2e-harness.ts`

**文件：**
- 创建：`central/__tests__/deploy-e2e-harness.ts`

- [ ] **步骤 1：写测试夹具（mock git/docker 的可重用工具）**

`central/__tests__/deploy-e2e-harness.ts`：
```typescript
/**
 * M4 部署流程集成测试夹具：mock git/docker，模拟完整部署 5 分钟流程在毫秒级完成。
 * 被 deploy-flow.test.ts 和 M5 的 e2e/full-flow.spec.ts 复用。
 */
import { vi } from 'vitest';
import { execa } from 'execa';

export interface HarnessOptions {
  /** 健康检查结果序列；每次 docker compose ps 调用按顺序返回 */
  healthSequence?: string[];
  /** git pull 输出 */
  gitPullOutput?: string;
  /** 是否模拟 git pull 失败 */
  gitPullFail?: boolean;
  /** docker compose up 输出 */
  composeUpOutput?: string;
}

export function installDeployMocks(opts: HarnessOptions = {}) {
  const healthSeq = opts.healthSequence ?? ['healthy'];
  let healthIdx = 0;
  const gitPullFail = opts.gitPullFail ?? false;
  const gitPullOutput = opts.gitPullOutput ?? 'Fast-forward\n';
  const composeUpOutput = opts.composeUpOutput ?? 'Container yousen-backend Started\n';

  vi.mocked(execa).mockImplementation(async (cmd: string, args?: readonly string[]) => {
    // git pull
    if (cmd === 'git') {
      if (gitPullFail) {
        throw { stdout: '', stderr: 'CONFLICT', exitCode: 1, message: 'pull failed' };
      }
      return { stdout: gitPullOutput, stderr: '', exitCode: 0 } as any;
    }
    // docker compose ps <svc> --format json
    if (cmd === 'docker' && args?.[1] === 'ps') {
      const health = healthSeq[Math.min(healthIdx, healthSeq.length - 1)];
      healthIdx++;
      return { stdout: JSON.stringify({ Health: health }), stderr: '', exitCode: 0 } as any;
    }
    // docker compose up -d --build
    if (cmd === 'docker' && args?.[1] === 'up') {
      return { stdout: composeUpOutput, stderr: '', exitCode: 0 } as any;
    }
    return { stdout: '', stderr: '', exitCode: 0 } as any;
  });

  return {
    reset: () => {
      healthIdx = 0;
      vi.clearAllMocks();
    },
  };
}

/** 构造一个标准 deploy 命令 */
export function makeDeployCommand(overrides: Partial<any> = {}) {
  return {
    commandId: 'test-cmd-' + Math.random().toString(36).slice(2),
    type: 'command:deploy' as const,
    jobId: 'test-job-' + Math.random().toString(36).slice(2),
    imageTag: 'unused',
    mode: 'nginx' as const,
    envVars: { NEXT_PUBLIC_SITE_URL: 'https://test.example.com' },
    ...overrides,
  };
}
```

- [ ] **步骤 2：Commit**

```bash
git add central/__tests__/deploy-e2e-harness.ts
git commit -m "test(central): add deploy e2e test harness with git/docker mocks (M4-11)"
```

---

## 任务 12：部署流程端到端测试 `deploy-flow.test.ts`

**文件：**
- 创建：`central/__tests__/deploy-flow.test.ts`

- [ ] **步骤 1：写端到端测试（mock git/docker，真实 Agent deploy.ts + 真实中央 SSE）**

`central/__tests__/deploy-flow.test.ts`：
```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { execa } from 'execa';
import { handleDeploy } from '../../agent/src/commands/deploy';
import { installDeployMocks, makeDeployCommand } from './deploy-e2e-harness';
import { pool } from '@/lib/db';
import {
  addSSEClient,
  removeSSEClient,
  broadcastJobLog,
  broadcastJobUpdate,
  broadcastJobProgress,
  __resetSSEClients,
} from '@/lib/sse-broadcaster';

vi.mock('execa');

let adminId: string;
let serverId: string;
let jobId: string;

beforeAll(async () => {
  // 准备 db 数据
  const u = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('deploy-flow@x.local','x','admin') RETURNING id`
  );
  adminId = u.rows[0].id;
  const c = await pool.query(`INSERT INTO customers (name) VALUES ('Deploy测试') RETURNING id`);
  const s = await pool.query(
    `INSERT INTO customer_servers (customer_id, hostname) VALUES ($1,'deploy-srv') RETURNING id`,
    [c.rows[0].id]
  );
  serverId = s.rows[0].id;

  // 创建 job
  const j = await pool.query(
    `INSERT INTO deploy_jobs (server_id, type, triggered_by, status) VALUES ($1,'deploy',$2,'queued') RETURNING id`,
    [serverId, adminId]
  );
  jobId = j.rows[0].id;
});

afterAll(async () => {
  __resetSSEClients();
  await pool.query(
    `DELETE FROM job_logs; DELETE FROM deploy_jobs; DELETE FROM customer_servers; DELETE FROM customers; DELETE FROM admin_users;`
  );
  await pool.end();
});

describe('deploy flow integration', () => {
  it('Agent executes deploy and central broadcasts via SSE', async () => {
    installDeployMocks({
      healthSequence: ['healthy'],
      gitPullOutput: 'Fast-forward\n',
      composeUpOutput: 'Container Started\n',
    });

    // 模拟浏览器 SSE 订阅
    const receivedEvents: Array<{ event: string; data: any }> = [];
    const fakeWriter = {
      write: (chunk: Uint8Array) => {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split('\n');
        const eventLine = lines.find((l) => l.startsWith('event: '));
        const dataLine = lines.find((l) => l.startsWith('data: '));
        if (eventLine && dataLine) {
          receivedEvents.push({
            event: eventLine.replace('event: ', ''),
            data: JSON.parse(dataLine.replace('data: ', '')),
          });
        }
      },
      close: () => {},
      closed: false,
    } as any;
    addSSEClient(jobId, fakeWriter);

    // 模拟 agent-router 收到 log:line 时广播
    const logs: string[] = [];
    const hooks = {
      onLog: (stream: string, line: string) => {
        logs.push(line);
        broadcastJobLog(jobId, { stream, line, ts: new Date().toISOString() });
      },
      onProgress: (stage: string, message: string) => {
        broadcastJobProgress(jobId, { stage, message });
      },
    };

    const cmd = makeDeployCommand({ commandId: jobId, jobId });
    const result = await handleDeploy(
      cmd,
      '/data',
      hooks as any,
      {
        runCompose: async (args, opts, composeHooks) => {
          composeHooks.onLog('stdout', 'Building images...');
          composeHooks.onLog('stdout', 'Container Started');
          return { exitCode: 0 };
        },
      } as any,
      new AbortController().signal,
      { healthcheckIntervalMs: 5, healthcheckMaxAttempts: 2 }
    );

    expect(result.success).toBe(true);

    // 广播 result
    broadcastJobUpdate(jobId, {
      jobId,
      status: 'success',
      exitCode: 0,
      durationMs: result.durationMs,
    });

    // 验证 SSE 收到的事件
    const eventTypes = receivedEvents.map((e) => e.event);
    expect(eventTypes).toContain('job:progress');
    expect(eventTypes).toContain('job:log');
    expect(eventTypes).toContain('job:update');

    const stages = receivedEvents
      .filter((e) => e.event === 'job:progress')
      .map((e) => e.data.stage);
    expect(stages).toEqual(['config-written', 'git-pull', 'build', 'healthcheck']);

    const finalUpdate = receivedEvents.find(
      (e) => e.event === 'job:update' && e.data.status === 'success'
    );
    expect(finalUpdate).toBeDefined();
  });

  it('deploy fails when healthcheck times out', async () => {
    installDeployMocks({
      healthSequence: ['starting', 'starting'],  // 永远不 healthy
    });

    const result = await handleDeploy(
      makeDeployCommand({ commandId: 'job-fail-1', jobId: 'job-fail-1' }),
      '/data',
      { onLog: () => {}, onProgress: () => {} } as any,
      {
        runCompose: async () => ({ exitCode: 0 }),
      } as any,
      new AbortController().signal,
      { healthcheckIntervalMs: 5, healthcheckMaxAttempts: 2 }
    );

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('healthcheck failed');
  });

  it('deploy is aborted when signal cancels mid-flight', async () => {
    installDeployMocks({ gitPullFail: true });
    const controller = new AbortController();
    controller.abort();

    const result = await handleDeploy(
      makeDeployCommand({ commandId: 'job-abort-1', jobId: 'job-abort-1' }),
      '/data',
      { onLog: () => {}, onProgress: () => {} } as any,
      {
        runCompose: async () => ({ exitCode: 0 }),
      } as any,
      controller.signal
    );

    expect(result.success).toBe(false);
    expect(result.stderr).toMatch(/abort/i);
  });
});
```

- [ ] **步骤 2：运行集成测试**

```bash
cd central && npx vitest run __tests__/deploy-flow.test.ts
```
预期：PASS 3 tests

- [ ] **步骤 3：跑全部测试**

```bash
cd central && npx vitest run
cd ../agent && npx vitest run
```
预期：所有测试 PASS

- [ ] **步骤 4：Commit + tag**

```bash
git add central/__tests__/deploy-flow.test.ts
git commit -m "test(central): add end-to-end deploy flow integration test (M4-12)"
git tag m4-complete
```

---

## M4 自检

**规格覆盖度：**
- 第 4.2 节 `command:deploy` → 任务 3、4 ✓
- 第 6.4 节 Agent 执行器 deploy 分支 → 任务 4 ✓
- 第 9.5 节指令幂等 → M2 任务 7 已实现（processedCommands Set 在 AgentConnection 中），M4 复用
- 第 12.4 节交付物清单：
  - `central/app/api/admin/servers/[id]/deploy/route.ts` → 任务 8 ✓
  - `central/app/api/admin/jobs/[id]/stream/route.ts` → 任务 7 ✓
  - `central/lib/sse-broadcaster.ts` → 任务 5 ✓
  - `central/lib/agent-router.ts` 扩展 → 任务 6 ✓
  - `central/app/(dashboard)/servers/[id]/page.tsx` 部署按钮 → 任务 9 ✓
  - `central/app/(dashboard)/jobs/[id]/page.tsx` 实时日志 → 任务 10 ✓
  - `agent/src/commands/deploy.ts` → 任务 3 ✓
  - `agent/src/lib/healthcheck.ts` → 任务 1 ✓
  - `agent/src/lib/git-pull.ts` → 任务 2 ✓
  - `agent/__tests__/deploy.test.ts` → 任务 2、3 ✓
  - `agent/__tests__/healthcheck.test.ts` → 任务 1 ✓
  - `central/__tests__/sse-broadcaster.test.ts` → 任务 5 ✓
  - `central/__tests__/deploy-flow.test.ts` → 任务 12 ✓
  - `central/__tests__/deploy-e2e-harness.ts` → 任务 11 ✓

**类型一致性：**
- `DeployCommand` 在任务 3 定义，任务 4 executor 引用一致 ✓
- `CommandHandler` 接口在任务 3 定义（onLog + onProgress），与 M3 executor 的 hooks 一致 ✓
- `ComposeRunner.runCompose(args, opts, hooks)` 签名在任务 3 定义，与 M3 任务 1 的 `runCompose` 一致 ✓
- `WaitForHealthyOptions` 在任务 1 定义，任务 3 调用时参数名一致（intervalMs / maxAttempts / onProgress）✓
- `broadcastToJob` / `broadcastJobLog` / `broadcastJobUpdate` / `broadcastJobProgress` 在任务 5 定义，任务 6、12 调用一致 ✓
- `addSSEClient(jobId, writer)` / `removeSSEClient(jobId, writer)` 签名在任务 5 定义，任务 7 调用一致 ✓

**遗漏：**
- 无。所有 12.4 节列出的 14 个文件全部覆盖（含 1 个 harness）。
- 取消部署通过 M3 的 `command:cancel` + AbortController 实现，任务 3 步骤 3 已处理 `signal.aborted`，任务 10 步骤 1 UI 有取消按钮。
