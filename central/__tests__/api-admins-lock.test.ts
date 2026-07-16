import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { hashPassword, signJwt } from '@/lib/auth';

let superadminToken: string;
let adminToken: string;
let targetAdminId: string;
let targetEmail: string;

beforeAll(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      locked BOOLEAN NOT NULL DEFAULT false,
      locked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

  const hash = await hashPassword('Test123!');
  const superadmin = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('superadmin-lock@x.local',$1,'superadmin') RETURNING id`,
    [hash]
  );
  superadminToken = await signJwt({ sub: superadmin.rows[0].id, email: 'superadmin-lock@x.local', role: 'superadmin' });

  const admin = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('admin-lock@x.local',$1,'admin') RETURNING id`,
    [hash]
  );
  adminToken = await signJwt({ sub: admin.rows[0].id, email: 'admin-lock@x.local', role: 'admin' });

  targetEmail = 'target-lock@x.local';
  const target = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ($1,$2,'admin') RETURNING id`,
    [targetEmail, hash]
  );
  targetAdminId = target.rows[0].id;
});

afterAll(async () => {
  await pool.query(
    `DELETE FROM audit_logs WHERE admin_id IN (SELECT id FROM admin_users WHERE email LIKE '%@x.local');`
  );
  await pool.query(`DELETE FROM admin_users WHERE email LIKE '%@x.local';`);
  await pool.end();
});

describe('POST /api/admin/admins/[id]/lock', () => {
  it('superadmin 可锁定其他管理员', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/admins/${targetAdminId}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${superadminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const dbRes = await pool.query<{ locked: boolean }>(
      'SELECT locked FROM admin_users WHERE id=$1',
      [targetAdminId]
    );
    expect(dbRes.rows[0].locked).toBe(true);
  });

  it('admin 不可锁定其他管理员（403）', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/admins/${targetAdminId}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('锁定后该用户无法登录', async () => {
    const res = await fetch('http://localhost:3000/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail, password: 'Test123!' }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('锁定');
  });

  it('superadmin 可解锁', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/admins/${targetAdminId}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${superadminToken}` },
    });
    expect(res.status).toBe(200);

    const dbRes = await pool.query<{ locked: boolean }>(
      'SELECT locked FROM admin_users WHERE id=$1',
      [targetAdminId]
    );
    expect(dbRes.rows[0].locked).toBe(false);
  });

  it('解锁后可正常登录', async () => {
    const res = await fetch('http://localhost:3000/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail, password: 'Test123!' }),
    });
    expect(res.status).toBe(200);
  });
});
