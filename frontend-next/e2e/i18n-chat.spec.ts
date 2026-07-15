import { test, expect } from '@playwright/test';

test.describe('i18n AI customer service', () => {
  test('FloatingChat on en-US page responds in English', async ({ page }) => {
    // Mock DashScope to return English response
    await page.route('**/api/chat/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: 'test-session-id',
          visitorId: 'test-visitor-id',
        }),
      });
    });

    await page.route('**/api/chat/message', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'answer',
          content: 'Here is your answer in English.',
          retrievedDocs: 1,
          isRelevant: true,
        }),
      });
    });

    await page.goto('/en-US');
    await page.getByRole('button', { name: /consult|在线咨询/i }).click();
    await page.getByPlaceholder(/type your question/i).fill('What courses do you have?');
    await page.getByPlaceholder(/type your question/i).press('Enter');

    await expect(page.getByText('Here is your answer in English.')).toBeVisible({ timeout: 10000 });
  });

  test('FloatingChat on zh-CN page responds in Chinese', async ({ page }) => {
    await page.route('**/api/chat/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: 'test-session-id',
          visitorId: 'test-visitor-id',
        }),
      });
    });

    await page.route('**/api/chat/message', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'answer',
          content: '这是中文回复。',
          retrievedDocs: 1,
          isRelevant: true,
        }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: /在线咨询|consult/i }).click();
    await page.getByPlaceholder(/请输入您的问题/i).fill('有哪些课程？');
    await page.getByPlaceholder(/请输入您的问题/i).press('Enter');

    await expect(page.getByText('这是中文回复。')).toBeVisible({ timeout: 10000 });
  });
});
