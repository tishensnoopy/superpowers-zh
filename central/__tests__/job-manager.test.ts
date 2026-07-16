import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { createJob, updateJobStatus, getJob, markStaleJobsFailed } from '@/lib/job-manager';

let serverId: string;
let adminId: string;

beforeAll(async () => {
  const c = await pool.query(`INSERT INTO customers (name) VALUES ('Job测试') RETURNING id`);
  const s = await pool.query(`INSERT INTO customer_servers (customer_id, hostname) VALUES ($1,'job-srv') RETURNING id`, [c.rows[0].id]);
  const a = await pool.query(`INSERT INTO admin_users (email, password_hash, role) VALUES ('job@x.local','x','admin') RETURNING id`);
  serverId = s.rows[0].id;
  adminId = a.rows[0].id;
});

afterAll(async () => {
  await pool.query(`TRUNCATE TABLE audit_logs, job_logs, deploy_jobs, agent_tokens, customer_servers, enrollment_codes, customer_configs, customers, admin_users CASCADE;`);
  await pool.end();
});

describe('job-manager', () => {
  it('creates a job in queued status', async () => {
    const job = await createJob({ serverId, type: 'restart', triggeredBy: adminId });
    expect(job.status).toBe('queued');
    expect(job.type).toBe('restart');
  });

  it('transitions queued → running → success', async () => {
    const job = await createJob({ serverId, type: 'config-sync', triggeredBy: adminId });
    await updateJobStatus(job.id, 'running');
    await updateJobStatus(job.id, 'success', { exitCode: 0 });
    const updated = await getJob(job.id);
    expect(updated.status).toBe('success');
    expect(updated.exit_code).toBe(0);
    expect(updated.finished_at).not.toBeNull();
  });

  it('rejects invalid status transition', async () => {
    const job = await createJob({ serverId, type: 'restart', triggeredBy: adminId });
    await updateJobStatus(job.id, 'running');
    await expect(updateJobStatus(job.id, 'queued')).rejects.toThrow(/invalid transition/);
  });

  it('marks stale running jobs as failed (5min timeout)', async () => {
    const job = await createJob({ serverId, type: 'status', triggeredBy: adminId });
    await pool.query(`UPDATE deploy_jobs SET status='running', started_at=now() - interval '6 minutes' WHERE id=$1`, [job.id]);
    const count = await markStaleJobsFailed(300000);
    expect(count).toBeGreaterThanOrEqual(1);
    const updated = await getJob(job.id);
    expect(updated.status).toBe('failed');
    expect(updated.error_message).toContain('timeout');
  });
});
