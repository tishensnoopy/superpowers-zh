import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execa } from 'execa';
import { pullLatest } from '../src/lib/git-pull';
import { handleDeploy } from '../src/commands/deploy';
import type { CommandHandler } from '../src/executor';

vi.mock('execa');
vi.mock('../src/lib/env-file');

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
      { runCompose: async () => { return { stdout: '', stderr: '', exitCode: 0 } as any; } } as any,
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
        // 只有 backend 返回 starting，其他服务健康
        const service = args?.[2];
        if (service === 'backend') {
          return { stdout: '{"Health":"starting"}', stderr: '', exitCode: 0 } as any;
        }
        return { stdout: '{"Health":"healthy"}', stderr: '', exitCode: 0 } as any;
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
