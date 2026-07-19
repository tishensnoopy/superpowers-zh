import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execa } from 'execa';
import { handleDeploy } from '../src/commands/deploy';
import type { CommandHandler } from '../src/executor';

vi.mock('execa');
vi.mock('../src/lib/env-file');

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

function makeRunner(exitCode = 0) {
  return { runCompose: vi.fn(async () => ({ exitCode })) } as any;
}

const baseCmd = {
  commandId: 'cmd-1',
  type: 'command:deploy' as const,
  jobId: 'job-1',
  imageTag: 'unused',
  bundleUrl: '/api/agent/bundles/b-1/download',
  centralApiUrl: 'http://central:3100',
  mode: 'direct' as const,
};

describe('deploy command（bundle 模式）', () => {
  beforeEach(() => vi.clearAllMocks());

  it('full deploy: env-write → bundle-sync → build → healthcheck', async () => {
    vi.mocked(execa).mockImplementation(async (cmd, args) => {
      if (cmd === 'docker' && args?.[1] === 'ps') {
        return { stdout: '{"Health":"healthy"}', stderr: '', exitCode: 0 } as any;
      }
      return { stdout: '', stderr: '', exitCode: 0 } as any;
    });

    const syncBundle = vi.fn(async () => {});
    const hooks = makeHooks();
    const result = await handleDeploy(
      {
        ...baseCmd,
        mode: 'nginx',
        envVars: { NEXT_PUBLIC_SITE_URL: 'https://test.example.com' },
      },
      '/data',
      hooks,
      makeRunner(),
      new AbortController().signal,
      { syncBundle, agentToken: 'tok' }
    );

    expect(result.success).toBe(true);
    expect(syncBundle).toHaveBeenCalledWith({
      url: 'http://central:3100/api/agent/bundles/b-1/download',
      token: 'tok',
      dataDir: '/data',
    });
    const stages = (hooks as any)._progresses.map((p: any) => p.stage);
    expect(stages).toEqual(['config-written', 'bundle-sync', 'bundle-synced', 'build', 'healthcheck']);
  });

  it('bundleUrl 缺失时 fail-fast（success:false 且 stderr 含 bundleUrl）', async () => {
    const syncBundle = vi.fn(async () => {});
    const runner = makeRunner();
    const hooks = makeHooks();
    const { bundleUrl, centralApiUrl, ...noBundle } = baseCmd;
    const result = await handleDeploy(
      noBundle,
      '/data',
      hooks,
      runner,
      new AbortController().signal,
      { syncBundle, agentToken: 'tok' }
    );

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('bundleUrl');
    expect(syncBundle).not.toHaveBeenCalled();
    expect(runner.runCompose).not.toHaveBeenCalled();
  });

  it('bundle 同步失败 → success:false，stderr 含原因，不执行 compose up', async () => {
    const syncBundle = vi.fn(async () => { throw new Error('HTTP 404'); });
    const runner = makeRunner();
    const hooks = makeHooks();
    const result = await handleDeploy(
      baseCmd,
      '/data',
      hooks,
      runner,
      new AbortController().signal,
      { syncBundle, agentToken: 'tok' }
    );

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('bundle sync failed');
    expect(result.stderr).toContain('HTTP 404');
    expect(runner.runCompose).not.toHaveBeenCalled();
  });

  it('cmd.centralApiUrl 缺省时回退到 opts.centralApiUrl', async () => {
    vi.mocked(execa).mockImplementation(async (cmd, args) => {
      if (cmd === 'docker' && args?.[1] === 'ps') {
        return { stdout: '{"Health":"healthy"}', stderr: '', exitCode: 0 } as any;
      }
      return { stdout: '', stderr: '', exitCode: 0 } as any;
    });

    const syncBundle = vi.fn(async () => {});
    const hooks = makeHooks();
    const { centralApiUrl, ...cmdNoApi } = baseCmd;
    const result = await handleDeploy(
      cmdNoApi,
      '/data',
      hooks,
      makeRunner(),
      new AbortController().signal,
      { syncBundle, agentToken: 'tok', centralApiUrl: 'http://fallback:3100' }
    );

    expect(result.success).toBe(true);
    expect(syncBundle).toHaveBeenCalledWith({
      url: 'http://fallback:3100/api/agent/bundles/b-1/download',
      token: 'tok',
      dataDir: '/data',
    });
  });

  it('deploy fails when healthcheck times out', async () => {
    vi.mocked(execa).mockImplementation(async (cmd, args) => {
      if (cmd === 'docker' && args?.[1] === 'ps') {
        // 只有 backend 返回 starting，其他服务健康
        const service = args?.[2];
        if (service === 'backend') {
          return { stdout: '{"Health":"starting"}', stderr: '', exitCode: 0 } as any;
        }
        return { stdout: '{"Health":"healthy"}', stderr: '', exitCode: 0 } as any;
      }
      return { stdout: '', stderr: '', exitCode: 0 } as any;
    });

    const syncBundle = vi.fn(async () => {});
    const hooks = makeHooks();
    const result = await handleDeploy(
      { ...baseCmd, commandId: 'cmd-3' },
      '/data',
      hooks,
      makeRunner(),
      new AbortController().signal,
      { healthcheckIntervalMs: 5, healthcheckMaxAttempts: 2, syncBundle, agentToken: 'tok' }  // 测试用快速超时
    );

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('backend');  // failedService
  });

  it('deploy fails when docker compose up fails', async () => {
    const syncBundle = vi.fn(async () => {});
    const hooks = makeHooks();
    const result = await handleDeploy(
      { ...baseCmd, commandId: 'cmd-5' },
      '/data',
      hooks,
      makeRunner(1),
      new AbortController().signal,
      { syncBundle, agentToken: 'tok' }
    );

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('docker compose up failed');
  });

  it('deploy is aborted when signal is already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const syncBundle = vi.fn(async () => {});
    const hooks = makeHooks();
    const result = await handleDeploy(
      { ...baseCmd, commandId: 'cmd-4' },
      '/data',
      hooks,
      makeRunner(),
      controller.signal,
      { syncBundle, agentToken: 'tok' }
    );
    expect(result.success).toBe(false);
    expect(result.stderr).toMatch(/abort/i);
    expect(syncBundle).not.toHaveBeenCalled();
  });
});
