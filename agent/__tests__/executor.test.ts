import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execa } from 'execa';
import { executeCommand } from '../src/executor';
import type { Command } from '../src/executor';
import * as composeMod from '../src/lib/compose';
import * as envMod from '../src/lib/env-file';
import { createAbortController, cleanupAbortController } from '../src/lib/abort-registry';

vi.mock('../src/lib/compose');
vi.mock('../src/lib/env-file');
vi.mock('execa');

describe('executeCommand dispatch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dispatches config-sync command', async () => {
    const mockedRunCompose = vi.mocked(composeMod.runCompose);
    mockedRunCompose.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    vi.mocked(envMod.writeEnvFile).mockImplementation(() => {});

    const hooks = { onProgress: vi.fn(), onLog: vi.fn() };
    await executeCommand({
      type: 'command:config-sync',
      commandId: 'c1',
      envVars: { FOO: 'bar', BAZ: 'qux' },
      restart: true,
    }, hooks);

    expect(envMod.writeEnvFile).toHaveBeenCalledWith(expect.any(String), { FOO: 'bar', BAZ: 'qux' });
    expect(hooks.onProgress).toHaveBeenCalledWith('config-written', expect.any(String));
    expect(mockedRunCompose).toHaveBeenCalledWith(
      ['restart', 'backend', 'frontend'],
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('cancel returns "no running task" when no controller exists', async () => {
    cleanupAbortController('cancel-noop');
    const result = await executeCommand(
      { type: 'command:cancel', commandId: 'cancel-noop' },
      { onProgress: vi.fn(), onLog: vi.fn() }
    );
    expect(result).toBe('no running task');
  });

  it('cancel returns "cancelled" when a running controller exists', async () => {
    createAbortController('cancel-active');
    const result = await executeCommand(
      { type: 'command:cancel', commandId: 'cancel-active' },
      { onProgress: vi.fn(), onLog: vi.fn() }
    );
    expect(result).toBe('cancelled');
  });

  it('throws on unknown command type', async () => {
    await expect(executeCommand({ type: 'unknown', commandId: 'x' } as any, { onProgress: vi.fn(), onLog: vi.fn() }))
      .rejects.toThrow(/unknown command type/i);
  });
});

describe('executor deploy command', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dispatches command:deploy to handleDeploy', async () => {
    vi.mocked(execa).mockImplementation(async (cmd, args) => {
      if (cmd === 'git') return { stdout: 'Fast-forward', stderr: '', exitCode: 0 } as any;
      if (cmd === 'docker' && args?.[1] === 'ps') return { stdout: '{"Health":"healthy"}', stderr: '', exitCode: 0 } as any;
      return { stdout: '', stderr: '', exitCode: 0 } as any;
    });
    // runCompose 被 vi.mock('../src/lib/compose') 自动 mock，需设置返回值
    vi.mocked(composeMod.runCompose).mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    const cmd: Command = {
      commandId: 'exec-deploy-1',
      type: 'command:deploy',
      jobId: 'job-exec-1',
      imageTag: 'unused',
      mode: 'direct',
    };
    const result = await executeCommand(cmd, {
      onLog: () => {},
      onProgress: () => {},
    });

    expect(result).toBeDefined();
    expect(result).toMatch(/deploy completed/);
  });

  it('returns "no running task" for command:cancel with no running task', async () => {
    const cmd: Command = {
      commandId: 'exec-cancel-1',
      type: 'command:cancel',
    };
    const result = await executeCommand(cmd, { onLog: () => {}, onProgress: () => {} });
    expect(result).toBe('no running task');
  });
});
