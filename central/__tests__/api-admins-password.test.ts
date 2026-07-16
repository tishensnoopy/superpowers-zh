import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { hashPassword, signJwt, verifyPassword } from '@/lib/auth';

let superadminToken: string;
let adminToken: string;
let targetAdminId: string;

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
  await pool.query(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ`);
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

  const hash = await hashPassword('Test123!');
  const superadmin = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('superadmin-pw@x.local',$1,'superadmin') RETURNING id`,
    [hash]
  );
  superadminToken = await signJwt({ sub: superadmin.rows[0].id, email: 'superadmin-pw@x.local', role: 'superadmin' });

  const admin = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('admin-pw@x.local',$1,'admin') RETURNING id`,
    [hash]
  );
  adminToken = await signJwt({ sub: admin.rows[0].id, email: 'admin-pw@x.local', role: 'admin' });

  const target = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('target-pw@x.local',$1,'admin') RETURNING id, password_hash`,
    [hash]
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

describe('POST /api/admin/admins/[id]/reset-password', () => {
  it('superadmin 可重置其他管理员密码', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/admins/${targetAdminId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${superadminToken}` },
      body: JSON.stringify({ newPassword: 'NewPass456!' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const dbRes = await pool.query<{ password_hash: string }>(
      'SELECT password_hash FROM admin_users WHERE id=$1',
      [targetAdminId]
    );
    expect(await verifyPassword('NewPass456!', dbRes.rows[0].password_hash)).toBe(true);
  });

  it('admin 不可重置其他管理员密码（403）', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/admins/${targetAdminId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ newPassword: 'Another789!' }),
    });
    expect(res.status).toBe(403);
  });

  it('密码少于 8 字符返回 400', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/admins/${targetAdminId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${superadminToken}` },
      body: JSON.stringify({ newPassword: 'short' }),
    });
    expect(res.status).toBe(400);
  });

  it('目标管理员不存在返回 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await fetch(`http://localhost:3000/api/admin/admins/${fakeId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${superadminToken}` },
      body: JSON.stringify({ newPassword: 'ValidPass123!' }),
    });
    expect(res.status).toBe(404);
  });
});
