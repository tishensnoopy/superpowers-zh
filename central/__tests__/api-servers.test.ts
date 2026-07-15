import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { hashPassword, signJwt } from '@/lib/auth';

let adminToken: string;
let customerId: string;
let serverId: string;

beforeAll(async () => {
  const hash = await hashPassword('Test123!');
  const u = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('srv@x.local',$1,'admin') RETURNING id`,
    [hash]
  );
  adminToken = await signJwt({ sub: u.rows[0].id, email: 'srv@x.local', role: 'admin' });
  const c = await pool.query(`INSERT INTO customers (name) VALUES ('Srv测试') RETURNING id`);
  customerId = c.rows[0].id;
});

afterAll(async () => {
  await pool.query(`DELETE FROM customer_servers; DELETE FROM customers; DELETE FROM admin_users;`);
  await pool.end();
});

describe('POST /api/admin/servers', () => {
  it('creates a server under a customer', async () => {
    const res = await fetch('http://localhost:3000/api/admin/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ customerId, hostname: 'prod-1', displayName: '生产服务器1' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.hostname).toBe('prod-1');
    expect(body.status).toBe('offline');
    serverId = body.id;
  });
});
