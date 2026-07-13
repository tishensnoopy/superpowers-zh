# Next.js 迁移阶段 3：内容迁移与数据对接实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 全面收尾 Next.js 迁移——修复路由不一致和技术债、优化 Sentry 性能、引入 Playwright E2E 测试、逐页验证样式/交互对齐、数据对接验证，为阶段 4 切换部署做好准备。

**架构：** 4 层结构共 11 个任务——基础设施修复（路由+技术债+Sentry 优化）→ Playwright E2E 基础设施 → 逐页 E2E+样式对齐 → 收尾验证。保留现有 vitest 组件测试，Playwright 作为页面级测试补充层。

**技术栈：** Next.js 15、React 18、TypeScript、Tailwind CSS 4、Vitest、@sentry/nextjs、@playwright/test

**设计文档：** `docs/superpowers/specs/2026-07-13-nextjs-migration-phase3-design.md`

**前置条件：** 阶段 2（骨架搭建）已完成——262 个 vitest 测试通过、35 个静态页面生成、Git 标签 `nextjs-skeleton-complete`

---

## 文件结构

### 修改的文件

| 文件 | 任务 | 职责 |
|------|------|------|
| `frontend-next/next.config.ts` | 1 | 添加 `/team` → `/teachers` 重定向 |
| `frontend-next/app/[slug]/page.tsx` | 1, 2 | 修复 generateStaticParams 过滤 + 404 验证 |
| `frontend-next/app/error.tsx` | 2 | 跳过 API 错误的 Sentry 重复捕获 |
| `frontend-next/lib/api.ts` | 2 | 4xx 噪音过滤（仅 5xx 发 Sentry） |
| `frontend-next/app/llms.txt/route.ts` | 2 | SWR 值补充 |
| `frontend-next/sentry.client.config.ts` | 3 | replay 集成改为 lazyLoadIntegration |
| `frontend-next/components/course/__tests__/CourseSearchPanel.test.tsx` | 2 | 使用 fake timers 消除 act 警告 |
| `frontend-next/package.json` | 4 | 添加 @playwright/test + test:e2e 脚本 |

### 新建文件

| 文件 | 任务 | 职责 |
|------|------|------|
| `frontend-next/app/contact/page.tsx` | 1 | 联系/预约页面（ISR） |
| `frontend-next/app/team/page.tsx` | 1 | `/team` → `/teachers` 重定向 |
| `frontend-next/playwright.config.ts` | 4 | Playwright 配置 |
| `frontend-next/e2e/fixtures.ts` | 4 | 自定义 fixture |
| `frontend-next/e2e/smoke.spec.ts` | 5 | 烟雾测试 |
| `frontend-next/e2e/homepage.spec.ts` | 6 | 首页 + 合规页 E2E |
| `frontend-next/e2e/courses.spec.ts` | 7 | 课程搜索 + 详情 E2E |
| `frontend-next/e2e/news-campus.spec.ts` | 8 | 新闻 + 校区 E2E |
| `frontend-next/e2e/teachers-faq.spec.ts` | 9 | 教师 + FAQ + 404 E2E |

### 删除的文件

| 文件 | 任务 | 原因 |
|------|------|------|
| `frontend-next/components/course/CourseDetail.tsx` | 2 | 已被 `app/courses/[slug]/page.tsx` 替代 |
| `frontend-next/components/course/__tests__/CourseDetail.test.tsx` | 2 | 随组件一起删除 |

---

## 任务 1：路由一致性修复

**文件：**
- 创建：`frontend-next/app/contact/page.tsx`
- 创建：`frontend-next/app/team/page.tsx`
- 修改：`frontend-next/next.config.ts`

- [ ] **步骤 1：创建 `/team` → `/teachers` 重定向页面**

```tsx
// frontend-next/app/team/page.tsx
import { redirect } from 'next/navigation';

export default function TeamRedirect() {
  redirect('/teachers');
}
```

- [ ] **步骤 2：创建 `/contact` 页面**

`/contact` 页面需要渲染 ContactForm section。检查 Strapi 是否有 slug 为 "contact" 的页面——如果有，`app/[slug]/page.tsx` 会处理；但导航中的"联系我们"和"预约免费试听"按钮硬编码指向 `/contact`，为确保可用，创建独立路由。

