import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFetch, mockWriteFile } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockWriteFile: vi.fn(),
}));

global.fetch = mockFetch as any;

vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
  writeFileSync: mockWriteFile,
  existsSync: vi.fn(() => false),
}));

import { performEnrollment } from '../src/register';

describe('performEnrollment', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('posts to /api/agent/enroll and writes agent.env', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ serverId: 'srv-123', agentToken: 'tok-abc' }),
    });

    const result = await performEnrollment({
      centralApiUrl: 'https://central.example.com',
      enrollmentCode: 'CODE123',
      hostname: 'srv-1',
      displayName: '生产1',
      envFile: '/tmp/agent.env',
    });

    expect(result).toEqual({ serverId: 'srv-123', agentToken: 'tok-abc' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://central.example.com/api/agent/enroll',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentCode: 'CODE123', hostname: 'srv-1', displayName: '生产1' }),
      })
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/tmp/agent.env',
      expect.stringContaining('AGENT_TOKEN=tok-abc'),
      expect.anything()
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/tmp/agent.env',
      expect.stringContaining('SERVER_ID=srv-123'),
      expect.anything()
    );
  });

  it('throws on invalid enrollment code', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 401,
      json: async () => ({ error: 'Invalid or expired enrollment code' }),
    });
    await expect(performEnrollment({
      centralApiUrl: 'https://central.example.com',
      enrollmentCode: 'BAD', hostname: 'srv-1', displayName: '', envFile: '/tmp/agent.env',
    })).rejects.toThrow('Invalid or expired enrollment code');
  });
});
