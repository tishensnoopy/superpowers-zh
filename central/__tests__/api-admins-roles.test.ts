import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { hashPassword, signJwt } from '@/lib/auth';

let superadminToken: string;
let adminToken: string;
let viewerToken: string;
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
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('superadmin-roles@x.local',$1,'superadmin') RETURNING id`,
    [hash]
  );
  superadminToken = await signJwt({ sub: superadmin.rows[0].id, email: 'superadmin-roles@x.local', role: 'superadmin' });

  const admin = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('admin-roles@x.local',$1,'admin') RETURNING id`,
    [hash]
  );
  adminToken = await signJwt({ sub: admin.rows[0].id, email: 'admin-roles@x.local', role: 'admin' });

  const viewer = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('viewer-roles@x.local',$1,'viewer') RETURNING id`,
    [hash]
  );
  viewerToken = await signJwt({ sub: viewer.rows[0].id, email: 'viewer-roles@x.local', role: 'viewer' });

  const target = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('target-roles@x.local',$1,'admin') RETURNING id`,
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

describe('PATCH /api/admin/admins/[id] - 角色权限编辑', () => {
  it('superadmin 可修改其他管理员的 role', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/admins/${targetAdminId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${superadminToken}` },
      body: JSON.stringify({ role: 'viewer' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe('viewer');
  });

  it('admin 不可修改其他管理员的 role（403）', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/admins/${targetAdminId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ role: 'admin' }),
    });
    expect(res.status).toBe(403);
  });

  it('viewer 不可修改其他管理员的 role（403）', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/admins/${targetAdminId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${viewerToken}` },
      body: JSON.stringify({ role: 'admin' }),
    });
    expect(res.status).toBe(403);
  });

  it('非法 role 值返回 400', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/admins/${targetAdminId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${superadminToken}` },
      body: JSON.stringify({ role: 'invalid-role' }),
    });
    expect(res.status).toBe(400);
  });
});
