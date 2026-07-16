/**
 * 内存级限流器。按 (key, namespace) 维度统计请求数。
 *
 * 行为：
 * - 当窗口内尝试次数 >= maxAttempts 时阻止请求。
 * - 若未指定 lockoutMs：仅窗口内阻止（reason='max_attempts_exceeded'），
 *   窗口过期后自动重置。
 * - 若指定 lockoutMs：超限时锁定 lockoutMs（reason='locked'），
 *   锁定期间所有请求被拒，锁定过期后重置。
 *
 * 适用场景：enrollment 防爆破、admin login 防爆破。
 * 不适用于分布式部署（多进程内存不共享）—— 中央管理后台单机部署已足够。
 */

interface AttemptRecord {
  attempts: number[];
  lockedUntil?: number;
}

const store = new Map<string, AttemptRecord>();

function makeKey(key: string, namespace: string): string {
  return `${namespace}:${key}`;
}

export interface RateLimitOptions {
  maxAttempts: number;
  windowMs: number;
  lockoutMs?: number; // 可选；指定后超限将锁定 lockoutMs，未指定则仅窗口内阻止
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: 'max_attempts_exceeded' | 'locked';
  remainingAttempts?: number;
  retryAfterMs?: number;
}

export function checkRateLimit(key: string, namespace: string, opts: RateLimitOptions): RateLimitResult {
  const k = makeKey(key, namespace);
  const now = Date.now();

  let record = store.get(k);
  if (!record) {
    record = { attempts: [] };
    store.set(k, record);
  }

  // 检查是否已锁定
  if (record.lockedUntil && now < record.lockedUntil) {
    return {
      allowed: false,
      reason: 'locked',
      retryAfterMs: record.lockedUntil - now,
    };
  }

  // 锁定已过期，重置
  if (record.lockedUntil && now >= record.lockedUntil) {
    record.attempts = [];
    record.lockedUntil = undefined;
  }

  // 清理窗口外的尝试
  const windowStart = now - opts.windowMs;
  record.attempts = record.attempts.filter((t) => t > windowStart);

  // 检查是否超过窗口内最大尝试次数
  if (record.attempts.length >= opts.maxAttempts) {
    if (opts.lockoutMs) {
      // 指定 lockoutMs：锁定并返回 locked
      record.lockedUntil = now + opts.lockoutMs;
      return {
        allowed: false,
        reason: 'locked',
        retryAfterMs: opts.lockoutMs,
      };
    }
    // 未指定 lockoutMs：仅窗口内阻止，retryAfterMs 为最旧尝试到期时间
    const oldestAttempt = record.attempts[0];
    return {
      allowed: false,
      reason: 'max_attempts_exceeded',
      retryAfterMs: oldestAttempt + opts.windowMs - now,
    };
  }

  // 记录本次尝试
  record.attempts.push(now);

  return {
    allowed: true,
    remainingAttempts: opts.maxAttempts - record.attempts.length,
  };
}

export interface LockStatus {
  locked: boolean;
  unlockAt?: number;
}

export function getLockStatus(key: string, namespace: string): LockStatus {
  const k = makeKey(key, namespace);
  const record = store.get(k);
  if (!record || !record.lockedUntil) return { locked: false };
  const now = Date.now();
  if (now >= record.lockedUntil) return { locked: false };
  return { locked: true, unlockAt: record.lockedUntil };
}

/** 成功时清空尝试记录（用于 login 成功后重置） */
export function clearAttempts(key: string, namespace: string): void {
  const k = makeKey(key, namespace);
  store.delete(k);
}

/** 测试用：清空所有记录 */
export function resetRateLimits(): void {
  store.clear();
}
