import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleLogs } from '../src/commands/logs';
import * as composeMod from '../src/lib/compose';
vi.mock('../src/lib/compose');

describe('handleLogs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs docker compose logs --tail N service', async () => {
    const mocked = vi.mocked(composeMod.runCompose);
    const stdoutText = 'line1\nline2\nline3\n';
    // mock 实现：模拟真实 compose 在收到 stdout 时按行触发 onLog 钩子
    mocked.mockImplementation(async (_args, _opts, hooks) => {
      for (const line of stdoutText.split('\n')) {
        if (line) hooks?.onLog('stdout', line);
      }
      return { stdout: stdoutText, stderr: '', exitCode: 0 };
    });
    const onLog = vi.fn();

    const result = await handleLogs(
      { type: 'command:logs', commandId: 'l1', service: 'backend', tail: 100 },
      '/data', { onLog }, undefined
    );

    expect(mocked).toHaveBeenCalledWith(['logs', '--tail', '100', 'backend'], expect.any(Object), { onLog });
    expect(result).toContain('line1');
    expect(onLog).toHaveBeenCalledWith('stdout', 'line1');
    expect(onLog).toHaveBeenCalledWith('stdout', 'line2');
  });
});
