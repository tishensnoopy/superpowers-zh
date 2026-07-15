import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeCommand } from '../src/executor';
import * as composeMod from '../src/lib/compose';
import * as envMod from '../src/lib/env-file';

vi.mock('../src/lib/compose');
vi.mock('../src/lib/env-file');

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

  it('throws on unknown command type', async () => {
    await expect(executeCommand({ type: 'unknown', commandId: 'x' } as any, { onProgress: vi.fn(), onLog: vi.fn() }))
      .rejects.toThrow(/unknown command type/i);
  });
});
