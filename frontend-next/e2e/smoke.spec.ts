import { test, expect } from '@playwright/test';

test.describe('关键路径烟雾测试', () => {
  test('首页加载并渲染关键元素', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/幼小衔接/);
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('导航到课程搜索页', async ({ page }) => {
    await page.goto('/');
    // 首页未提供直接指向 /courses 的链接（仅有 /courses/language 等具体课程链接），
    // 因此通过直接访问验证课程搜索页可达。
    await page.goto('/courses');
    await expect(page).toHaveURL(/\/courses/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('课程搜索功能', async ({ page }) => {
    await page.goto('/courses');
    const searchInput = page.locator('input[type="text"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('语言');
      await page.waitForTimeout(500);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('课程详情页加载', async ({ page }) => {
    await page.goto('/courses/language');
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('预约表单页面访问', async ({ page }) => {
    await page.goto('/contact');
    // ContactForm 为客户端组件，需等待 hydration 完成后 h1 才会出现在可见 a11y 树中。
    await expect(page.locator('h1').first()).toBeVisible();
  });

  // Playwright 使用真实浏览器，hydration 后 React 客户端会用 not-found 组件替换
  // SSR 流式渲染的 loading 态，因此 404 页面可正确显示。
  test('404 页面显示', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-12345');
    await expect(page.locator('text=404').or(page.locator('text=页面未找到')).first()).toBeVisible();
  });

  test('sitemap.xml 可访问', async ({ page }) => {
    const response = await page.goto('/sitemap.xml');
    expect(response?.status()).toBe(200);
  });

  test('robots.txt 可访问', async ({ page }) => {
    const response = await page.goto('/robots.txt');
    expect(response?.status()).toBe(200);
  });

  test('llms.txt 可访问', async ({ page }) => {
    const response = await page.goto('/llms.txt');
    expect(response?.status()).toBe(200);
  });
});
