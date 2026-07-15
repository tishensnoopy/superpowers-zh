import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { hashAgentToken, verifyAgentToken, generateAgentToken } from '@/lib/agent-auth';

let serverId: string;

beforeAll(async () => {
  const c = await pool.query(`INSERT INTO customers (name) VALUES ('Tok测试') RETURNING id`);
  const s = await pool.query(
    `INSERT INTO customer_servers (customer_id, hostname) VALUES ($1,'tok-srv') RETURNING id`,
    [c.rows[0].id]
  );
  serverId = s.rows[0].id;
});

afterAll(async () => {
  await pool.query(`DELETE FROM agent_tokens; DELETE FROM customer_servers; DELETE FROM customers;`);
  await pool.end();
});

describe('agent-auth', () => {
  it('hashes tokens with SHA-256', () => {
    const hash = hashAgentToken('my-secret-token');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe('my-secret-token');
  });

  it('verifies a valid, non-revoked token and returns server row', async () => {
    const token = await generateAgentToken(serverId);
    expect(token).toMatch(/^[A-Za-z0-9_-]{40}$/);
    const row = await verifyAgentToken(token);
    expect(row).not.toBeNull();
    expect(row!.id).toBe(serverId);
  });

  it('returns null for unknown token', async () => {
    const row = await verifyAgentToken('nonexistent-token-xxx');
    expect(row).toBeNull();
  });

  it('returns null for revoked token', async () => {
    const token = await generateAgentToken(serverId);
    await pool.query(`UPDATE agent_tokens SET revoked_at=now() WHERE token_hash=$1`, [hashAgentToken(token)]);
    const row = await verifyAgentToken(token);
    expect(row).toBeNull();
  });

  it('updates last_used_at on successful verify', async () => {
    const token = await generateAgentToken(serverId);
    await verifyAgentToken(token);
    const r = await pool.query(`SELECT last_used_at FROM agent_tokens WHERE token_hash=$1`, [hashAgentToken(token)]);
    expect(r.rows[0].last_used_at).not.toBeNull();
  });
});