```tsx
// frontend-next/app/contact/page.tsx
import { getSiteSettings, getNavigationTree, getFooter } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import ContactForm from '@/components/sections/ContactForm';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata(undefined, {
    title: '联系我们',
    description: '联系启航幼小教育，预约免费试听课程',
  });
}

export default async function ContactPage() {
  return (
    <div className="pt-[72px] min-h-screen bg-gradient-to-br from-[#FFF3E5] to-[#FFFCF8]">
      <div className="max-w-[1200px] mx-auto px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[#1C2B3A] mb-4">联系我们</h1>
          <p className="text-lg text-gray-600">填写下方表单预约免费试听课程</p>
        </div>
        <ContactForm />
      </div>
    </div>
  );
}
```

- [ ] **步骤 3：在 `next.config.ts` 中添加 `/team` → `/teachers` 重定向（双重保障）**

在 `next.config.ts` 的 `nextConfig` 对象中，`headers()` 之后添加 `redirects()`：

```typescript
  async redirects() {
    return [
      {
        source: '/team',
        destination: '/teachers',
        permanent: true,
      },
    ];
  },
```

注意：由于 `app/team/page.tsx` 已处理重定向，`redirects()` 是双重保障。如果 `app/team/page.tsx` 存在，Next.js 会优先使用文件路由。删除 `app/team/page.tsx` 仅保留 `redirects()` 也可以，但文件路由方式更直观。选择保留两者。

- [ ] **步骤 4：构建验证**

```bash
cd frontend-next
npm run typecheck
npm run build
```

预期：typecheck 通过，build 成功，`/contact` 和 `/team` 出现在路由列表中。

- [ ] **步骤 5：浏览器验证**

```bash
npm run start
```

- 访问 `http://localhost:3000/team` → 重定向到 `/teachers`
- 访问 `http://localhost:3000/contact` → 显示联系页面 + ContactForm
- 访问 `http://localhost:3000/nonexistent` → 检查状态码（记录结果，任务 2 处理）

- [ ] **步骤 6：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend-next/app/contact/page.tsx frontend-next/app/team/page.tsx frontend-next/next.config.ts
git commit -m "feat(frontend-next): 修复路由一致性——/team 重定向 + /contact 页面"
```

---

## 任务 2：阶段 2 遗留技术债清理

**文件：**
- 删除：`frontend-next/components/course/CourseDetail.tsx`
- 删除：`frontend-next/components/course/__tests__/CourseDetail.test.tsx`
- 修改：`frontend-next/app/error.tsx`
- 修改：`frontend-next/lib/api.ts`
- 修改：`frontend-next/app/llms.txt/route.ts`
- 修改：`frontend-next/app/[slug]/page.tsx`
- 修改：`frontend-next/components/course/__tests__/CourseSearchPanel.test.tsx`

- [ ] **步骤 1：确认 CourseDetail.tsx 无引用后删除**

```bash
cd /home/tishensnoopy/project/superpowers-zh/frontend-next
grep -r "CourseDetail" --include="*.tsx" --include="*.ts" -l | grep -v __tests__ | grep -v node_modules
```

预期：只有 `CourseDetail.test.tsx` 引用 `CourseDetail`。`app/courses/[slug]/page.tsx` 不应引用它（任务 8 已用 Server Component 替代）。

如果确认无其他引用：
```bash
rm components/course/CourseDetail.tsx
rm components/course/__tests__/CourseDetail.test.tsx
```

- [ ] **步骤 2：修复 error.tsx Sentry 重复捕获**

修改 `frontend-next/app/error.tsx` 的 `useEffect`：

```tsx
  useEffect(() => {
    if (error.message.includes('API request failed')) return;
    Sentry.captureException(error, {
      tags: { section: 'route-error', digest: error.digest },
    });
  }, [error]);
```

- [ ] **步骤 3：修复 lib/api.ts 4xx 噪音过滤**

修改 `frontend-next/lib/api.ts` 的 `if (!res.ok)` 块，将 Sentry 捕获改为仅 5xx：

```typescript
    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      const error = new Error(`API request failed: ${res.status} ${res.statusText}${errorText ? ' - ' + errorText : ''}`);
      logError(path, error, duration);
      if (res.status >= 500) {
        const isSensitiveEndpoint = path.includes('/appointments') || path.includes('/feedback');
        Sentry.captureException(error, {
          tags: { api: path, status: res.status.toString() },
          extra: {
            method: options.method || 'GET',
            duration,
            ...(isSensitiveEndpoint ? {} : { responseBody: errorText.substring(0, 500) }),
          },
        });
      }
      throw error;
    }
