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
