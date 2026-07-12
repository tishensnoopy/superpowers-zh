import { test, expect } from '@playwright/test';
import { setupApiMocks } from './mocks/routeHandlers';

test.describe('课程详情页 - CourseDetail 容器', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('有效 slug 时页面加载成功', async ({ page }) => {
    await page.goto('/courses/pinyin-basic');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: '拼音启蒙班' })).toBeVisible();
  });

  test('不存在的 slug 显示 404 提示', async ({ page }) => {
    await page.goto('/courses/not-exist');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('课程不存在')).toBeVisible();
    await expect(page.getByText('您访问的课程可能已下架或链接有误。')).toBeVisible();
  });

  test('页面加载时显示 loading 状态', async ({ page }) => {
    let resolveApi: () => void = () => {};
    const apiPromise = new Promise<void>((resolve) => {
      resolveApi = resolve;
    });

    await page.route('**/api/products/slug/pinyin-basic', async (route) => {
      await apiPromise;
      await route.fulfill({
        status: 200,
        json: (await import('./mocks/data')).mockCourseDetailFull,
      });
    });

    await page.goto('/courses/pinyin-basic');
    await expect(page.getByText('加载中...')).toBeVisible();

    resolveApi();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: '拼音启蒙班' })).toBeVisible();
  });
});

test.describe('CourseHeader - 课程头部', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('渲染课程名称作为 h1', async ({ page }) => {
    await page.goto('/courses/pinyin-basic');
    await page.waitForLoadState('networkidle');

    const h1 = page.locator('h1');
    await expect(h1).toHaveText('拼音启蒙班');
  });

  test('渲染课程简短描述', async ({ page }) => {
    await page.goto('/courses/pinyin-basic');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('轻松掌握拼音，打牢语文基础')).toBeVisible();
  });

  test('渲染规格标签（课时/班额/年龄/周期）', async ({ page }) => {
    await page.goto('/courses/pinyin-basic');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('48课时')).toBeVisible();
    await expect(page.getByText('小班12人')).toBeVisible();
    await expect(page.getByText('4-6岁')).toBeVisible();
    await expect(page.getByText('6个月')).toBeVisible();
  });

  test('渲染价格和原价（删除线）', async ({ page }) => {
    await page.goto('/courses/pinyin-basic');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('¥1999')).toBeVisible();
    const originalPrice = page.locator('span.line-through:has-text("¥2999")');
    await expect(originalPrice).toBeVisible();
  });

  test('h1 标题与顶部导航栏有足够间距', async ({ page }) => {
    await page.goto('/courses/pinyin-basic');
    await page.waitForLoadState('networkidle');

    const h1 = page.locator('h1');
    const h1Box = await h1.boundingBox();
    const nav = page.locator('header');
    const navBox = await nav.boundingBox();

    expect(h1Box).not.toBeNull();
    expect(navBox).not.toBeNull();
    expect(h1Box!.y - (navBox!.y + navBox!.height)).toBeGreaterThan(30);
  });
});

test.describe('CourseObjectives - 学习目标', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('有数据时渲染学习目标列表', async ({ page }) => {
    await page.goto('/courses/pinyin-basic');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: '学习目标' })).toBeVisible();
    await expect(page.getByText('掌握 23 个声母')).toBeVisible();
    await expect(page.getByText('掌握 24 个韵母')).toBeVisible();
    await expect(page.getByText('拼读能力')).toBeVisible();
  });

  test('渲染目标描述', async ({ page }) => {
    await page.goto('/courses/pinyin-basic');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('正确认读和书写所有声母')).toBeVisible();
  });

  test('空数据时显示占位符', async ({ page }) => {
    await page.goto('/courses/math-thinking');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: '学习目标' })).toBeVisible();
    await expect(page.getByText('学习目标内容更新中，敬请期待')).toBeVisible();
  });
});

test.describe('CourseOutline - 课程大纲', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('有数据时渲染课程大纲模块', async ({ page }) => {
    await page.goto('/courses/pinyin-basic');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: '课程大纲' })).toBeVisible();
    await expect(page.getByText('第 1-12 课：声母学习')).toBeVisible();
    await expect(page.getByText('第 13-24 课：韵母学习')).toBeVisible();
    await expect(page.getByText('第 25-36 课：拼读练习')).toBeVisible();
  });

  test('渲染课时数标签', async ({ page }) => {
    await page.goto('/courses/pinyin-basic');
    await page.waitForLoadState('networkidle');

    const lessonCountElements = page.locator('text=12 课时');
    await expect(lessonCountElements).toHaveCount(3);
  });

  test('空数据时显示占位符', async ({ page }) => {
    await page.goto('/courses/math-thinking');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: '课程大纲' })).toBeVisible();
    await expect(page.getByText('课程大纲内容更新中，敬请期待')).toBeVisible();
  });
});