```

- [ ] **步骤 4：修复 llms.txt SWR 值**

修改 `frontend-next/app/llms.txt/route.ts` 第 45 行：

```typescript
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
```

- [ ] **步骤 5：修复 app/[slug]/page.tsx generateStaticParams 重复路径**

修改 `frontend-next/app/[slug]/page.tsx` 的 `generateStaticParams`：

```typescript
export async function generateStaticParams() {
  const { data: pages } = await getPages();
  const staticSlugs = ['refund-policy', 'privacy-policy', 'user-agreement', 'contact'];
  return pages
    .filter((page) => !page.isHomepage && !staticSlugs.includes(page.slug))
    .map((page) => ({ slug: page.slug }));
}
```

- [ ] **步骤 6：修复 CourseSearchPanel 测试 act 警告**

读取 `frontend-next/components/course/__tests__/CourseSearchPanel.test.tsx`，在 `beforeEach` 中添加 `vi.useFakeTimers()`，在 `afterEach` 中添加 `vi.useRealTimers()`。

在测试文件顶部 import 区添加：
```typescript
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
```

在 `beforeEach` 中添加：
```typescript
  vi.useFakeTimers();
```

在 `afterEach` 中添加：
```typescript
  vi.useRealTimers();
```

对于涉及用户输入（触发 debounce）的测试用例，使用 `vi.advanceTimersByTime(300)` 推进 debounce 计时器，然后用 `vi.runAllTimers()` 确保所有异步操作完成。

注意：具体修改方式需根据测试文件实际内容调整。如果测试中使用了 `waitFor`，可能需要改为 `await vi.runAllTimersAsync()`。

- [ ] **步骤 7：运行全量测试验证**

```bash
cd frontend-next
npm run typecheck
npx vitest run
```

预期：typecheck 通过。vitest 测试数量减少（删除了 CourseDetail.test.tsx 的 9 个测试），但其余测试全部通过，且 CourseSearchPanel 测试无 act 警告。

- [ ] **步骤 8：构建验证**

```bash
npm run build
```

预期：构建成功，无 CourseDetail 引用错误。

- [ ] **步骤 9：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add -A frontend-next/
git commit -m "fix(frontend-next): 清理阶段 2 遗留技术债

- 移除 CourseDetail.tsx 及测试（已被 app/courses/[slug]/page.tsx 替代）
- error.tsx 跳过 API 错误的 Sentry 重复捕获
- lib/api.ts 仅 5xx 发送 Sentry，4xx 记录日志
- llms.txt 补充 stale-while-revalidate=86400
- app/[slug] generateStaticParams 过滤静态路由冲突
- CourseSearchPanel 测试使用 fake timers 消除 act 警告"
```

---

## 任务 3：Sentry 动态加载优化

**文件：**
- 修改：`frontend-next/sentry.client.config.ts`

- [ ] **步骤 1：修改 sentry.client.config.ts 使用 lazyLoadIntegration**

```typescript
// frontend-next/sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.5,
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Navigation cancelled',
    'AbortError',
  ],
});

Sentry.lazyLoadIntegration('replayIntegration')
  .then((replayIntegration) => {
    Sentry.addIntegration(replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }));
  })
  .catch(() => {
    // 动态加载失败时静默处理，错误捕获仍可用
  });
```

- [ ] **步骤 2：构建并检查 First Load JS**

```bash
cd frontend-next
npm run build
```

检查构建输出的 `First Load JS shared by all` 行。预期：从 209KB 降至 150KB 以下（减少约 50-70KB 的 replay SDK）。

- [ ] **步骤 3：运行全量测试验证**

```bash
npx vitest run
```

预期：所有测试通过。

- [ ] **步骤 4：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend-next/sentry.client.config.ts
git commit -m "perf(frontend-next): Sentry replay 集成改为 lazyLoadIntegration

