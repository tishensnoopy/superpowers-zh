import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '@/lib/db';
import { hashPassword, signJwt } from '@/lib/auth';

let adminToken: string;
let testCustomerId: string;

beforeAll(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL, contact_name TEXT, contact_phone TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
  const hash = await hashPassword('Test123!');
  const r = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('test@x.local',$1,'superadmin') RETURNING id`,
    [hash]
  );
  adminToken = await signJwt({ sub: r.rows[0].id, email: 'test@x.local', role: 'superadmin' });
});

afterAll(async () => {
  await pool.query(`DELETE FROM customers; DELETE FROM admin_users;`);
  await pool.end();
});

describe('POST /api/admin/customers', () => {
  it('creates a customer', async () => {
    const res = await fetch('http://localhost:3000/api/admin/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ name: '客户A', contactName: '张三', contactPhone: '13800138000' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toMatch(/^[0-9a-f-]+$/);
    expect(body.name).toBe('客户A');
    testCustomerId = body.id;
  });
});
