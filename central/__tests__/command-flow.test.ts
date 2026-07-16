import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { pool } from '@/lib/db';
import { generateEnrollmentCode } from '@/lib/agent-auth';
import { hashPassword, signJwt } from '@/lib/auth';

const CENTRAL_URL = 'http://localhost:3000';
const CENTRAL_WS = 'ws://localhost:3000/api/agent/ws';

let adminToken: string;
let serverId: string;
let agentToken: string;
let agentWs: WebSocket;

beforeAll(async () => {
  const hash = await hashPassword('Test123!');
  const u = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('flow@x.local',$1,'admin') RETURNING id`,
    [hash]
  );
  adminToken = await signJwt({ sub: u.rows[0].id, email: 'flow@x.local', role: 'admin' });

  const c = await pool.query(`INSERT INTO customers (name) VALUES ('Flow测试') RETURNING id`);
  const code = await generateEnrollmentCode(c.rows[0].id);

  const enrollRes = await fetch(`${CENTRAL_URL}/api/agent/enroll`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.10' },
    body: JSON.stringify({ enrollmentCode: code, hostname: 'flow-srv', displayName: 'Flow测试' }),
  });
  const enrollBody = await enrollRes.json();
  serverId = enrollBody.serverId;
  agentToken = enrollBody.agentToken;

  // 建立 ws 连接（模拟 Agent）
  agentWs = new WebSocket(`${CENTRAL_WS}?token=${agentToken}`);
  await new Promise<void>((resolve) => agentWs.on('open', resolve));
  // 发送 register
  agentWs.send(JSON.stringify({ type: 'agent:register', serverId, agentVersion: 'test', hostname: 'flow-srv', dockerVersion: 'test' }));
  await new Promise((r) => setTimeout(r, 500));
});

afterAll(async () => {
  if (agentWs.readyState === WebSocket.OPEN) agentWs.close();
  await pool.query(`TRUNCATE TABLE audit_logs, job_logs, deploy_jobs, agent_tokens, customer_servers, enrollment_codes, customer_configs, customers, admin_users CASCADE;`);
  await pool.end();
});

describe('command flow integration', () => {
  it('admin issues status command, agent responds with result', async () => {
    // Agent 端：监听指令并响应
    const commandReceived = new Promise<any>((resolve) => {
      agentWs.once('message', (raw) => resolve(JSON.parse(raw.toString())));
    });

    // Admin 端：下发指令
    const res = await fetch(`${CENTRAL_URL}/api/admin/servers/${serverId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ type: 'status' }),
    });
    expect(res.status).toBe(202);
    const { jobId } = await res.json();

    // Agent 收到指令
    const cmd = await commandReceived;
    expect(cmd.type).toBe('command:status');
    expect(cmd.commandId).toBe(jobId);

    // Agent 回复 ack
    agentWs.send(JSON.stringify({ type: 'command:ack', commandId: jobId, receivedAt: new Date().toISOString() }));
    // 等 ack 处理完再发 result，避免 ws 消息并发处理导致状态机竞态
    await new Promise((r) => setTimeout(r, 100));

    // Agent 回复 result（成功时必须带 exitCode: 0，否则 job.exit_code 为 null）
    agentWs.send(JSON.stringify({
      type: 'command:result', commandId: jobId, success: true, exitCode: 0,
      stdout: '{"Service":"backend","State":"running"}',
      durationMs: 100,
    }));

    // 等中央写库
    await new Promise((r) => setTimeout(r, 500));

    // Admin 查询 job 详情
    const jobRes = await fetch(`${CENTRAL_URL}/api/admin/jobs/${jobId}`, {
      headers: { cookie: `central_admin_session=${adminToken}` },
    });
    const job = await jobRes.json();
    expect(job.status).toBe('success');
    expect(job.exit_code).toBe(0);
  });

  it('rejects command when agent is offline', async () => {
    // 关闭 agent ws
    agentWs.close();
    await new Promise((r) => setTimeout(r, 1000));  // 等 central 检测到断开

    const res = await fetch(`${CENTRAL_URL}/api/admin/servers/${serverId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ type: 'status' }),
    });
    expect(res.status).toBe(409);  // Agent offline
  });
});