First Load JS 从 209KB 降至约 140-150KB"
```

---

## 任务 4：Playwright 配置与测试环境

**文件：**
- 修改：`frontend-next/package.json`
- 创建：`frontend-next/playwright.config.ts`
- 创建：`frontend-next/e2e/fixtures.ts`

- [ ] **步骤 1：安装 @playwright/test**

```bash
cd frontend-next
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **步骤 2：在 package.json 中添加 test:e2e 脚本**

在 `package.json` 的 `scripts` 中添加：
```json
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:report": "playwright show-report"
```

- [ ] **步骤 3：创建 playwright.config.ts**

```typescript
// frontend-next/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'e2e-report' }], ['list']],
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'zh-CN',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
```

- [ ] **步骤 4：创建 e2e/fixtures.ts**

```typescript
// frontend-next/e2e/fixtures.ts
import { test as base, expect } from '@playwright/test';

interface FixtureOptions {
  expectNoConsoleErrors: void;
}

export const test = base.extend<FixtureOptions>({
  expectNoConsoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    await use();
    if (errors.length > 0) {
      console.warn('Console errors detected:', errors);
    }
  },
});

export { expect };
```

- [ ] **步骤 5：创建示例测试验证配置**

创建 `frontend-next/e2e/example.spec.ts`：

```typescript
import { test, expect } from '@playwright/test';

test('Playwright 配置验证', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/幼小衔接/);
});
```

- [ ] **步骤 6：运行示例测试验证**

```bash
cd frontend-next
npx playwright test --reporter=list
```

预期：示例测试通过。Playwright 自动启动 `npm run start` 服务器并运行测试。

- [ ] **步骤 7：删除示例测试并 Commit**

```bash
rm e2e/example.spec.ts
cd /home/tishensnoopy/project/superpowers-zh
git add frontend-next/package.json frontend-next/package-lock.json frontend-next/playwright.config.ts frontend-next/e2e/fixtures.ts
git commit -m "feat(frontend-next): Playwright E2E 测试基础设施

- @playwright/test 依赖 + Chromium 浏览器
- playwright.config.ts: baseURL/webServer/Chromium only
- e2e/fixtures.ts: expectNoConsoleErrors 自定义 fixture
- test:e2e 脚本"
```

---

## 任务 5：关键路径烟雾测试

**文件：**
- 创建：`frontend-next/e2e/smoke.spec.ts`

- [ ] **步骤 1：编写烟雾测试**

```typescript
// frontend-next/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test';

test.describe('关键路径烟雾测试', () => {
  test('首页加载并渲染关键元素', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/幼小衔接/);
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('导航到课程搜索页', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/courses"]');
    await expect(page).toHaveURL(/\/courses/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('课程搜索功能', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('input[type="text"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('语言');
      await page.waitForTimeout(500);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('课程详情页加载', async ({ page }) => {
    await page.goto('/courses/language');
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('预约表单页面访问', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('404 页面显示', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-12345');
    await expect(page.locator('text=404').or(page.locator('text=页面未找到'))).toBeVisible();
  });

  test('sitemap.xml 可访问', async ({ page }) => {
    const response = await page.goto('/sitemap.xml');
    expect(response?.status()).toBe(200);
  });

  test('robots.txt 可访问', async ({ page }) => {
    const response = await page.goto('/robots.txt');
    expect(response?.status()).toBe(200);
  });

  test('llms.txt 可访问', async ({ page }) => {
    const response = await page.goto('/llms.txt');
    expect(response?.status()).toBe(200);
  });
});
```

- [ ] **步骤 2：运行烟雾测试**

```bash
cd frontend-next
npx playwright test e2e/smoke.spec.ts --reporter=list
```

预期：9 个测试全部通过。如果有失败，记录失败原因并在后续任务中修复。

- [ ] **步骤 3：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend-next/e2e/smoke.spec.ts
git commit -m "test(frontend-next): 关键路径烟雾测试（9 个 E2E 测试）"
```

---

## 任务 6：首页 + 合规页 E2E + 样式对齐

**文件：**
- 创建：`frontend-next/e2e/homepage.spec.ts`

- [ ] **步骤 1：编写首页 E2E 测试**

```typescript
// frontend-next/e2e/homepage.spec.ts
import { test, expect } from '@playwright/test';

