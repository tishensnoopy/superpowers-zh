import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { hashPassword, signJwt } from '@/lib/auth';
import { decrypt } from '@/lib/encryption';

let adminToken: string;
let customerId: string;
let configId: string;

beforeAll(async () => {
  process.env.AES_KEY = Buffer.alloc(32, 1).toString('base64');
  const hash = await hashPassword('Test123!');
  const u = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('cfg@x.local',$1,'admin') RETURNING id`,
    [hash]
  );
  adminToken = await signJwt({ sub: u.rows[0].id, email: 'cfg@x.local', role: 'admin' });
  const c = await pool.query(`INSERT INTO customers (name) VALUES ('Cfg测试') RETURNING id`);
  customerId = c.rows[0].id;
});

afterAll(async () => {
  await pool.query(`TRUNCATE TABLE audit_logs, job_logs, deploy_jobs, agent_tokens, customer_servers, enrollment_codes, customer_configs, customers, admin_users CASCADE;`);
  await pool.end();
});

describe('POST /api/admin/configs', () => {
  it('creates v1 config with encrypted dashscopeKey', async () => {
    const res = await fetch('http://localhost:3000/api/admin/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({
        customerId,
        brand: { brandName: '客户A' },
        ai: { dashscopeKey: 'sk-secret-xxx', model: 'qwen-plus' },
        deployment: { mode: 'nginx' },
        envOverrides: { DATABASE_PASSWORD: 'changeme' },
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.version).toBe(1);
    configId = body.id;

    // 验证 db 中 ai.dashscopeKey 是密文
    const dbRow = await pool.query(`SELECT ai FROM customer_configs WHERE id=$1`, [configId]);
    const aiField = dbRow.rows[0].ai;
    expect(aiField.dashscopeKey).toMatch(/^enc:/);
    expect(decrypt(aiField.dashscopeKey)).toBe('sk-secret-xxx');
  });

  it('creates v2 config for same customer', async () => {
    const res = await fetch('http://localhost:3000/api/admin/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ customerId, brand: { brandName: '客户A v2' }, ai: {}, deployment: {} }),
    });
    expect(res.status).toBe(201);
    expect((await res.json()).version).toBe(2);
  });

  it('publishes a config (sets published_at, blocks further PATCH)', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/configs/${configId}/publish`, {
      method: 'POST',
      headers: { cookie: `central_admin_session=${adminToken}` },
    });
    expect(res.status).toBe(200);

    const patch = await fetch(`http://localhost:3000/api/admin/configs/${configId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ brand: { brandName: 'changed' } }),
    });
    expect(patch.status).toBe(409);
  });
});
