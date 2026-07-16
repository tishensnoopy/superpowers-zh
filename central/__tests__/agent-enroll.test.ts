import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { generateEnrollmentCode, consumeEnrollmentCode } from '@/lib/agent-auth';
import { resetRateLimits } from '@/lib/rate-limit';

let customerId: string;
let code: string;

beforeAll(async () => {
  const c = await pool.query(`INSERT INTO customers (name) VALUES ('Enroll测试') RETURNING id`);
  customerId = c.rows[0].id;
  code = await generateEnrollmentCode(customerId);
});

afterAll(async () => {
  await pool.query(`DELETE FROM enrollment_codes; DELETE FROM agent_tokens; DELETE FROM customer_servers; DELETE FROM customers;`);
  await pool.end();
});

describe('POST /api/agent/enroll', () => {
  // 每个测试使用不同 IP，避免触发 rate-limit（maxAttempts=3）
  it('rejects missing fields', async () => {
    const res = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.1' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('rejects invalid enrollment code', async () => {
    const res = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.2' },
      body: JSON.stringify({ enrollmentCode: 'INVALID', hostname: 'srv-1' }),
    });
    expect(res.status).toBe(401);
  });

  it('creates a server and returns token for valid code', async () => {
    const res = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.3' },
      body: JSON.stringify({ enrollmentCode: code, hostname: 'srv-1', displayName: '生产1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.serverId).toMatch(/^[0-9a-f-]+$/);
    expect(body.agentToken).toMatch(/^[A-Za-z0-9_-]{40}$/);
    const codeRow = await pool.query(`SELECT used_at FROM enrollment_codes WHERE code=$1`, [code]);
    expect(codeRow.rows[0].used_at).not.toBeNull();
  });

  it('rejects already-used code', async () => {
    const res = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.4' },
      body: JSON.stringify({ enrollmentCode: code, hostname: 'srv-2' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('enrollment brute-force protection', () => {
  beforeAll(() => {
    resetRateLimits();
  });

  it('locks IP after 3 failed attempts within 5 minutes', async () => {
    // 3 次失败（用无效 code），每次都消耗 IP 限流额度
    for (let i = 0; i < 3; i++) {
      await fetch('http://localhost:3000/api/agent/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '6.6.6.6' },
        body: JSON.stringify({ enrollmentCode: 'BAD', hostname: 'srv-x' }),
      });
    }
    // 第 4 次应被 IP 限流拦截
    const res = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '6.6.6.6' },
      body: JSON.stringify({ enrollmentCode: 'BAD', hostname: 'srv-x' }),
    });
    expect(res.status).toBe(429);
  });

  it('consumes enrollment code once, second call returns null', async () => {
    const freshCode = await generateEnrollmentCode(customerId);
    const first = await consumeEnrollmentCode(freshCode);
    expect(first).not.toBeNull();
    expect(first!.customerId).toBe(customerId);
    const second = await consumeEnrollmentCode(freshCode);
    expect(second).toBeNull();
  });

  it('rejects hostname with shell metacharacters', async () => {
    const freshCode = await generateEnrollmentCode(customerId);
    const res = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '7.7.7.7' },
      body: JSON.stringify({ enrollmentCode: freshCode, hostname: 'srv;rm -rf /' }),
    });
    expect(res.status).toBe(400);
  });
});
