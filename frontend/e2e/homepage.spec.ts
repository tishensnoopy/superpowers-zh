import { test, expect } from '@playwright/test';
import { setupApiMocks } from './mocks/routeHandlers';

test.describe('首页', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('页面加载成功', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/超级能力教育/);
  });

  test('导航栏显示', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.getByText('首页')).toBeVisible();
    await expect(page.getByText('课程中心')).toBeVisible();
    await expect(page.getByText('师资团队')).toBeVisible();
    await expect(page.getByText('家长问答')).toBeVisible();
    await expect(page.getByText('联系我们')).toBeVisible();
  });

  test('Hero 区域渲染', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('让孩子赢在起跑线')).toBeVisible();
    await expect(page.getByText('专业幼小衔接教育，陪伴成长每一天')).toBeVisible();
    await expect(page.getByText('免费预约体验课')).toBeVisible();
  });

  test('优势区域渲染', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('为什么选择我们')).toBeVisible();
    await expect(page.getByText('专业师资')).toBeVisible();
    await expect(page.getByText('科学课程')).toBeVisible();
    await expect(page.getByText('安全环境')).toBeVisible();
    await expect(page.getByText('小班教学')).toBeVisible();
  });

  test('课程特色区域渲染', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('课程特色')).toBeVisible();
    await expect(page.getByText('语言表达')).toBeVisible();
    await expect(page.getByText('数学思维')).toBeVisible();
    await expect(page.getByText('专注力训练')).toBeVisible();
  });

  test('热门课程区域渲染', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('热门课程')).toBeVisible();
    await expect(page.getByText('拼音启蒙班')).toBeVisible();
    await expect(page.getByText('数学思维班')).toBeVisible();
    await expect(page.getByText('识字阅读班')).toBeVisible();
    await expect(page.getByText('专注力特训')).toBeVisible();
  });

  test('FAQ 区域渲染', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('家长常见问题')).toBeVisible();
    await expect(page.getByText('课程适合多大年龄的孩子?')).toBeVisible();
    await expect(page.getByText('每班有多少学生?')).toBeVisible();
    await expect(page.getByText('如何预约体验课?')).toBeVisible();
  });

  test('预约表单区域渲染', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('预约免费体验课')).toBeVisible();
    await expect(page.getByText('填写信息，我们的课程顾问将在24小时内联系您')).toBeVisible();
  });

  test('页脚显示', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByText('© 2026 超级能力教育 版权所有')).toBeVisible();
    await expect(page.getByText('关于我们')).toBeVisible();
    await expect(page.getByText('隐私政策')).toBeVisible();
    await expect(page.getByText('服务条款')).toBeVisible();
  });

  test('导航链接可点击', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByText('首页').click();
    await expect(page).toHaveURL('/');

    await page.getByText('课程中心').click();
    await expect(page).toHaveURL('/courses');

    await page.getByText('师资团队').click();
    await expect(page).toHaveURL('/team');

    await page.getByText('家长问答').click();
    await expect(page).toHaveURL('/faq');

    await page.getByText('联系我们').click();
    await expect(page).toHaveURL('/contact');
  });
});