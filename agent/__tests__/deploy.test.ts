import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execa } from 'execa';
import { pullLatest } from '../src/lib/git-pull';

vi.mock('execa');

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
