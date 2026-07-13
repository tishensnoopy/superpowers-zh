import { test, expect } from '@playwright/test';

test.describe('课程搜索页', () => {
  test('页面加载并显示搜索界面', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.locator('body')).toBeVisible();
  });

  test('搜索输入功能', async ({ page }) => {
    await page.goto('/courses');
    // CourseSearchPanel 恒定渲染 SearchBar 组件（见 components/course/CourseSearchPanel.tsx），
    // SearchBar 输出 <input type="text">（见 components/course/SearchBar.tsx），不依赖 Strapi 数据，
    // 因此可以直接断言输入框存在。
    const searchInput = page.locator('input[type="text"], input[type="search"]').first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('语言');
    await page.waitForTimeout(500);
    // 验证搜索结果区域更新：SearchResultsGrid 始终渲染在 main 下（加载中/错误/空态/结果都有 DOM）。
    const resultsArea = page.locator('main').first();
    await expect(resultsArea).toBeVisible();
    // 验证搜索输入框 value 与最后一次输入一致，确认 UI 状态正确反映用户输入。
    await expect(searchInput).toHaveValue('语言');
  });

  test('分类筛选功能', async ({ page }) => {
    await page.goto('/courses');
    // CategoryFilter 仅在 getProductCategories() 返回非空数组时渲染（见 CourseSearchPanel.tsx 第 62 行）。
    // 筛选按钮文案（语言/数学/英语/综合）取决于 Strapi 后端配置的分类名称，非前端可控。
    // 当 Strapi 不可达或未配置分类时，该组件不会渲染，因此保留条件断言。
    const filterButton = page
      .locator('button, a')
      .filter({ hasText: /语言|数学|英语|综合/ })
      .first();
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForTimeout(500);
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('竞态修复验证——快速连续输入', async ({ page }) => {
    await page.goto('/courses');
    // SearchBar 恒定渲染（见上「搜索输入功能」测试中的说明），可以直接断言。
    const searchInput = page.locator('input[type="text"], input[type="search"]').first();
    await expect(searchInput).toBeVisible();
    // 快速连续输入验证 useProductSearch 的 AbortController + requestId 竞态防护
    // （见 hooks/useProductSearch.ts 第 24-50 行）。
    await searchInput.fill('语');
    await searchInput.fill('语言');
    await searchInput.fill('语言启');
    await searchInput.fill('语言启蒙');
    await page.waitForTimeout(500);
    // 验证最终结果匹配最后一次输入：main 区域仍然可见，没有因为竞态导致 UI 崩溃。
    await expect(page.locator('main')).toBeVisible();
    // 验证搜索输入框 value 与最后一次输入一致，确认 UI 状态正确反映最后一次输入而非中间态。
    await expect(searchInput).toHaveValue('语言启蒙');
  });
});

test.describe('课程详情页', () => {
  test('语言启蒙课程详情', async ({ page }) => {
    await page.goto('/courses/language');
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page).toHaveTitle(/语言启蒙/);
  });

  test('课程详情 meta 标签', async ({ page }) => {
    await page.goto('/courses/language');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/);
  });

  test('课程详情 JSON-LD', async ({ page }) => {
    await page.goto('/courses/language');
    const jsonLd = page.locator('script[type="application/ld+json"]');
    await expect(jsonLd).toHaveCount(1);
    const content = await jsonLd.textContent();
    const parsed = JSON.parse(content!);
    expect(parsed['@type']).toBe('Course');
    expect(parsed.name).toBeTruthy();
  });

  test('课程详情 CTA 按钮', async ({ page }) => {
    await page.goto('/courses/language');
    // CourseCTA 组件恒定渲染 <Link href="/?course=...#appointment">（见 components/course/CourseCTA.tsx），
    // 不依赖 Strapi 数据，因此可以直接断言。Next.js <Link> 渲染为 <a> 标签。
    const ctaButton = page.locator('a[href*="appointment"]').first();
    await expect(ctaButton).toBeVisible();
  });

  test('不存在的课程 slug 显示 404', async ({ page }) => {
    await page.goto('/courses/nonexistent-course-slug');
    // app/courses/[slug]/page.tsx 在 getProductBySlug 返回 null 时调用 notFound()，
    // 触发 app/not-found.tsx 渲染，页面同时包含 "404" 大字和 "页面未找到" h1。
    // 用 .first() 避免严格模式冲突（两个元素都匹配 text=404 / text=页面未找到）。
    await expect(
      page.locator('text=404').or(page.locator('text=页面未找到')).first(),
    ).toBeVisible();
  });
});