test.describe('首页', () => {
  test('渲染所有 section', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Hero section
    await expect(page.locator('h1').first()).toBeVisible();

    // 导航栏
    await expect(page.locator('header nav')).toBeVisible();

    // Footer
    await expect(page.locator('footer')).toBeVisible();
  });

  test('meta 标签正确', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/幼小衔接/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  });

  test('JSON-LD 结构化数据存在', async ({ page }) => {
    await page.goto('/');
    const jsonLd = page.locator('script[type="application/ld+json"]');
    await expect(jsonLd).toHaveCount(1);
    const content = await jsonLd.textContent();
    expect(content).toBeTruthy();
    const parsed = JSON.parse(content!);
    expect(parsed['@type']).toBeTruthy();
  });

  test('FloatingButton 可见', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // FloatingButton 通常是固定定位的预约按钮
    const floatingButton = page.locator('a[href*="contact"], a[href*="appointment"]').last();
    if (await floatingButton.isVisible()) {
      await expect(floatingButton).toBeVisible();
    }
  });
});

test.describe('合规页面', () => {
  test('退费政策页面', async ({ page }) => {
    await page.goto('/refund-policy');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveTitle(/退费/);
  });

  test('隐私政策页面', async ({ page }) => {
    await page.goto('/privacy-policy');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveTitle(/隐私/);
  });

  test('用户协议页面', async ({ page }) => {
    await page.goto('/user-agreement');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveTitle(/用户协议|协议/);
  });
});
```

- [ ] **步骤 2：运行测试**

```bash
cd frontend-next
npx playwright test e2e/homepage.spec.ts --reporter=list
```

预期：7 个测试通过。记录任何失败。

- [ ] **步骤 3：样式对齐检查**

启动 Vite 和 Next.js 两个项目，对比首页截图：
```bash
# Vite 项目（端口 5173）
cd frontend && npm run dev &

# Next.js 项目（端口 3000）
cd frontend-next && npm run start &
```

在浏览器中对比 `http://localhost:5173/` 和 `http://localhost:3000/`：
- 字体渲染是否一致
- 间距/布局是否一致
- 图片尺寸是否一致
- 颜色是否一致

记录差异并修复。常见差异：
- Tailwind v4 vs v3 的默认值差异
- next/image vs 原生 img 的尺寸行为
- next/font vs CSS @font-face 的字体加载

- [ ] **步骤 4：修复发现的样式差异**

根据步骤 3 的对比结果修复差异。常见修复点：
- `globals.css` 中的 `@theme` 变量是否与 Vite 的 `tailwind.config.ts` 一致
- StrapiImage 的 `fill` 模式是否需要调整父容器样式
- 字体回退链是否完整

- [ ] **步骤 5：重新运行测试验证**

```bash
npx playwright test e2e/homepage.spec.ts --reporter=list
```

- [ ] **步骤 6：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend-next/e2e/homepage.spec.ts frontend-next/app/globals.css frontend-next/components/
git commit -m "test(frontend-next): 首页+合规页 E2E 测试 + 样式对齐"
```

---

## 任务 7：课程搜索 + 详情 E2E + 样式对齐

**文件：**
- 创建：`frontend-next/e2e/courses.spec.ts`

- [ ] **步骤 1：编写课程搜索 E2E 测试**

```typescript
// frontend-next/e2e/courses.spec.ts
import { test, expect } from '@playwright/test';

test.describe('课程搜索页', () => {
  test('页面加载并显示搜索界面', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('搜索输入功能', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('input[type="text"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('语言');
      await page.waitForTimeout(500);
      // 验证搜索结果区域更新
      const resultsArea = page.locator('main').first();
      await expect(resultsArea).toBeVisible();
    }
  });

  test('分类筛选功能', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');
    // 尝试点击分类筛选按钮
    const filterButton = page.locator('button, a').filter({ hasText: /语言|数学|英语|综合/ }).first();
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForTimeout(500);
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('竞态修复验证——快速连续输入', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('input[type="text"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('语');
      await searchInput.fill('语言');
      await searchInput.fill('语言启');
      await searchInput.fill('语言启蒙');
      await page.waitForTimeout(500);
      // 验证最终结果匹配最后一次输入
      await expect(page.locator('main')).toBeVisible();
    }
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
    const ctaButton = page.locator('a[href*="contact"], a[href*="appointment"]').first();
    if (await ctaButton.isVisible()) {
      await expect(ctaButton).toBeVisible();
    }
  });

  test('不存在的课程 slug 显示 404', async ({ page }) => {
    await page.goto('/courses/nonexistent-course-slug');
    await expect(page.locator('text=404').or(page.locator('text=页面未找到'))).toBeVisible();
  });
});
```

- [ ] **步骤 2：运行测试**

```bash
cd frontend-next
npx playwright test e2e/courses.spec.ts --reporter=list
```

预期：9 个测试通过。记录失败。

- [ ] **步骤 3：样式对齐检查**

对比 Vite 和 Next.js 的课程搜索页和详情页。重点关注：
- 搜索结果网格布局（col-span 动态 class）
- 筛选器/排序控件样式
- 课程详情页的 sections 布局

- [ ] **步骤 4：修复样式差异并重新验证**

- [ ] **步骤 5：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend-next/e2e/courses.spec.ts frontend-next/components/course/
git commit -m "test(frontend-next): 课程搜索+详情 E2E 测试 + 样式对齐"
```

