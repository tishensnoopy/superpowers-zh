import { test, expect } from '@playwright/test';

test.describe('i18n visual regression', () => {
  test('en-US desktop homepage', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en-US');
    await expect(page).toHaveScreenshot('en-US-homepage-desktop.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      mask: [
        page.locator('button[aria-label="在线咨询"], button[aria-label="Online consultation"]'),
        page.locator('[data-testid="social-links"]'),
      ],
    });
  });

  test('en-US mobile homepage', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/en-US');
    await expect(page).toHaveScreenshot('en-US-homepage-mobile.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      mask: [
        page.locator('button[aria-label="在线咨询"], button[aria-label="Online consultation"]'),
        page.locator('[data-testid="social-links"]'),
      ],
    });
  });

  test('en-US courses page desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en-US/courses');
    await expect(page).toHaveScreenshot('en-US-courses-desktop.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      mask: [
        page.locator('button[aria-label="在线咨询"], button[aria-label="Online consultation"]'),
        page.locator('[data-testid="social-links"]'),
      ],
    });
  });

  test('LanguageSwitcher expanded state', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.getByLabel('切换语言').click();
    await expect(page).toHaveScreenshot('language-switcher-expanded.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    });
  });
});
