import { test, expect } from '@playwright/test';

test.describe('AI 客服 FloatingChat E2E', () => {
  test('首页显示悬浮咨询按钮', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /在线咨询/ })).toBeVisible();
  });

  test('点击按钮打开聊天窗口', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /在线咨询/ }).click();

    // 聊天窗口标题
    await expect(page.getByText('佑森小课堂 AI助手')).toBeVisible();
    // 欢迎消息
    await expect(page.getByText(/您好.*我是佑森小课堂的AI助手/)).toBeVisible();
    // 输入框
    await expect(page.getByPlaceholder(/输入消息/)).toBeVisible();
  });

  test('关闭按钮关闭聊天窗口', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /在线咨询/ }).click();
    await expect(page.getByPlaceholder(/输入消息/)).toBeVisible();

    await page.getByRole('button', { name: /关闭/ }).click();
    await expect(page.getByPlaceholder(/输入消息/)).not.toBeVisible();
  });

  test('输入消息并发送，显示用户消息', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /在线咨询/ }).click();
    await expect(page.getByPlaceholder(/输入消息/)).toBeVisible();

    const input = page.getByPlaceholder(/输入消息/);
    await input.fill('请问课程怎么报名？');
    await page.getByRole('button', { name: /发送/ }).click();

    // 用户消息出现在聊天窗口
    await expect(page.getByText('请问课程怎么报名？')).toBeVisible();
  });

  test('Enter 键发送消息', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /在线咨询/ }).click();
    await expect(page.getByPlaceholder(/输入消息/)).toBeVisible();

    const input = page.getByPlaceholder(/输入消息/);
    await input.fill('你好');
    await input.press('Enter');

    await expect(page.getByText('你好')).toBeVisible();
  });

  test('聊天窗口在所有页面可用', async ({ page }) => {
    // 测试课程页面
    await page.goto('/courses');
    await expect(page.getByRole('button', { name: /在线咨询/ })).toBeVisible();

    // 测试新闻页面
    await page.goto('/news');
    await expect(page.getByRole('button', { name: /在线咨询/ })).toBeVisible();

    // 测试校区页面
    await page.goto('/campuses');
    await expect(page.getByRole('button', { name: /在线咨询/ })).toBeVisible();
  });

  test('发送消息后输入框清空', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /在线咨询/ }).click();
    await expect(page.getByPlaceholder(/输入消息/)).toBeVisible();

    const input = page.getByPlaceholder(/输入消息/);
    await input.fill('测试消息');
    await page.getByRole('button', { name: /发送/ }).click();

    // 输入框应该被清空
    await expect(input).toHaveValue('');
  });

  test('AI 回复流式渲染（如果后端可用）', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /在线咨询/ }).click();
    await expect(page.getByPlaceholder(/输入消息/)).toBeVisible();

    const input = page.getByPlaceholder(/输入消息/);
    await input.fill('你好');
    await page.getByRole('button', { name: /发送/ }).click();

    // 等待 AI 回复（最多 15 秒，后端可能需要时间处理）
    // 如果后端未配置 AI，这个测试可能会超时
    const aiResponse = page.locator('[data-role="assistant"]').last();
    await expect(aiResponse).toBeVisible({ timeout: 15000 });
  });
});
