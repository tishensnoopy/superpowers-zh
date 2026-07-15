import { test, expect } from '@playwright/test';

test.describe('首页', () => {
  test('渲染所有 section', async ({ page }) => {
    await page.goto('/');

    // Hero section
    await expect(page.locator('h1').first()).toBeVisible();

    // 导航栏
    await expect(page.locator('header nav')).toBeVisible();

    // Footer
    await expect(page.locator('footer')).toBeVisible();
  });

  test('meta 标签正确', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/幼小衔接/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /.+/,
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      /.+/,
    );
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
      'content',
      'website',
    );
  });

  test('JSON-LD 结构化数据存在', async ({ page }) => {
    await page.goto('/');
    const jsonLd = page.locator('script[type="application/ld+json"]');
    // 5B-1 SEO 在首页添加了多个 JSON-LD（Organization + WebSite），至少 1 个即可
    const count = await jsonLd.count();
    expect(count).toBeGreaterThanOrEqual(1);
    const content = await jsonLd.first().textContent();
    expect(content).toBeTruthy();
    const parsed = JSON.parse(content!);
    expect(parsed['@type']).toBeTruthy();
  });

  test('FloatingButton 可见', async ({ page }) => {
    await page.goto('/');
    // FloatingChat 在折叠态渲染为 <button aria-label="在线咨询">（见 components/chat/FloatingChat.tsx），
    // 不是 div 容器。使用 aria-label 精确定位，避免与 Navigation header 的 z-50 冲突。
    const floatingButton = page.locator('button[aria-label="在线咨询"]');
    await expect(floatingButton).toBeVisible();
  });
});

test.describe('合规页面', () => {
  test('退费政策页面', async ({ page }) => {
    await page.goto('/refund-policy');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveTitle(/退费/);
  });

  test('隐私政策页面', async ({ page }) => {
    await page.goto('/privacy-policy');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveTitle(/隐私/);
  });

  test('用户协议页面', async ({ page }) => {
    await page.goto('/user-agreement');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveTitle(/用户协议|协议/);
  });
});
