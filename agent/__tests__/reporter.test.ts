import { describe, it, expect } from 'vitest';
import { collectHeartbeatData } from '../src/reporter';

describe('collectHeartbeatData', () => {
  it('returns cpu/mem/disk as numbers in [0,1] or positive', () => {
    const data = collectHeartbeatData();
    expect(typeof data.cpu).toBe('number');
    expect(data.cpu).toBeGreaterThanOrEqual(0);
    expect(typeof data.mem).toBe('number');
    expect(data.mem).toBeGreaterThan(0);
    expect(data.mem).toBeLessThanOrEqual(1);
    expect(typeof data.disk).toBe('number');
    expect(data.disk).toBeGreaterThan(0);
    expect(data.disk).toBeLessThanOrEqual(1);
  });

  it('returns empty services array (M2 has no docker inspection)', () => {
    const data = collectHeartbeatData();
    expect(Array.isArray(data.services)).toBe(true);
  });
});
