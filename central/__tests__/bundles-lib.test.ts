import { describe, it, expect, vi } from 'vitest';
import { buildBundle } from '@/lib/bundles';

describe('bundles.buildBundle', () => {
  it('git fetch + git archive 产出 tar.gz，记录 ready 与大小', async () => {
    const execCalls: string[][] = [];
    const execImpl = vi.fn(async (cmd: string, args: string[]) => {
      execCalls.push([cmd, ...args]);
      return { stdout: '', stderr: '' };
    });
    const statImpl = vi.fn(async () => ({ size: 123456 }));
    const queryImpl = vi.fn(async () => ({ rows: [], rowCount: 1 }));
    const mkdirImpl = vi.fn(async () => undefined);

    const result = await buildBundle(
      { id: 'b-1', ref: 'main' },
      { repoPath: '/srv/repo', bundleDir: '/srv/bundles', execImpl, statImpl, queryImpl, mkdirImpl }
    );

    expect(execCalls[0]).toEqual(['git', '-C', '/srv/repo', 'fetch', '--all', '--tags', '--prune']);
    expect(execCalls[1]).toEqual([
      'git', '-C', '/srv/repo', 'archive', '--format=tar.gz',
      '-o', '/srv/bundles/b-1.tar.gz', 'main',
    ]);
    expect(queryImpl).toHaveBeenCalledWith(
      expect.stringContaining("status='ready'"),
      expect.arrayContaining([123456, 'b-1'])
    );
    expect(result).toEqual({ id: 'b-1', path: '/srv/bundles/b-1.tar.gz', sizeBytes: 123456 });
  });

  it('git archive 失败 → 记录 failed + error，抛错', async () => {
    const execImpl = vi.fn()
      .mockResolvedValueOnce({ stdout: '', stderr: '' }) // fetch ok
      .mockRejectedValueOnce(new Error('fatal: Not a valid object name'));
    const queryImpl = vi.fn(async () => ({ rows: [], rowCount: 1 }));
    const mkdirImpl = vi.fn(async () => undefined);

    await expect(
      buildBundle(
        { id: 'b-2', ref: 'no-such-ref' },
        { repoPath: '/srv/repo', bundleDir: '/srv/bundles', execImpl, statImpl: vi.fn(), queryImpl, mkdirImpl }
      )
    ).rejects.toThrow('Not a valid object name');

    expect(queryImpl).toHaveBeenCalledWith(
      expect.stringContaining("status='failed'"),
      expect.arrayContaining(['fatal: Not a valid object name', 'b-2'])
    );
  });
});
