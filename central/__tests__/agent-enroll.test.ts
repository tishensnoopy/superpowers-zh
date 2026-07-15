import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { generateEnrollmentCode } from '@/lib/agent-auth';

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
  it('rejects missing fields', async () => {
    const res = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('rejects invalid enrollment code', async () => {
    const res = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enrollmentCode: 'INVALID', hostname: 'srv-1' }),
    });
    expect(res.status).toBe(401);
  });

  it('creates a server and returns token for valid code', async () => {
    const res = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enrollmentCode: code, hostname: 'srv-1', displayName: '生产1' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.serverId).toMatch(/^[0-9a-f-]+$/);
    expect(body.agentToken).toMatch(/^[A-Za-z0-9_-]{40}$/);
    const codeRow = await pool.query(`SELECT used_at FROM enrollment_codes WHERE code=$1`, [code]);
    expect(codeRow.rows[0].used_at).not.toBeNull();
  });

  it('rejects already-used code', async () => {
    const res = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enrollmentCode: code, hostname: 'srv-2' }),
    });
    expect(res.status).toBe(401);
  });
});
