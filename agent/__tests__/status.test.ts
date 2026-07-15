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
