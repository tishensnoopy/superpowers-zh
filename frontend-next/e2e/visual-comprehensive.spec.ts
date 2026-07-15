import { test, expect, type Page } from '@playwright/test';

/**
 * 真正的视觉回归测试（Visual Regression Testing）
 *
 * 使用 Playwright 的 toHaveScreenshot() 断言：
 * 1. 首次运行：自动生成 baseline 图像
 * 2. 后续运行：与 baseline 像素级对比，差异超过阈值则失败
 *
 * 生成/更新 baseline：npx playwright test visual-comprehensive --update-snapshots
 */

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

/**
 * 动态元素 mask 清单 — 这些元素在视觉对比时会被屏蔽（覆盖为纯色块）
 *
 * 1. FloatingChat 浮动按钮：layout.tsx 全局挂载，所有页面都有，
 *    位置 fixed bottom-6 right-6，含 hover:scale-105 动画
 * 2. Footer 二维码区域：使用外部 API api.qrserver.com 生成，
 *    每次请求可能有像素级差异；用 data-testid="social-links" 定位
 */
const DYNAMIC_MASK_SELECTORS = [
  'button[aria-label="在线咨询"]',
  '[data-testid="social-links"]',
];

/**
 * toHaveScreenshot 通用配置
 * - maxDiffPixelRatio: 0.01 允许 1% 像素差异（抗锯齿、字体渲染微差）
 * - animations: 'disabled' 禁用所有 CSS 动画/过渡
 * - caret: 'hide' 隐藏输入框光标
 */
const SCREENSHOT_OPTIONS = {
  fullPage: true,
  maxDiffPixelRatio: 0.01,
  animations: 'disabled' as const,
  caret: 'hide' as const,
};

/**
 * 准备页面：创建独立 context（可控 viewport + locale），导航到 URL，等待稳定
 *
 * 等待策略说明（避免 flaky）：
 * - domcontentloaded: DOM 解析完成即返回，比 networkidle 稳定
 * - load: 等待所有资源（图片/字体/CSS）加载完成，10s 超时失败不阻塞
 * - 800ms 额外等待: 让 React hydration + 客户端组件渲染完成
 *
 * 不用 networkidle 的原因：FloatingChat 的 SSE 轮询、Sentry beacon、
 * 字体预加载等会产生持续网络请求，导致 networkidle 永远无法达到
 */
async function preparePage(
  browser: import('@playwright/test').Browser,
  url: string,
  viewport: { width: number; height: number },
  isMobile = false
): Promise<Page> {
  const context = await browser.newContext({
    viewport,
    locale: 'zh-CN',
    isMobile,
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // 等待资源加载完成，失败不阻塞（部分第三方资源可能超时）
  await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);
  return page;
}

test.describe('桌面端视觉回归测试 (1280x720)', () => {
  for (const pageConfig of PAGES) {
    test(`desktop-${pageConfig.name}`, async ({ browser }) => {
      const page = await preparePage(
        browser,
        pageConfig.url,
        { width: 1280, height: 720 }
      );
      const masks = DYNAMIC_MASK_SELECTORS.map((sel) => page.locator(sel));
      await expect(page).toHaveScreenshot(
        `desktop-${pageConfig.name}.png`,
        { ...SCREENSHOT_OPTIONS, mask: masks }
      );
      await page.context().close();
    });
  }
});

test.describe('移动端视觉回归测试 (375x667)', () => {
  for (const pageConfig of PAGES) {
    test(`mobile-${pageConfig.name}`, async ({ browser }) => {
      const page = await preparePage(
        browser,
        pageConfig.url,
        { width: 375, height: 667 },
        true
      );
      const masks = DYNAMIC_MASK_SELECTORS.map((sel) => page.locator(sel));
      await expect(page).toHaveScreenshot(
        `mobile-${pageConfig.name}.png`,
        { ...SCREENSHOT_OPTIONS, mask: masks }
      );
      await page.context().close();
    });
  }
});

test.describe('关键交互视觉回归测试', () => {
  test('interaction-faq-default', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/faq', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    const masks = DYNAMIC_MASK_SELECTORS.map((sel) => page.locator(sel));
    await expect(page).toHaveScreenshot(
      'interaction-faq-default.png',
      { ...SCREENSHOT_OPTIONS, mask: masks }
    );
  });

  test('interaction-courses-search', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/courses', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    const masks = DYNAMIC_MASK_SELECTORS.map((sel) => page.locator(sel));
    await expect(page).toHaveScreenshot(
      'interaction-courses-search.png',
      { ...SCREENSHOT_OPTIONS, mask: masks }
    );
  });

  test('interaction-news-list', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/news', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    const masks = DYNAMIC_MASK_SELECTORS.map((sel) => page.locator(sel));
    await expect(page).toHaveScreenshot(
      'interaction-news-list.png',
      { ...SCREENSHOT_OPTIONS, mask: masks }
    );
  });

  test('interaction-nav-dropdown', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    const navItem = page.locator('nav button:has-text("课程体系")').first();
    if (await navItem.isVisible()) {
      await navItem.hover();
      await page.waitForTimeout(500);
    }
    const masks = DYNAMIC_MASK_SELECTORS.map((sel) => page.locator(sel));
    await expect(page).toHaveScreenshot(
      'interaction-nav-dropdown.png',
      { ...SCREENSHOT_OPTIONS, mask: masks }
    );
  });
});
