import { describe, it, expect } from 'vitest';
import { calculateReconnectDelay } from '../src/connection';

describe('calculateReconnectDelay', () => {
  it('doubles delay each attempt (base values)', () => {
    // base = min(1000 * 2^attempt, 60000), jitter = random * 1000
    // 验证 base 部分（去掉 jitter）
    for (const attempt of [0, 1, 2, 3, 4, 5]) {
      const delay = calculateReconnectDelay(attempt);
      const base = Math.min(1000 * Math.pow(2, attempt), 60000);
      expect(delay).toBeGreaterThanOrEqual(base);
      expect(delay).toBeLessThanOrEqual(base + 1000);
    }
  });

  it('caps at 60000 + jitter', () => {
    const delay = calculateReconnectDelay(6);
    expect(delay).toBeGreaterThanOrEqual(60000);
    expect(delay).toBeLessThanOrEqual(61000);
  });

  it('includes jitter (0-1000ms)', () => {
    for (let i = 0; i < 100; i++) {
      const delay = calculateReconnectDelay(2);
      expect(delay).toBeGreaterThanOrEqual(4000);
      expect(delay).toBeLessThanOrEqual(5000);
    }
  });
});