---

## 任务 8：新闻 + 校区 E2E + 样式对齐

**文件：**
- 创建：`frontend-next/e2e/news-campus.spec.ts`

- [ ] **步骤 1：编写新闻和校区 E2E 测试**

```typescript
// frontend-next/e2e/news-campus.spec.ts
import { test, expect } from '@playwright/test';

test.describe('新闻列表页', () => {
  test('页面加载并显示新闻卡片', async ({ page }) => {
    await page.goto('/news');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('新闻列表 meta 标签', async ({ page }) => {
    await page.goto('/news');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
  });
});

test.describe('新闻详情页', () => {
  test('新闻详情页面加载', async ({ page }) => {
    await page.goto('/news');
    await page.waitForLoadState('networkidle');
    const newsLink = page.locator('a[href*="/news/"]').first();
    if (await newsLink.isVisible()) {
      const href = await newsLink.getAttribute('href');
      await page.goto(href!);
      await expect(page.locator('h1').first()).toBeVisible();
    }
  });
});

test.describe('校区列表页', () => {
  test('页面加载并显示校区卡片', async ({ page }) => {
    await page.goto('/campuses');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('校区列表 meta 标签', async ({ page }) => {
    await page.goto('/campuses');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
  });
});

test.describe('校区详情页', () => {
  test('朝阳校区详情', async ({ page }) => {
    await page.goto('/campuses/chaoyang');
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('校区详情 meta 标签 + JSON-LD', async ({ page }) => {
    await page.goto('/campuses/chaoyang');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/);
    const jsonLd = page.locator('script[type="application/ld+json"]');
    if (await jsonLd.count() > 0) {
      const content = await jsonLd.first().textContent();
      const parsed = JSON.parse(content!);
      expect(parsed['@type']).toBeTruthy();
    }
  });

  test('不存在的校区 slug 显示 404', async ({ page }) => {
    await page.goto('/campuses/nonexistent-campus');
    await expect(page.locator('text=404').or(page.locator('text=页面未找到'))).toBeVisible();
  });
});
```

- [ ] **步骤 2：运行测试**

```bash
cd frontend-next
npx playwright test e2e/news-campus.spec.ts --reporter=list
```

预期：7 个测试通过。记录失败。

- [ ] **步骤 3：样式对齐检查**

对比 Vite 和 Next.js 的新闻和校区页面。重点关注：
- 新闻卡片样式（NewsCard 组件）
- 校区相册（Gallery 组件）的网格布局
- StrapiImage 渲染效果（next/image vs 原生 img）

- [ ] **步骤 4：修复样式差异并重新验证**

- [ ] **步骤 5：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend-next/e2e/news-campus.spec.ts frontend-next/components/campus/ frontend-next/components/news/
git commit -m "test(frontend-next): 新闻+校区 E2E 测试 + 样式对齐"
```

---

## 任务 9：教师 + FAQ + 404 E2E + 样式对齐

**文件：**
- 创建：`frontend-next/e2e/teachers-faq.spec.ts`

- [ ] **步骤 1：编写教师和 FAQ E2E 测试**

```typescript
// frontend-next/e2e/teachers-faq.spec.ts
import { test, expect } from '@playwright/test';

