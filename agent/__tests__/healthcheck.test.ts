import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitForServicesHealthy, checkServiceHealthy } from '../src/lib/healthcheck';
import { execa } from 'execa';

vi.mock('execa');

describe('healthcheck', () => {
  beforeEach(() => vi.clearAllMocks());

  it('checkServiceHealthy returns true when docker compose ps reports healthy', async () => {
    vi.mocked(execa).mockResolvedValue({
      stdout: '{"Service":"backend","Health":"healthy"}',
      stderr: '',
      exitCode: 0,
    } as any);
    const ok = await checkServiceHealthy('backend', { cwd: '/data', timeoutMs: 1000 });
    expect(ok).toBe(true);
  });

  it('checkServiceHealthy returns false on unhealthy', async () => {
    vi.mocked(execa).mockResolvedValue({
      stdout: '{"Service":"backend","Health":"unhealthy"}',
      stderr: '',
      exitCode: 0,
    } as any);
    const ok = await checkServiceHealthy('backend', { cwd: '/data', timeoutMs: 1000 });
    expect(ok).toBe(false);
  });

  it('waitForServicesHealthy returns true when all services healthy in order', async () => {
    vi.mocked(execa).mockResolvedValue({
      stdout: '{"Health":"healthy"}',
      stderr: '',
      exitCode: 0,
    } as any);
    const result = await waitForServicesHealthy(
      ['postgres', 'redis', 'meilisearch', 'backend', 'frontend'],
      { cwd: '/data', intervalMs: 10, maxAttempts: 3, onProgress: () => {} }
    );
    expect(result.ok).toBe(true);
  });

  it('waitForServicesHealthy returns false with timeout when service stays unhealthy', async () => {
    vi.mocked(execa).mockResolvedValue({
      stdout: '{"Health":"starting"}',
      stderr: '',
      exitCode: 0,
    } as any);
    const result = await waitForServicesHealthy(
      ['backend'],
      { cwd: '/data', intervalMs: 10, maxAttempts: 2, onProgress: () => {} }
    );
    expect(result.ok).toBe(false);
    expect(result.failedService).toBe('backend');
  });

  it('waitForServicesHealthy calls onProgress with each attempt', async () => {
    vi.mocked(execa).mockResolvedValue({ stdout: '{"Health":"healthy"}', stderr: '', exitCode: 0 } as any);
    const progress: Array<{ service: string; attempt: number; healthy: boolean }> = [];
    await waitForServicesHealthy(
      ['backend'],
      { cwd: '/data', intervalMs: 5, maxAttempts: 1, onProgress: (p) => progress.push(p) }
    );
    expect(progress.length).toBe(1);
    expect(progress[0]).toEqual({ service: 'backend', attempt: 1, healthy: true });
  });
});
