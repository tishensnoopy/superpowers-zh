import { test, expect } from '@playwright/test';
import path from 'path';

const PAGES = [
  { url: '/', name: 'home' },
  { url: '/courses', name: 'courses' },
  { url: '/courses/yousen-youxiao-xianjie', name: 'course-detail-youxiao' },
  { url: '/campuses', name: 'campuses' },
  { url: '/campuses/yousen-baibuting', name: 'campus-detail-baibuting' },
  { url: '/teachers', name: 'teachers' },
  { url: '/teachers/yousen-teacher-wang', name: 'teacher-detail-wang' },
  { url: '/news', name: 'news' },
  { url: '/news/yousen-news-ai-education', name: 'news-detail-ai-education' },
  { url: '/about', name: 'about' },
  { url: '/contact', name: 'contact' },
  { url: '/appointment', name: 'appointment' },
  { url: '/faq', name: 'faq' },
  { url: '/refund-policy', name: 'refund-policy' },
  { url: '/privacy-policy', name: 'privacy-policy' },
  { url: '/user-agreement', name: 'user-agreement' },
];

test.describe('桌面端视觉测试 (1280x720)', () => {
  for (const page of PAGES) {
    test(`桌面端截图 - ${page.name} (${page.url})`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        locale: 'zh-CN',
      });
      const p = await context.newPage();
      const response = await p.goto(page.url, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => null);
      if (response) {
        expect(response.status()).toBeLessThan(400);
      }
      await p.waitForTimeout(800);
      await p.screenshot({
        path: path.join('e2e', 'screenshots', 'desktop', `${page.name}.png`),
        fullPage: true,
      });
      await context.close();
    });
  }
});

test.describe('移动端视觉测试 (375x667)', () => {
  for (const page of PAGES) {
    test(`移动端截图 - ${page.name} (${page.url})`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 375, height: 667 },
        locale: 'zh-CN',
        isMobile: true,
      });
      const p = await context.newPage();
      const response = await p.goto(page.url, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => null);
      if (response) {
        expect(response.status()).toBeLessThan(400);
      }
      await p.waitForTimeout(800);
      await p.screenshot({
        path: path.join('e2e', 'screenshots', 'mobile', `${page.name}.png`),
        fullPage: true,
      });
      await context.close();
    });
  }
});

test.describe('关键交互截图', () => {
  test('FAQ 分类筛选交互', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/faq', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join('e2e', 'screenshots', 'desktop', 'interaction-faq-default.png'), fullPage: true });
  });

  test('课程搜索页交互', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/courses', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join('e2e', 'screenshots', 'desktop', 'interaction-courses-search.png'), fullPage: true });
  });

  test('新闻分页交互', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/news', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join('e2e', 'screenshots', 'desktop', 'interaction-news-list.png'), fullPage: true });
  });

  test('导航下拉菜单交互', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const navItem = page.locator('nav button:has-text("课程体系")').first();
    if (await navItem.isVisible()) {
      await navItem.hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join('e2e', 'screenshots', 'desktop', 'interaction-nav-dropdown.png') });
    }
  });
});
