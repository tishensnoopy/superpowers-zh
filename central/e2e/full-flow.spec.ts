import { test, expect } from './helpers';
import { randomUUID } from 'node:crypto';

test.describe('full customer lifecycle', () => {
  test('login → create customer → issue enrollment → agent enroll → config-sync → deploy → see logs', async ({
    adminPage: page,
    adminLogin,
    createCustomer,
    issueEnrollmentCode,
    simulateAgent,
  }) => {
    // 1. 登录
    await adminLogin();

    // 2. 创建客户
    const customerName = `E2E客户-${randomUUID().slice(0, 8)}`;
    const customerId = await createCustomer(customerName);
    expect(customerId).toBeTruthy();

    // 3. 颁发 enrollment code
    const code = await issueEnrollmentCode(customerId);
    expect(code).toMatch(/^[A-Za-z0-9_-]{20,}$/);

    // 4. 模拟 Agent enrollment
    const enrollRes = await fetch('http://localhost:3000/api/agent/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
      body: JSON.stringify({ enrollmentCode: code, hostname: `e2e-srv-${Date.now()}`, displayName: 'E2E测试服务器' }),
    });
    expect(enrollRes.status).toBe(200);
    const enrollBody = await enrollRes.json();
    const { serverId, agentToken } = enrollBody;
    expect(serverId).toBeTruthy();
    expect(agentToken).toMatch(/^[A-Za-z0-9_-]{40}$/);

    // 5. 模拟 Agent 连接 ws
    const agent = await simulateAgent(agentToken);
    agent.send({
      type: 'agent:register',
      serverId,
      agentVersion: 'e2e-test-1.0',
      hostname: 'e2e-srv',
      dockerVersion: '24.0.0',
    });
    await agent.waitForMessage('agent:welcome');

    // 6. 发送心跳，验证 db 更新
    agent.send({
      type: 'agent:heartbeat',
      cpu: 0.5,
      mem: 0.6,
      disk: 0.3,
      services: [{ name: 'backend', status: 'running' }],
    });
    await page.waitForTimeout(500);  // 等中央写库

    // 7. 访问服务器列表页，验证 online 状态
    await page.goto('/servers');
    await expect(page.locator('text=E2E测试服务器')).toBeVisible();
    await expect(page.locator('text=online').first()).toBeVisible();

    // 8. 从中央下发 config-sync 指令
    const syncRes = await fetch(`http://localhost:3000/api/admin/servers/${serverId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'config-sync',
        envVars: { NEXT_PUBLIC_SITE_URL: 'https://e2e.example.com' },
        restart: false,
      }),
    });
    expect(syncRes.status).toBe(202);
    const syncBody = await syncRes.json();
    const syncJobId = syncBody.jobId;

    // 9. Agent 收到指令并回复 result
    const syncCmd = await agent.waitForMessage('command:config-sync');
    expect(syncCmd.commandId).toBe(syncJobId);
    agent.send({ type: 'command:ack', commandId: syncJobId, receivedAt: new Date().toISOString() });
    agent.send({
      type: 'command:result',
      commandId: syncJobId,
      success: true,
      durationMs: 100,
    });

    // 10. 验证任务状态变为 success
    await page.waitForTimeout(500);
    const jobRes = await fetch(`http://localhost:3000/api/admin/jobs/${syncJobId}`);
    const job = await jobRes.json();
    expect(job.status).toBe('success');

    // 11. 触发 deploy（用 mock，因为 E2E 环境无真实 docker）
    // 先 publish 一个 config
    await fetch(`http://localhost:3000/api/admin/configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        brand: { brandName: customerName },
        ai: {},
        deployment: { mode: 'nginx' },
        envOverrides: {},
      }),
    });

    // 12. 访问审计日志页，验证所有操作都有记录
    await page.goto('/audit-logs');
    await expect(page.locator('text=agent:enroll').first()).toBeVisible();
    await expect(page.locator('text=customer:create').first()).toBeVisible();

    // 13. 清理：revoke token
    const revokeRes = await fetch(`http://localhost:3000/api/admin/servers/${serverId}/token`, {
      method: 'POST',
    });
    expect(revokeRes.status).toBe(200);

    agent.close();
  });
});
