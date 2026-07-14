import { test, expect } from '@playwright/test';

test.describe('AI 客服增强功能', () => {
  test('浮动按钮在首页可见', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /在线咨询/ })).toBeVisible();
  });

  test('打开聊天窗口并显示标题与输入框', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /在线咨询/ }).click();

    // 聊天窗口标题
    await expect(page.getByText('佑森小课堂 AI助手')).toBeVisible();
    // 欢迎消息
    await expect(page.getByText(/您好.*我是佑森小课堂的AI助手/)).toBeVisible();
    // 输入框
    await expect(page.getByPlaceholder(/输入消息/)).toBeVisible();
  });

  test('输入超过 500 字符时显示错误提示', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /在线咨询/ }).click();
    await expect(page.getByPlaceholder(/输入消息/)).toBeVisible();

    const textarea = page.getByPlaceholder(/输入消息/);
    // textarea 有 maxLength=500 属性，浏览器会阻止直接输入超过 500 字符
    // 通过原生 setter 绕过 maxLength 限制，触发 ChatInput 的长度校验逻辑
    await page.evaluate(() => {
      const textarea = document.querySelector('textarea');
      if (!textarea) return;
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;
      nativeSetter?.call(textarea, 'a'.repeat(501));
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // 按 Enter 触发发送
    await textarea.press('Enter');

    // 等待错误提示出现（ChatInput 显示"消息不能超过 500 字符"）
    await expect(page.getByText(/不能超过.*500/)).toBeVisible({ timeout: 5000 });
  });

  test('正常长度的消息可以发送', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /在线咨询/ }).click();
    await expect(page.getByPlaceholder(/输入消息/)).toBeVisible();

    const input = page.getByPlaceholder(/输入消息/);
    await input.fill('你好');
    await input.press('Enter');

    // 用户消息出现在聊天窗口
    await expect(page.getByText('你好')).toBeVisible();
    // 输入框应该被清空
    await expect(input).toHaveValue('');
  });

  test('聊天窗口可以关闭', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /在线咨询/ }).click();
    await expect(page.getByText('佑森小课堂 AI助手')).toBeVisible();

    // 点击关闭按钮
    await page.getByRole('button', { name: /关闭/ }).click();

    // 验证聊天窗口已关闭，浮动按钮重新可见
    await expect(page.getByRole('button', { name: /在线咨询/ })).toBeVisible();
  });

  test('浮动按钮在多个页面可见', async ({ page }) => {
    const pages = ['/courses', '/about', '/contact', '/news'];
    for (const url of pages) {
      await page.goto(url);
      await expect(page.getByRole('button', { name: /在线咨询/ })).toBeVisible({ timeout: 10000 });
    }
  });
});
