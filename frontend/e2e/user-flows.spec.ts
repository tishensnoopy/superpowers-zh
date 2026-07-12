import { test, expect } from '@playwright/test';
import { setupApiMocks } from './mocks/routeHandlers';

test.describe('用户核心流程', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('FAQ 展开收起交互', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const firstQuestion = page.getByText('课程适合多大年龄的孩子?');
    await expect(firstQuestion).toBeVisible();

    await firstQuestion.click();
    await expect(page.getByText('我们的课程适合5-7岁的学龄前儿童。')).toBeVisible();

    await firstQuestion.click();
    await expect(page.getByText('我们的课程适合5-7岁的学龄前儿童。')).not.toBeVisible();

    const secondQuestion = page.getByText('每班有多少学生?');
    await secondQuestion.click();
    await expect(page.getByText('为保证教学质量，每班不超过12人。')).toBeVisible();
  });

  test('预约表单填写并提交', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.scrollIntoViewIfNeeded('form');

    await page.fill('input[name="childName"]', '小明');
    await page.fill('input[name="parentName"]', '王女士');
    await page.fill('input[name="phone"]', '13800138000');
    await page.fill('input[name="age"]', '6');
    await page.selectOption('select[name="course"]', '拼音启蒙班');
    await page.selectOption('select[name="campus"]', '朝阳校区');
    await page.fill('textarea[name="message"]', '希望安排周末上课');

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/appointment-success');
    await expect(page.getByText('预约成功')).toBeVisible();
  });

  test('预约表单缺少必填项时显示错误', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.scrollIntoViewIfNeeded('form');
    await page.click('button[type="submit"]');

    await expect(page.getByText('请填写孩子姓名')).toBeVisible();
    await expect(page.getByText('请填写家长姓名')).toBeVisible();
    await expect(page.getByText('请填写联系电话')).toBeVisible();
  });

  test('产品卡片点击跳转', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByText('拼音启蒙班').click();
    await expect(page).toHaveURL('/products/pinyin-basic');

    await page.goBack();
    await page.getByText('数学思维班').click();
    await expect(page).toHaveURL('/products/math-thinking');
  });

  test('课程中心页面加载', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('语言学习')).toBeVisible();
    await expect(page.getByText('数学思维')).toBeVisible();
    await expect(page.getByText('能力培养')).toBeVisible();

    await expect(page.getByText('拼音启蒙班')).toBeVisible();
    await expect(page.getByText('数学思维班')).toBeVisible();
    await expect(page.getByText('识字阅读班')).toBeVisible();
    await expect(page.getByText('专注力特训')).toBeVisible();
  });

  test('产品分类筛选', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');

    await page.getByText('语言学习').click();
    await expect(page.getByText('拼音启蒙班')).toBeVisible();
    await expect(page.getByText('识字阅读班')).toBeVisible();

    await page.getByText('数学思维').click();
    await expect(page.getByText('数学思维班')).toBeVisible();

    await page.getByText('能力培养').click();
    await expect(page.getByText('专注力特训')).toBeVisible();
  });

  test('返回首页按钮', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');
    await page.getByText('首页').click();
    await expect(page).toHaveURL('/');

    await page.goto('/faq');
    await page.waitForLoadState('networkidle');
    await page.getByText('首页').click();
    await expect(page).toHaveURL('/');
  });

  test('浮动预约按钮显示', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="floating-button"]')).toBeVisible();

    await page.scrollBy(0, 500);
    await expect(page.locator('[data-testid="floating-button"]')).toBeVisible();
  });
});