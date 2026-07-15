import { describe, it, expect, beforeEach } from 'vitest';
import { createAbortController, abortCommand, cleanupAbortController } from '../src/lib/abort-registry';

describe('abort-registry', () => {
  beforeEach(() => {
    // 清理可能残留的 controller
    cleanupAbortController('test-cmd');
    cleanupAbortController('test-cmd-2');
  });

  it('createAbortController is idempotent (returns same controller for same commandId)', () => {
    const c1 = createAbortController('test-cmd');
    const c2 = createAbortController('test-cmd');
    expect(c2).toBe(c1);
  });

  it('createAbortController returns independent controllers for different commandIds', () => {
    const c1 = createAbortController('test-cmd');
    const c2 = createAbortController('test-cmd-2');
    expect(c2).not.toBe(c1);
  });

  it('abortCommand returns true and aborts the controller', () => {
    const c = createAbortController('test-cmd');
    expect(c.signal.aborted).toBe(false);
    const result = abortCommand('test-cmd');
    expect(result).toBe(true);
    expect(c.signal.aborted).toBe(true);
  });

  it('abortCommand returns false for non-existent commandId', () => {
    const result = abortCommand('non-existent-cmd');
    expect(result).toBe(false);
  });

  it('abortCommand removes controller from registry (subsequent calls return false)', () => {
    createAbortController('test-cmd');
    expect(abortCommand('test-cmd')).toBe(true);
    expect(abortCommand('test-cmd')).toBe(false);
  });

  it('cleanupAbortController removes controller without aborting', () => {
    const c = createAbortController('test-cmd');
    cleanupAbortController('test-cmd');
    expect(c.signal.aborted).toBe(false);
    // 已从 registry 删除，再次 abort 返回 false
    expect(abortCommand('test-cmd')).toBe(false);
  });

  it('cleanupAbortController is safe for non-existent commandId', () => {
    expect(() => cleanupAbortController('non-existent')).not.toThrow();
  });
});
