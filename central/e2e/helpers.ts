import { test as base, expect, type Page } from '@playwright/test';
import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';

/**
 * E2E 测试夹具：
 * - adminLogin: 用 admin 账号登录并保存 cookie
 * - createCustomer: 创建客户并返回 customerId
 * - issueEnrollmentCode: 为客户颁发 enrollment code
 * - simulateAgent: 启动一个模拟 Agent ws 连接，返回控制对象
 */
interface HelperFixtures {
  adminLogin: (email?: string, password?: string) => Promise<void>;
  adminPage: Page;
  createCustomer: (name: string) => Promise<string>;
  issueEnrollmentCode: (customerId: string) => Promise<string>;
  simulateAgent: (token: string) => Promise<AgentController>;
}

interface AgentController {
  ws: WebSocket;
  waitForMessage: (type: string, timeoutMs?: number) => Promise<any>;
  send: (msg: any) => void;
  close: () => void;
}

export const test = base.extend<HelperFixtures>({
  adminPage: async ({ page }, use) => {
    await use(page);
  },
  adminLogin: async ({ page, context }, use) => {
    await use(async (email = 'admin@yousen.local', password = 'Admin123!') => {
      await page.goto('/login');
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/customers');
    });
  },
  createCustomer: async ({ page }, use) => {
    await use(async (name: string) => {
      await page.goto('/customers');
      await page.click('text=新增客户');
      await page.fill('input[name="name"]', name);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/customers\/[^/]+$/);
      const url = page.url();
      return url.split('/').pop()!;
    });
  },
  issueEnrollmentCode: async ({ page, request }, use) => {
    await use(async (customerId: string) => {
      // 调用 API 直接颁发（需要 admin cookie）
      const res = await request.post(`/api/admin/customers/${customerId}/enrollment-codes`, {
        headers: { 'Content-Type': 'application/json' },
      });
      const body = await res.json();
      return body.code as string;
    });
  },
  simulateAgent: async ({}, use) => {
    const agents: WebSocket[] = [];
    await use(async (token: string) => {
      const ws = new WebSocket(`ws://localhost:3000/api/agent/ws?token=${token}`);
      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });
      agents.push(ws);

      const pendingMessages: any[] = [];
      const waiters: Array<{ type: string; resolve: (msg: any) => void; timer: NodeJS.Timeout }> = [];

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        const idx = waiters.findIndex((w) => w.type === msg.type);
        if (idx >= 0) {
          clearTimeout(waiters[idx].timer);
          waiters[idx].resolve(msg);
          waiters.splice(idx, 1);
        } else {
          pendingMessages.push(msg);
        }
      });

      const controller: AgentController = {
        ws,
        waitForMessage: (type: string, timeoutMs = 5000) => {
          const idx = pendingMessages.findIndex((m) => m.type === type);
          if (idx >= 0) return Promise.resolve(pendingMessages.splice(idx, 1)[0]);
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), timeoutMs);
            waiters.push({ type, resolve, timer });
          });
        },
        send: (msg: any) => ws.send(JSON.stringify(msg)),
        close: () => {
          if (ws.readyState === WebSocket.OPEN) ws.close();
        },
      };
      return controller;
    });
    // 测试后清理所有 agent 连接
    for (const ws of agents) {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    }
  },
});

export { expect };
