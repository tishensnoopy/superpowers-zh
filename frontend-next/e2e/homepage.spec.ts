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
    await expect(jsonLd).toHaveCount(1);
    const content = await jsonLd.textContent();
    expect(content).toBeTruthy();
    const parsed = JSON.parse(content!);
    expect(parsed['@type']).toBeTruthy();
  });

  test('FloatingButton 可见', async ({ page }) => {
    await page.goto('/');
    // FloatingButton 渲染为 div.fixed.z-50 容器内的 button（见 components/sections/FloatingButton.tsx），
    // 没有 href 属性。这里通过外层固定定位容器定位，该 class 组合在首页中唯一标识 FloatingButton。
    const floatingButton = page.locator('div.fixed.z-50').first();
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
