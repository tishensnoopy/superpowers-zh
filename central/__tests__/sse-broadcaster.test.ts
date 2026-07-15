import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addSSEClient,
  removeSSEClient,
  broadcastToJob,
  broadcastJobUpdate,
  broadcastJobLog,
  broadcastJobProgress,
  __resetSSEClients,
} from '@/lib/sse-broadcaster';

// 模拟 WritableStreamDefaultWriter（Next.js Route Handler 用 ReadableStream）
function makeClient() {
  const write = vi.fn();
  const close = vi.fn();
  const writer = { write, close, closed: false };
  return { writer, write, close };
}

describe('sse-broadcaster', () => {
  beforeEach(() => __resetSSEClients());

  it('addSSEClient subscribes a client to a job', () => {
    const { writer, write } = makeClient();
    addSSEClient('job-1', writer as any);
    broadcastToJob('job-1', 'test-event', { foo: 'bar' });
    expect(write).toHaveBeenCalled();
  });

  it('broadcastToJob sends SSE-formatted data to all subscribers of a job', () => {
    const c1 = makeClient();
    const c2 = makeClient();
    addSSEClient('job-2', c1.writer as any);
    addSSEClient('job-2', c2.writer as any);
    broadcastToJob('job-2', 'log', { line: 'hello' });
    expect(c1.write).toHaveBeenCalled();
    expect(c2.write).toHaveBeenCalled();
    // 验证 SSE 格式：event: ...\ndata: ...\n\n
    const arg = c1.write.mock.calls[0][0];
    const decoded = new TextDecoder().decode(arg);
    expect(decoded).toContain('event: log');
    expect(decoded).toContain('data: ');
    expect(decoded.endsWith('\n\n')).toBe(true);
  });

  it('removeSSEClient removes subscription', () => {
    const c = makeClient();
    addSSEClient('job-3', c.writer as any);
    removeSSEClient('job-3', c.writer as any);
    broadcastToJob('job-3', 'log', {});
    expect(c.write).not.toHaveBeenCalled();
  });

  it('broadcastJobUpdate sends job:update event', () => {
    const c = makeClient();
    addSSEClient('job-4', c.writer as any);
    broadcastJobUpdate('job-4', { status: 'success' });
    const arg = c.write.mock.calls[0][0];
    const decoded = new TextDecoder().decode(arg);
    expect(decoded).toContain('event: job:update');
    expect(decoded).toContain('"status":"success"');
  });

  it('broadcastJobLog sends job:log event', () => {
    const c = makeClient();
    addSSEClient('job-5', c.writer as any);
    broadcastJobLog('job-5', { stream: 'stdout', line: 'Building...' });
    const arg = c.write.mock.calls[0][0];
    const decoded = new TextDecoder().decode(arg);
    expect(decoded).toContain('event: job:log');
    expect(decoded).toContain('"stream":"stdout"');
  });

  it('broadcastJobProgress sends job:progress event', () => {
    const c = makeClient();
    addSSEClient('job-6', c.writer as any);
    broadcastJobProgress('job-6', { stage: 'build', message: 'Building images' });
    const arg = c.write.mock.calls[0][0];
    const decoded = new TextDecoder().decode(arg);
    expect(decoded).toContain('event: job:progress');
    expect(decoded).toContain('"stage":"build"');
  });

  it('does not throw when broadcasting to job with no subscribers', () => {
    expect(() => broadcastToJob('job-empty', 'log', {})).not.toThrow();
  });
});
