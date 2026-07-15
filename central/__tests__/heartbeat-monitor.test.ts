import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { markStaleServersOffline } from '@/lib/heartbeat-monitor';

let freshServerId: string;
let staleServerId: string;

beforeAll(async () => {
  const c = await pool.query(`INSERT INTO customers (name) VALUES ('Hb测试') RETURNING id`);
  const customerId = c.rows[0].id;

  const fresh = await pool.query(
    `INSERT INTO customer_servers (customer_id, hostname, status, last_heartbeat)
     VALUES ($1, 'fresh', 'online', now() - interval '3 seconds') RETURNING id`,
    [customerId]
  );
  freshServerId = fresh.rows[0].id;

  const stale = await pool.query(
    `INSERT INTO customer_servers (customer_id, hostname, status, last_heartbeat)
     VALUES ($1, 'stale', 'online', now() - interval '90 seconds') RETURNING id`,
    [customerId]
  );
  staleServerId = stale.rows[0].id;
});

afterAll(async () => {
  await pool.query(`DELETE FROM customer_servers; DELETE FROM customers;`);
  await pool.end();
});

describe('heartbeat-monitor', () => {
  it('marks stale servers as offline', async () => {
    const count = await markStaleServersOffline(60);
    expect(count).toBeGreaterThanOrEqual(1);
    const stale = await pool.query(`SELECT status FROM customer_servers WHERE id=$1`, [staleServerId]);
    expect(stale.rows[0].status).toBe('offline');
  });

  it('does not touch fresh servers', async () => {
    await markStaleServersOffline(60);
    const fresh = await pool.query(`SELECT status FROM customer_servers WHERE id=$1`, [freshServerId]);
    expect(fresh.rows[0].status).toBe('online');
  });

  it('does not touch already-offline servers', async () => {
    const result = await markStaleServersOffline(60);
    const result2 = await markStaleServersOffline(60);
    expect(result2).toBe(0);
  });
});
