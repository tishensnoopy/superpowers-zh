import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, resetRateLimits, getLockStatus } from '@/lib/rate-limit';

beforeEach(() => {
  resetRateLimits();
  vi.useFakeTimers();
});

describe('rate-limit', () => {
  it('allows requests under the limit', () => {
    const result1 = checkRateLimit('1.2.3.4', 'enroll', { maxAttempts: 3, windowMs: 5 * 60 * 1000 });
    const result2 = checkRateLimit('1.2.3.4', 'enroll', { maxAttempts: 3, windowMs: 5 * 60 * 1000 });
    expect(result1.allowed).toBe(true);
    expect(result2.allowed).toBe(true);
  });

  it('blocks requests after exceeding maxAttempts in window', () => {
    const opts = { maxAttempts: 3, windowMs: 5 * 60 * 1000 };
    checkRateLimit('1.2.3.4', 'enroll', opts);
    checkRateLimit('1.2.3.4', 'enroll', opts);
    checkRateLimit('1.2.3.4', 'enroll', opts);
    const result = checkRateLimit('1.2.3.4', 'enroll', opts);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('max_attempts_exceeded');
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('resets attempts after window expires', () => {
    const opts = { maxAttempts: 2, windowMs: 60_000 };
    checkRateLimit('1.2.3.4', 'enroll', opts);
    checkRateLimit('1.2.3.4', 'enroll', opts);
    expect(checkRateLimit('1.2.3.4', 'enroll', opts).allowed).toBe(false);

    // 推进时间超过 window
    vi.advanceTimersByTime(61_000);
    expect(checkRateLimit('1.2.3.4', 'enroll', opts).allowed).toBe(true);
  });

  it('tracks different keys independently', () => {
    const opts = { maxAttempts: 1, windowMs: 60_000 };
    expect(checkRateLimit('1.1.1.1', 'enroll', opts).allowed).toBe(true);
    expect(checkRateLimit('2.2.2.2', 'enroll', opts).allowed).toBe(true);
    expect(checkRateLimit('1.1.1.1', 'enroll', opts).allowed).toBe(false);
    expect(checkRateLimit('2.2.2.2', 'enroll', opts).allowed).toBe(false);
  });

  it('lockIp locks for lockoutMs', () => {
    const opts = { maxAttempts: 3, windowMs: 5 * 60 * 1000, lockoutMs: 60 * 60 * 1000 };
    // 3 次失败后锁定 1 小时
    checkRateLimit('9.9.9.9', 'enroll', opts);
    checkRateLimit('9.9.9.9', 'enroll', opts);
    checkRateLimit('9.9.9.9', 'enroll', opts);
    const blocked = checkRateLimit('9.9.9.9', 'enroll', opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe('locked');

    const status = getLockStatus('9.9.9.9', 'enroll');
    expect(status.locked).toBe(true);
    expect(status.unlockAt).toBeDefined();

    // 推进 1 小时
    vi.advanceTimersByTime(60 * 60 * 1000 + 1000);
    const afterLock = checkRateLimit('9.9.9.9', 'enroll', opts);
    expect(afterLock.allowed).toBe(true);
  });

  it('separate namespaces are independent', () => {
    const opts = { maxAttempts: 1, windowMs: 60_000 };
    expect(checkRateLimit('1.1.1.1', 'enroll', opts).allowed).toBe(true);
    expect(checkRateLimit('1.1.1.1', 'login', opts).allowed).toBe(true);
    expect(checkRateLimit('1.1.1.1', 'enroll', opts).allowed).toBe(false);
    expect(checkRateLimit('1.1.1.1', 'login', opts).allowed).toBe(false);
  });
});
