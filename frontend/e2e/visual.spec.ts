import { test, expect } from '@playwright/test';
import { setupApiMocks } from './mocks/routeHandlers';

test.describe('@visual 视觉回归测试', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('首页完整截图', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo(0, 0));

    await expect(page).toHaveScreenshot('homepage-full.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('首页 Hero 区域截图', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const heroSection = page.locator('[data-testid="hero-section"]');
    await expect(heroSection).toHaveScreenshot('homepage-hero.png', {
      maxDiffPixels: 50,
    });
  });

  test('首页优势区域截图', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const advantagesSection = page.locator('[data-testid="advantages-section"]');
    await expect(advantagesSection).toHaveScreenshot('homepage-advantages.png', {
      maxDiffPixels: 50,
    });
  });

  test('首页课程区域截图', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const productGridSection = page.locator('[data-testid="product-grid-section"]');
    await expect(productGridSection).toHaveScreenshot('homepage-product-grid.png', {
      maxDiffPixels: 50,
    });
  });

  test('导航栏截图', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const navbar = page.locator('nav');
    await expect(navbar).toHaveScreenshot('navbar.png', {
      maxDiffPixels: 20,
    });
  });

  test('FAQ 区域截图', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const faqSection = page.locator('[data-testid="faq-section"]');
    await expect(faqSection).toHaveScreenshot('homepage-faq.png', {
      maxDiffPixels: 50,
    });
  });

  test('预约表单区域截图', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const contactFormSection = page.locator('[data-testid="contact-form-section"]');
    await expect(contactFormSection).toHaveScreenshot('homepage-contact-form.png', {
      maxDiffPixels: 50,
    });
  });

  test('页脚截图', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const footer = page.locator('footer');
    await expect(footer).toHaveScreenshot('footer.png', {
      maxDiffPixels: 20,
    });
  });

  test('课程中心页面截图', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('courses-page.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('FAQ 页面截图', async ({ page }) => {
    await page.goto('/faq');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('faq-page.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('移动端首页截图', async ({ page, viewport }) => {
    if (viewport?.width !== 393) return;

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('mobile-homepage.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });
});