test.describe('CourseTestimonials - 家长评价', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('有数据时渲染评价卡片', async ({ page }) => {
    await page.goto('/courses/pinyin-basic');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: '家长评价' })).toBeVisible();
    await expect(page.getByText('张妈妈')).toBeVisible();
    await expect(page.getByText('李爸爸')).toBeVisible();
  });

  test('渲染评价内容', async ({ page }) => {
    await page.goto('/courses/pinyin-basic');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('孩子上了一学期，拼音发音很标准！')).toBeVisible();
  });

  test('空数据时显示占位符', async ({ page }) => {
    await page.goto('/courses/math-thinking');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: '家长评价' })).toBeVisible();
    await expect(page.getByText('家长评价内容更新中，敬请期待')).toBeVisible();
  });
});

test.describe('CourseCTA - 预约行动号召', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('渲染预约 CTA 标题和按钮', async ({ page }) => {
    await page.goto('/courses/pinyin-basic');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('预约免费试听')).toBeVisible();
    await expect(page.getByText('立即预约')).toBeVisible();
  });

  test('CTA 标题包含课程名', async ({ page }) => {
    await page.goto('/courses/pinyin-basic');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('拼音启蒙班')).toHaveCount(2);
  });

  test('点击立即预约跳转到首页预约表单', async ({ page }) => {
    await page.goto('/courses/pinyin-basic');
    await page.waitForLoadState('networkidle');

    await page.getByText('立即预约').click();
    await expect(page).toHaveURL(/\//);
    await expect(page).toHaveURL(/pinyin-basic/);
  });

  test('CTA 区块使用橙色渐变背景', async ({ page }) => {
    await page.goto('/courses/pinyin-basic');
    await page.waitForLoadState('networkidle');

    const ctaHeading = page.getByText('预约免费试听');
    const ctaSection = ctaHeading.locator('..');
    const backgroundImage = await ctaSection.evaluate((el) => {
      const section = el.closest('section');
      return section ? getComputedStyle(section).background : '';
    });
    expect(backgroundImage).toContain('linear-gradient');
    expect(backgroundImage).toContain('rgb(245, 133, 31)');
  });
});

test.describe('导航栏二级下拉菜单交互', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('悬停课程中心显示二级菜单', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('nav').getByText('课程中心').hover();
    await page.waitForTimeout(300);

    await expect(page.getByText('幼小衔接')).toBeVisible();
    await expect(page.getByText('拼音课程')).toBeVisible();
  });

  test('下拉菜单与父按钮无间隙（可点击子项）', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const navItem = page.locator('nav').getByText('课程中心');
    await navItem.hover();

    const parentBox = await navItem.boundingBox();
    const submenu = page.getByText('幼小衔接');
    const submenuBox = await submenu.boundingBox();

    expect(parentBox).not.toBeNull();
    expect(submenuBox).not.toBeNull();
    expect(submenuBox!.y - (parentBox!.y + parentBox!.height)).toBeLessThanOrEqual(10);
  });

  test('点击子菜单项跳转到对应页面', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('nav').getByText('课程中心').hover();
    await page.waitForTimeout(300);

    await page.getByText('幼小衔接').click();
    await expect(page).toHaveURL('/courses/kindergarten');
  });
});

test.describe('课程详情页完整截图（视觉回归）', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('完整课程详情页截图（有数据）', async ({ page }) => {
    await page.goto('/courses/pinyin-basic');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo(0, 0));

    await expect(page).toHaveScreenshot('course-detail-full.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('空数据课程详情页截图', async ({ page }) => {
    await page.goto('/courses/math-thinking');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo(0, 0));

    await expect(page).toHaveScreenshot('course-detail-empty.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('404 页面截图', async ({ page }) => {
    await page.goto('/courses/not-exist');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('course-detail-404.png', {
      fullPage: true,
      maxDiffPixels: 50,
    });
  });

  test('移动端课程详情页截图', async ({ page, viewport }) => {
    if (viewport?.width !== 393) return;

    await page.goto('/courses/pinyin-basic');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('mobile-course-detail.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });
});
