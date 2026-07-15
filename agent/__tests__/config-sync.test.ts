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
