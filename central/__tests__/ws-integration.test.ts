import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { pool } from '@/lib/db';
import { generateEnrollmentCode } from '@/lib/agent-auth';

const CENTRAL_URL = 'http://localhost:3000';
const CENTRAL_WS = 'ws://localhost:3000/api/agent/ws';

let customerId: string;
let serverId: string;
let agentToken: string;

beforeAll(async () => {
  const c = await pool.query(`INSERT INTO customers (name) VALUES ('WS集成测试') RETURNING id`);
  customerId = c.rows[0].id;
  const code = await generateEnrollmentCode(customerId);

  const res = await fetch(`${CENTRAL_URL}/api/agent/enroll`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrollmentCode: code, hostname: 'ws-test', displayName: 'WS测试' }),
  });
  const body = await res.json();
  serverId = body.serverId;
  agentToken = body.agentToken;
});

afterAll(async () => {
  await pool.query(`DELETE FROM agent_tokens; DELETE FROM customer_servers; DELETE FROM enrollment_codes; DELETE FROM customers;`);
  await pool.end();
});

describe('WebSocket integration', () => {
  it('connects with valid token and receives welcome', async () => {
    const ws = new WebSocket(`${CENTRAL_WS}?token=${agentToken}`);
    const welcome = await new Promise<any>((resolve, reject) => {
      ws.on('message', (raw) => resolve(JSON.parse(raw.toString())));
      ws.on('error', reject);
      setTimeout(() => reject(new Error('timeout')), 5000);
    });
    expect(welcome.type).toBe('agent:welcome');
    expect(welcome.serverId).toBe(serverId);
    ws.close();
  });

  it('rejects connection without token', async () => {
    const ws = new WebSocket(CENTRAL_WS);
    await new Promise<void>((resolve) => {
      ws.on('error', () => resolve());
      ws.on('close', () => resolve());
    });
  });

  it('receives agent:register and updates db status to online', async () => {
    const ws = new WebSocket(`${CENTRAL_WS}?token=${agentToken}`);
    await new Promise<void>((resolve) => ws.on('open', resolve));

    ws.send(JSON.stringify({
      type: 'agent:register',
      serverId, agentVersion: '0.1.0-test', hostname: 'ws-test', dockerVersion: 'Docker 24.0',
    }));

    await new Promise((r) => setTimeout(r, 500));
    const row = await pool.query(`SELECT status, agent_version FROM customer_servers WHERE id=$1`, [serverId]);
    expect(row.rows[0].status).toBe('online');
    expect(row.rows[0].agent_version).toBe('0.1.0-test');
    ws.close();
  });

  it('updates last_heartbeat on agent:heartbeat message', async () => {
    const ws = new WebSocket(`${CENTRAL_WS}?token=${agentToken}`);
    await new Promise<void>((resolve) => ws.on('open', resolve));

    ws.send(JSON.stringify({
      type: 'agent:heartbeat', cpu: 0.5, mem: 0.6, disk: 0.3, services: [],
    }));

    await new Promise((r) => setTimeout(r, 500));
    const row = await pool.query(`SELECT last_heartbeat, meta FROM customer_servers WHERE id=$1`, [serverId]);
    expect(row.rows[0].last_heartbeat).not.toBeNull();
    expect(JSON.parse(row.rows[0].meta).cpu).toBe(0.5);
    ws.close();
  });
});
