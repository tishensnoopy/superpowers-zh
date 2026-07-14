import { test, expect } from '@playwright/test';

test.describe('i18n SEO hreflang', () => {
  test('zh-CN courses page has hreflang link to en-US', async ({ page }) => {
    await page.goto('/courses');
    const enLink = page.locator('link[rel="alternate"][hreflang="en-US"]');
    await expect(enLink).toHaveAttribute('href', /\/en-US\/courses$/);
  });

  test('en-US courses page has hreflang link to zh-CN', async ({ page }) => {
    await page.goto('/en-US/courses');
    const zhLink = page.locator('link[rel="alternate"][hreflang="zh-CN"]');
    await expect(zhLink).toHaveAttribute('href', /\/courses$/);
  });

  test('sitemap.xml contains both zh-CN and en-US URLs', async ({ page }) => {
    const response = await page.request.get('/sitemap.xml');
    const xml = await response.text();
    expect(xml).toContain('/courses');
    expect(xml).toContain('/en-US/courses');
  });

  test('llms.txt contains bilingual content', async ({ page }) => {
    const response = await page.request.get('/llms.txt');
    const text = await response.text();
    expect(text).toContain('Yousen Education');
    expect(text).toContain('/en-US/');
  });
});
