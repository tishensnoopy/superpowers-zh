import { test, expect } from '@playwright/test';

test.describe('关于我们页内容验证', () => {
  test('页面加载并渲染多个板块', async ({ page }) => {
    const response = await page.goto('/about');
    expect(response?.status()).toBe(200);
    await expect(page.locator('h2').first()).toBeVisible();
  });

  test('渲染统计数据 advantages 板块', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByText('8年+').first()).toBeVisible();
    await expect(page.getByText('3000+').first()).toBeVisible();
    await expect(page.getByText('6大校区').first()).toBeVisible();
    await expect(page.getByText('98% 满意度').first()).toBeVisible();
  });

  test('渲染学校介绍 rich-text 板块', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByRole('heading', { name: '关于佑森小课堂' })).toBeVisible();
    await expect(page.getByText(/成立于2018年/)).toBeVisible();
  });

  test('渲染办学理念与师资力量板块', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByRole('heading', { name: '办学理念与师资力量' })).toBeVisible();
    await expect(page.getByText(/科学衔接、快乐成长/).first()).toBeVisible();
    await expect(page.getByText(/14位认证教师/)).toBeVisible();
  });

  test('渲染资质荣誉 features 板块', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByRole('heading', { name: '资质荣誉' })).toBeVisible();
    await expect(page.getByText('办学许可证')).toBeVisible();
    await expect(page.getByText('ISO质量认证')).toBeVisible();
    await expect(page.getByText('家长信赖品牌')).toBeVisible();
  });

  test('页面包含至少 4 个 section 区块', async ({ page }) => {
    await page.goto('/about');
    const sections = page.locator('section');
    await expect(sections.nth(0)).toBeVisible();
    await expect(sections.nth(1)).toBeVisible();
    await expect(sections.nth(2)).toBeVisible();
    await expect(sections.nth(3)).toBeVisible();
  });
});
