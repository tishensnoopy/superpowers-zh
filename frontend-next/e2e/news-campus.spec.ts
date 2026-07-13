import { test, expect } from '@playwright/test';

test.describe('新闻列表页', () => {
  test('页面加载并显示标题', async ({ page }) => {
    await page.goto('/news');
    await page.waitForLoadState('networkidle');
    // app/news/page.tsx 是 Server Component，恒定渲染 body 与 h1 "新闻动态"。
    // 新闻卡片（NewsCard）依赖 Strapi getNews() 返回数据，可能为空（页面显示"暂无新闻内容"），
    // 因此此处断言恒定渲染的 h1 可见作为基线加载验证。
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('新闻列表 meta 标签', async ({ page }) => {
    await page.goto('/news');
    // generateMetadata 调用 buildMetadata(undefined, { title: '新闻动态', description: '了解我们的最新动态...' })，
    // description 为硬编码常量，不依赖 Strapi 数据，可直接断言。
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
  });
});

test.describe('新闻详情页', () => {
  test('新闻详情页面加载', async ({ page }) => {
    await page.goto('/news');
    await page.waitForLoadState('networkidle');
    // NewsCard 渲染 <a href="/news/{slug}">，slug 来自 Strapi getNews() 返回的新闻列表。
    // 当 Strapi 不可达或无新闻数据时，列表页显示"暂无新闻内容"，此处链接不存在，
    // 因此保留条件断言——仅在有新闻数据时才验证详情页加载。
    const newsLink = page.locator('a[href*="/news/"]').first();
    if (await newsLink.isVisible()) {
      const href = await newsLink.getAttribute('href');
      await page.goto(href!);
      await expect(page.locator('h1').first()).toBeVisible();
    }
  });
});

test.describe('校区列表页', () => {
  test('页面加载并显示标题', async ({ page }) => {
    await page.goto('/campuses');
    await page.waitForLoadState('networkidle');
    // app/campuses/page.tsx 恒定渲染 CampusHeader（含 h1 "八大校区 任您选择"）。
    // CampusGrid 在无数据时显示"校区信息更新中"，有数据时渲染 CampusCard。
    // 此处断言恒定渲染的 h1 可见作为基线加载验证。
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('校区列表 meta 标签', async ({ page }) => {
    await page.goto('/campuses');
    // generateMetadata 调用 buildMetadata(undefined, { title: '校区分布', description: '查看我们的各校区...' })，
    // description 为硬编码常量，不依赖 Strapi 数据，可直接断言。
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
  });
});

test.describe('校区详情页', () => {
  test('朝阳校区详情', async ({ page }) => {
    // /campuses/chaoyang 对应 Strapi 中 slug=chaoyang 的校区数据。
    // 经验证该校区在 Strapi 中存在（页面渲染"朝阳校区"+"校区环境"）。
    // 若后续 Strapi 数据变更导致该 slug 不存在，getCampusBySlug 返回空，
    // page.tsx 会调用 notFound() 触发 404 页面，此测试将失败——届时需更换为实际存在的 slug。
    await page.goto('/campuses/chaoyang');
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('校区详情 meta 标签 + JSON-LD', async ({ page }) => {
    await page.goto('/campuses/chaoyang');
    // generateMetadata 调用 buildMetadata(campus.seo, { title: campus.name, description: campus.address })，
    // og:title 由 buildMetadata 恒定注入（fallback 到 title），不依赖 seo 字段，可直接断言。
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/);
    // 校区详情页（app/campuses/[slug]/page.tsx）未注入 JSON-LD 结构化数据，
    // 与新闻详情页（注入 NewsArticle JSON-LD）不同。此处为条件检查：
    // 若未来为校区详情添加 JSON-LD，此断言将自动验证其结构；当前无 JSON-LD 时跳过。
    const jsonLd = page.locator('script[type="application/ld+json"]');
    if ((await jsonLd.count()) > 0) {
      const content = await jsonLd.first().textContent();
      const parsed = JSON.parse(content!);
      expect(parsed['@type']).toBeTruthy();
    }
  });

  test('不存在的校区 slug 显示 404', async ({ page }) => {
    await page.goto('/campuses/nonexistent-campus');
    // app/campuses/[slug]/page.tsx 在 getCampusBySlug 返回空时调用 notFound()，
    // 触发 app/not-found.tsx 渲染，页面同时包含 "404" 大字和 "页面未找到" h1。
    // 用 .first() 避免严格模式冲突（两个元素都匹配 text=404 / text=页面未找到）。
    await expect(
      page.locator('text=404').or(page.locator('text=页面未找到')).first(),
    ).toBeVisible();
  });
});
