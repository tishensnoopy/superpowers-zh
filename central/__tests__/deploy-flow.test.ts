// 注意：此测试需要真实 PostgreSQL。运行前确保 DB 可用 + schema 已迁移。
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// execa 是 agent 运行时依赖，central/node_modules 不存在。用 vi.hoisted + vi.mock
// factory 提供 mock 实现，避免 vite 模块解析失败（无 factory 的 vi.mock 会尝试自动
// mock，需要真实模块存在）。harness 的 installDeployMocks 在此 mock 上安装行为。
const { execaMock } = vi.hoisted(() => ({ execaMock: vi.fn() }));
vi.mock('execa', () => ({ execa: execaMock }));

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
    `TRUNCATE TABLE audit_logs, job_logs, deploy_jobs, agent_tokens, customer_servers, enrollment_codes, customer_configs, customers, admin_users CASCADE;`
  );
  await pool.end();
});

describe('deploy flow integration', () => {
  it('Agent executes deploy and central broadcasts via SSE', async () => {
    installDeployMocks(
      {
        healthSequence: ['healthy'],
        gitPullOutput: 'Fast-forward\n',
        composeUpOutput: 'Container Started\n',
      },
      execaMock
    );

    // 模拟浏览器 SSE 订阅
    const receivedEvents: Array<{ event: string; data: any }> = [];
    const fakeWriter = {
      // 必须返回 Promise<void>：sse-broadcaster 的 broadcastToJob 调用
      // writer.write(encoded).catch(...)，若返回 undefined 会抛 TypeError 导致 writer 被立即清理。
      write: (chunk: Uint8Array): Promise<void> => {
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
        return Promise.resolve();
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
        runCompose: async (
          args: string[],
          opts: { cwd: string; signal?: AbortSignal },
          composeHooks: { onLog: (stream: 'stdout' | 'stderr', line: string) => void }
        ) => {
          composeHooks.onLog('stdout', 'Building images...');
          composeHooks.onLog('stdout', 'Container Started');
          return { exitCode: 0 };
        },
      } as any,
      new AbortController().signal,
      {
        // bundle 模式：注入 syncBundle mock 替代真实下载，agentToken 避免加载 agent config
        syncBundle: async () => {},
        agentToken: 'test-token',
        healthcheckIntervalMs: 5,
        healthcheckMaxAttempts: 2,
      }
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
    expect(stages).toEqual(['config-written', 'bundle-sync', 'bundle-synced', 'build', 'healthcheck']);

    const finalUpdate = receivedEvents.find(
      (e) => e.event === 'job:update' && e.data.status === 'success'
    );
    expect(finalUpdate).toBeDefined();
  });

  it('deploy fails when healthcheck times out', async () => {
    installDeployMocks(
      {
        healthSequence: ['starting', 'starting'],  // 永远不 healthy
      },
      execaMock
    );

    const result = await handleDeploy(
      makeDeployCommand({ commandId: 'job-fail-1', jobId: 'job-fail-1' }),
      '/data',
      { onLog: () => {}, onProgress: () => {} } as any,
      {
        runCompose: async () => ({ exitCode: 0 }),
      } as any,
      new AbortController().signal,
      {
        syncBundle: async () => {},
        agentToken: 'test-token',
        healthcheckIntervalMs: 5,
        healthcheckMaxAttempts: 2,
      }
    );

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('healthcheck failed');
  });

  it('deploy is aborted when signal cancels mid-flight', async () => {
    installDeployMocks({ gitPullFail: true }, execaMock);
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
