import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { hashPassword, signJwt } from '@/lib/auth';

let adminToken: string;
let customerId: string;
let codeId: string;
let codeValue: string;

beforeAll(async () => {
  const hash = await hashPassword('Test123!');
  const u = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('enr@x.local',$1,'admin') RETURNING id`,
    [hash]
  );
  adminToken = await signJwt({ sub: u.rows[0].id, email: 'enr@x.local', role: 'admin' });
  const c = await pool.query(`INSERT INTO customers (name) VALUES ('Enr测试') RETURNING id`);
  customerId = c.rows[0].id;
});

afterAll(async () => {
  await pool.query(`DELETE FROM enrollment_codes; DELETE FROM customers; DELETE FROM admin_users;`);
  await pool.end();
});

describe('POST /api/admin/enrollment-codes', () => {
  it('issues a 24h enrollment code for a customer', async () => {
    const res = await fetch('http://localhost:3000/api/admin/enrollment-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ customerId }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.code).toMatch(/^[A-Z0-9_-]{32}$/);
    expect(body.expires_at).toBeDefined();
    codeId = body.id;
    codeValue = body.code;
  });

  it('revokes an enrollment code', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/enrollment-codes/${codeId}/revoke`, {
      method: 'POST',
      headers: { cookie: `central_admin_session=${adminToken}` },
    });
    expect(res.status).toBe(200);
    const dbRow = await pool.query(`SELECT used_at FROM enrollment_codes WHERE id=$1`, [codeId]);
    // revoke sets used_at to now (so it can't be used)
    expect(dbRow.rows[0].used_at).not.toBeNull();
  });
});