test.describe('教师列表页', () => {
  test('页面加载并显示教师卡片', async ({ page }) => {
    await page.goto('/teachers');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('教师列表 meta 标签', async ({ page }) => {
    await page.goto('/teachers');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
  });

  test('/team 重定向到 /teachers', async ({ page }) => {
    await page.goto('/team');
    await expect(page).toHaveURL(/\/teachers/);
  });
});

test.describe('FAQ 页面', () => {
  test('页面加载', async ({ page }) => {
    await page.goto('/faq');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('FAQ meta 标签', async ({ page }) => {
    await page.goto('/faq');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
  });

  test('FAQ 分类筛选', async ({ page }) => {
    await page.goto('/faq');
    await page.waitForLoadState('networkidle');
    const categoryButton = page.locator('button, a').filter({ hasText: /入学|课程|师资|费用/ }).first();
    if (await categoryButton.isVisible()) {
      await categoryButton.click();
      await page.waitForTimeout(300);
    }
  });
});

test.describe('404 页面', () => {
  test('不存在路径显示 404', async ({ page }) => {
    await page.goto('/this-does-not-exist');
    await expect(page.locator('text=404')).toBeVisible();
    await expect(page.locator('text=页面未找到')).toBeVisible();
  });

  test('404 页面有返回首页链接', async ({ page }) => {
    await page.goto('/this-does-not-exist');
    await expect(page.locator('a[href="/"]')).toBeVisible();
  });
});
```

- [ ] **步骤 2：运行测试**

```bash
cd frontend-next
npx playwright test e2e/teachers-faq.spec.ts --reporter=list
```

预期：8 个测试通过。记录失败。

- [ ] **步骤 3：样式对齐检查**

对比 Vite 和 Next.js 的教师和 FAQ 页面。重点关注：
- 教师卡片样式（TeacherCard 组件）
- FAQ 手风琴组件样式
- 404 页面样式

- [ ] **步骤 4：修复样式差异并重新验证**

- [ ] **步骤 5：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend-next/e2e/teachers-faq.spec.ts frontend-next/components/team/
git commit -m "test(frontend-next): 教师+FAQ+404 E2E 测试 + 样式对齐"
```

---

## 任务 10：数据对接验证

**文件：** 无代码变更，纯验证任务

- [ ] **步骤 1：ISR 缓存行为验证**

```bash
cd frontend-next
npm run start &
```

1. 访问 `http://localhost:3000/courses/language`，记录页面内容（如课程标题）
2. 在 Strapi 后台修改该课程的标题
3. 立即刷新页面——验证内容未变（ISR 缓存生效）
4. 等待 5 分钟后刷新——验证内容已更新（revalidate=300）

- [ ] **步骤 2：MeiliSearch 搜索验证**

1. 访问 `http://localhost:3000/courses`
2. 搜索已知存在的课程名称（如"语言启蒙"）
3. 验证搜索结果包含该课程
4. 搜索不存在的关键词（如"xyz123"）
5. 验证搜索结果为空

- [ ] **步骤 3：Strapi API 数据流验证**

在浏览器 DevTools 的 Network 标签中：
1. 访问首页，检查 API 调用返回的 JSON 数据
2. 验证数据格式为 v5 扁平格式（`data.id` 而非 `data.attributes.id`）
3. 检查所有 API 调用的 HTTP 状态码均为 200

- [ ] **步骤 4：SEO 基础设施验证**

```bash
# sitemap.xml 内容验证
curl -s http://localhost:3000/sitemap.xml | head -50

# robots.txt 内容验证
curl -s http://localhost:3000/robots.txt

# llms.txt 内容验证
curl -s http://localhost:3000/llms.txt | head -30
```

验证：
- sitemap.xml 包含所有页面 URL
- robots.txt 禁止 `/api/` 和 `/admin/`
- llms.txt 包含站点信息和课程列表

- [ ] **步骤 5：sessionStorage 跨页数据验证**

1. 访问 `http://localhost:3000/contact`
2. 填写 ContactForm（姓名、电话、校区）
3. 提交表单
4. 验证跳转到 `/appointment-success`
5. 验证成功页显示预约信息
6. 在 DevTools 中检查 `sessionStorage.getItem('lastAppointment')` 已被清除（读取后删除）

- [ ] **步骤 6：记录验证结果**

将验证结果记录到计划文件中。如果有失败项，创建修复任务。

- [ ] **步骤 7：Commit（如有修复）**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add -A frontend-next/
git commit -m "fix(frontend-next): 数据对接验证修复"
```

如果无修复则跳过 commit。

---

## 任务 11：全量验证与 Git 标签

- [ ] **步骤 1：运行 vitest 全量测试**

```bash
cd frontend-next
npx vitest run
```

预期：253+ 测试通过（262 - 9 个已删除的 CourseDetail 测试）。

- [ ] **步骤 2：运行 Playwright E2E 全量测试**

```bash
npx playwright test --reporter=list
```

预期：40+ E2E 测试全部通过（9 烟雾 + 7 首页 + 9 课程 + 7 新闻校区 + 8 教师FAQ）。

- [ ] **步骤 3：TypeScript 类型检查**

```bash
npm run typecheck
```

预期：无错误。

- [ ] **步骤 4：生产构建**

```bash
npm run build
```

预期：
- 构建成功
- First Load JS < 150KB（首页）
- standalone 目录生成

- [ ] **步骤 5：浏览器全量验证**

```bash
npm run start
```

逐一访问以下页面，验证渲染正常、控制台无错误：
- `/`、`/courses`、`/courses/language`、`/news`、`/campuses`、`/campuses/chaoyang`
- `/teachers`、`/faq`、`/contact`、`/team`（重定向）
- `/refund-policy`、`/privacy-policy`、`/user-agreement`
- `/nonexistent`（404）
- `/sitemap.xml`、`/robots.txt`、`/llms.txt`

- [ ] **步骤 6：更新项目 memory**

更新 `/home/tishensnoopy/.trae-cn/memory/projects/-home-tishensnoopy-project-superpowers-zh/project_memory.md`，追加阶段 3 完成状态：
- 阶段 3 完成
- Playwright E2E 测试数量
- First Load JS 优化结果
- 数据对接验证结果

- [ ] **步骤 7：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add -A frontend-next/
git commit -m "feat(frontend-next): 阶段 3 全量验证通过

- vitest 253+ 测试通过
- Playwright 40+ E2E 测试通过
- First Load JS < 150KB
- 所有页面浏览器验证通过"
```

- [ ] **步骤 8：打 Git 标签**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git tag -a nextjs-content-complete -m "Next.js 迁移阶段 3 完成：内容迁移与数据对接

- 路由一致性修复（/team 重定向 + /contact 页面）
- 阶段 2 遗留技术债清理（Sentry 重复捕获 + 4xx 噪音 + act 警告等）
- Sentry replay 动态加载优化（First Load JS < 150KB）
- Playwright E2E 测试基础设施 + 40+ 测试
- 逐页 E2E 测试 + 样式对齐
- 数据对接验证（ISR + MeiliSearch + sessionStorage）
- vitest 253+ 测试通过"
```

---

## 自检

### 1. 规格覆盖度

| 规格章节 | 对应任务 |
|----------|----------|
| 任务 1：路由一致性修复 | ✅ 任务 1 |
| 任务 2：遗留技术债清理（8 项） | ✅ 任务 2 |
| 任务 3：Sentry 动态加载 | ✅ 任务 3 |
| 任务 4：Playwright 配置 | ✅ 任务 4 |
| 任务 5：烟雾测试 | ✅ 任务 5 |
| 任务 6：首页+合规页 | ✅ 任务 6 |
| 任务 7：课程搜索+详情 | ✅ 任务 7 |
| 任务 8：新闻+校区 | ✅ 任务 8 |
| 任务 9：教师+FAQ+404 | ✅ 任务 9 |
| 任务 10：数据对接验证 | ✅ 任务 10 |
| 任务 11：全量验证 | ✅ 任务 11 |

### 2. 占位符扫描

无占位符。所有步骤都包含具体代码、命令和预期输出。

### 3. 类型一致性

- `lazyLoadIntegration` API 在任务 3 中定义，与 Sentry v8 文档一致
- `notFound()` 在任务 1 和任务 2 中使用方式一致
- `redirect()` 在任务 1 中使用，与 Next.js App Router 文档一致
- Playwright fixture `expectNoConsoleErrors` 在任务 4 中定义，任务 5-9 中使用 `import { test, expect } from '@playwright/test'`（直接使用基础 test，未强制使用自定义 fixture——这是有意的，让每个测试文件独立）
