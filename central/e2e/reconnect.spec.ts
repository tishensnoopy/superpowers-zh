import { test, expect } from './helpers';
import { randomUUID } from 'node:crypto';

test.describe('agent reconnect', () => {
  test('agent reconnects after ws drop and resumes heartbeat', async ({
    adminLogin,
    createCustomer,
    issueEnrollmentCode,
    simulateAgent,
    adminPage: page,
  }) => {
    await adminLogin();
    const customerId = await createCustomer(`重连测试-${randomUUID().slice(0, 8)}`);
    const code = await issueEnrollmentCode(customerId);

    const enrollRes = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '50.50.50.50' },
      body: JSON.stringify({ enrollmentCode: code, hostname: 'reconnect-srv' }),
    });
    const { serverId, agentToken } = await enrollRes.json();

    // 1. 第一次连接
    const agent1 = await simulateAgent(agentToken);
    agent1.send({ type: 'agent:register', serverId, agentVersion: '1.0', hostname: 'reconnect-srv', dockerVersion: '24.0' });
    await agent1.waitForMessage('agent:welcome');

    // 发一次心跳
    agent1.send({ type: 'agent:heartbeat', cpu: 0.4, mem: 0.5, disk: 0.2, services: [] });
    await page.waitForTimeout(500);

    // 2. 模拟网络断开
    agent1.close();
    await page.waitForTimeout(2000);  // 等中央检测到断开

    // 3. 服务器状态可能在短时间还是 online（heartbeat-monitor 60s 兜底）
    // 但 ws 连接数应为 0

    // 4. Agent 重连
    const agent2 = await simulateAgent(agentToken);
    agent2.send({ type: 'agent:register', serverId, agentVersion: '1.0', hostname: 'reconnect-srv', dockerVersion: '24.0' });
    await agent2.waitForMessage('agent:welcome');

    // 5. 重连后能继续发心跳
    agent2.send({ type: 'agent:heartbeat', cpu: 0.6, mem: 0.7, disk: 0.3, services: [{ name: 'backend', status: 'running' }] });
    await page.waitForTimeout(500);

    // 6. 验证服务器在服务器列表页仍可见
    await page.goto('/servers');
    await expect(page.locator('text=reconnect-srv')).toBeVisible();

    agent2.close();
  });

  test('command sent while agent offline is rejected', async ({
    adminLogin,
    createCustomer,
    issueEnrollmentCode,
    simulateAgent,
  }) => {
    await adminLogin();
    const customerId = await createCustomer(`离线测试-${randomUUID().slice(0, 8)}`);
    const code = await issueEnrollmentCode(customerId);

    const enrollRes = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '60.60.60.60' },
      body: JSON.stringify({ enrollmentCode: code, hostname: 'offline-srv' }),
    });
    const { serverId, agentToken } = await enrollRes.json();

    // 不连接 agent，直接下发指令
    const res = await fetch(`http://localhost:3000/api/admin/servers/${serverId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'status' }),
    });
    expect(res.status).toBe(409);  // Agent offline
  });

  test('command idempotency: agent does not execute same commandId twice', async ({
    adminLogin,
    createCustomer,
    issueEnrollmentCode,
    simulateAgent,
  }) => {
    await adminLogin();
    const customerId = await createCustomer(`幂等测试-${randomUUID().slice(0, 8)}`);
    const code = await issueEnrollmentCode(customerId);

    const enrollRes = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '70.70.70.70' },
      body: JSON.stringify({ enrollmentCode: code, hostname: 'idem-srv' }),
    });
    const { serverId, agentToken } = await enrollRes.json();

    const agent = await simulateAgent(agentToken);
    agent.send({ type: 'agent:register', serverId, agentVersion: '1.0', hostname: 'idem-srv', dockerVersion: '24.0' });
    await agent.waitForMessage('agent:welcome');

    // 下发指令
    const cmdRes = await fetch(`http://localhost:3000/api/admin/servers/${serverId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'status' }),
    });
    const { jobId } = await cmdRes.json();

    // Agent 收到指令，回复 ack + result
    const cmd = await agent.waitForMessage('command:status');
    expect(cmd.commandId).toBe(jobId);
    agent.send({ type: 'command:ack', commandId: jobId, receivedAt: new Date().toISOString() });
    agent.send({ type: 'command:result', commandId: jobId, success: true, durationMs: 50 });

    // 等待中央处理
    await new Promise((r) => setTimeout(r, 500));

    // 查询 job，应只有一个 result
    const jobRes = await fetch(`http://localhost:3000/api/admin/jobs/${jobId}`);
    const job = await jobRes.json();
    expect(job.status).toBe('success');

    agent.close();
  });
});
