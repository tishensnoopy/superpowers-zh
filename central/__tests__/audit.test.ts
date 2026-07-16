import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { writeAuditLog, listAuditLogs } from '@/lib/audit';

let adminId: string;

beforeAll(async () => {
  const u = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('audit@x.local','x','admin') RETURNING id`
  );
  adminId = u.rows[0].id;
});

afterAll(async () => {
  await pool.query(`TRUNCATE TABLE audit_logs, job_logs, deploy_jobs, agent_tokens, customer_servers, enrollment_codes, customer_configs, customers, admin_users CASCADE;`);
  await pool.end();
});

describe('audit', () => {
  it('writeAuditLog inserts a row with all fields', async () => {
    const row = await writeAuditLog({
      adminId,
      action: 'customer:create',
      targetType: 'customer',
      targetId: 'cust-123',
      ip: '127.0.0.1',
      userAgent: 'vitest',
      detail: { name: '测试客户' },
    });
    expect(row.id).toBeDefined();
    expect(row.action).toBe('customer:create');
    expect(row.target_id).toBe('cust-123');
    expect(row.detail).toEqual({ name: '测试客户' });
  });

  it('writeAuditLog works without optional fields', async () => {
    const row = await writeAuditLog({
      adminId,
      action: 'login',
    });
    expect(row.action).toBe('login');
    expect(row.target_type).toBeNull();
  });

  it('listAuditLogs returns recent logs with pagination', async () => {
    // 写入 3 条
    for (let i = 0; i < 3; i++) {
      await writeAuditLog({ adminId, action: 'test:iter' });
    }
    const page1 = await listAuditLogs({ limit: 2, offset: 0 });
    expect(page1.items.length).toBe(2);
    expect(page1.total).toBeGreaterThanOrEqual(3);
    const page2 = await listAuditLogs({ limit: 2, offset: 2 });
    expect(page2.items.length).toBeGreaterThanOrEqual(1);
  });

  it('listAuditLogs filters by adminId', async () => {
    const other = await pool.query(
      `INSERT INTO admin_users (email, password_hash, role) VALUES ('other-audit@x.local','x','admin') RETURNING id`
    );
    await writeAuditLog({ adminId: other.rows[0].id, action: 'login' });
    const filtered = await listAuditLogs({ adminId });
    for (const item of filtered.items) {
      expect(item.admin_id).toBe(adminId);
    }
  });

  it('listAuditLogs filters by target', async () => {
    await writeAuditLog({ adminId, action: 'config:publish', targetType: 'config', targetId: 'cfg-filter-1' });
    const filtered = await listAuditLogs({ targetType: 'config', targetId: 'cfg-filter-1' });
    expect(filtered.items.length).toBeGreaterThanOrEqual(1);
    for (const item of filtered.items) {
      expect(item.target_id).toBe('cfg-filter-1');
    }
  });
});
