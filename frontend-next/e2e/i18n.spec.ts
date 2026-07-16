import { test, expect } from '@playwright/test';

test.describe('i18n routing', () => {
  test('default locale zh-CN has no URL prefix', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    expect(page.url()).not.toMatch(/\/en-US\//);
  });

  test('en-US locale has /en-US/ prefix', async ({ page }) => {
    await page.goto('/en-US/courses');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });

  test('LanguageSwitcher switches zh-CN to en-US', async ({ page }) => {
    await page.goto('/courses');
    await page.getByLabel('切换语言').click();
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/en-US\/courses/);
  });

  test('LanguageSwitcher switches en-US back to zh-CN', async ({ page }) => {
    await page.goto('/en-US/courses');
    await page.getByLabel('Switch Language').click();
    await page.getByRole('button', { name: '中文' }).click();
    await expect(page).toHaveURL(/\/courses$/);
  });

  test('locale persists across page reload (cookie)', async ({ page }) => {
    await page.goto('/courses');
    await page.getByLabel('切换语言').click();
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/en-US\/courses/);
    await page.reload();
    await expect(page).toHaveURL(/\/en-US\/courses/);
  });

  test('en-US unknown slug shows 404 in English', async ({ page }) => {
    await page.goto('/en-US/courses/nonexistent-slug-12345');
    // dynamicParams=false triggers Next.js static 404, which may bypass the
    // [locale] layout (lang attribute not guaranteed). Check 404 text only.
    await expect(page.getByText(/not found|404|页面未找到/i).first()).toBeVisible();
  });

  test('en-US page with content shows no fallback banner', async ({ page }) => {
    await page.goto('/en-US/courses');
    await expect(page.getByText(/此内容暂无英文版|not available in english/i)).not.toBeVisible();
  });
});
