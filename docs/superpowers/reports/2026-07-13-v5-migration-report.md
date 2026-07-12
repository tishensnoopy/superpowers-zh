# 阶段 1 技术债修复：Strapi v5 扁平格式迁移 + 竞态修复

> Git 标签：`v5-migration-complete`
> 完成日期：2026-07-13
> 计划文件：[2026-07-12-tech-debt-fix.md](file:///home/tishensnoopy/project/superpowers-zh/docs/superpowers/plans/2026-07-12-tech-debt-fix.md)

## 1. 任务概述

| 任务 | 内容 | 状态 |
|------|------|------|
| 任务 1-7 | 后端控制器移除 v4 包装，返回 v5 扁平格式 | ✅ 已完成（会话前） |
| 任务 8 | 前端 TypeScript 接口扁平化 | ✅ 已完成 |
| 任务 9 | Layout/Footer/Seo/Homepage 组件适配 v5 | ✅ 已完成 |
| 任务 10 | PageRenderer + 9 个 section 组件适配 v5 | ✅ 已完成 |
| 任务 11 | Course 相关组件适配 v5 | ✅ 已完成 |
| 任务 12 | News/Campus/Teacher 组件适配 v5 | ✅ 已完成 |
| 任务 13 | FaqPage + CampusDetailPage 适配 v5 + 测试 mock 扁平化 | ✅ 已完成 |
| 任务 14 | useProductSearch 竞态修复（TDD） | ✅ 已完成 |
| 任务 15 | 全量回归 + 浏览器验证 | ✅ 已完成 |

## 2. 背景

Strapi v5 的 Document Service 返回扁平格式 `{id, documentId?, ...fields}`，而 Strapi v4 返回嵌套格式 `{id, attributes: {...}}`。本项目后端已升级到 Strapi v5，但前端代码仍按 v4 格式访问 `xxx.attributes.xxx`，导致运行时 `undefined` 访问错误。

此外，`useProductSearch` hook 使用 `requestingRef` 布尔值阻塞策略处理并发请求，当用户快速连续输入时，第二次请求会被第一次请求阻塞而无法发出，导致搜索体验卡顿。

本次技术债修复分两条主线：
1. 前端全量适配 v5 扁平格式（删除所有 `.attributes` 访问和兼容代码）
2. useProductSearch 竞态修复（requestIdRef + AbortController 替代 requestingRef 阻塞）

## 3. v5 扁平格式迁移详情

### 3.1 格式差异

```typescript
// v4 格式（已废弃）
{
  id: 1,
  attributes: {
    name: '课程A',
    slug: 'course-a',
    image: { data: { attributes: { url: '/img.jpg' } } }
  }
}

// v5 格式（当前）
{
  id: 1,
  documentId: 'abc123',
  name: '课程A',
  slug: 'course-a',
  image: { url: '/img.jpg', alternativeText: '课程A图片' }
}
```

### 3.2 接口层变更

**文件**：[frontend/src/lib/api.ts](file:///home/tishensnoopy/project/superpowers-zh/frontend/src/lib/api.ts)

15 个接口扁平化：

| 接口 | 媒体字段 | 关系字段 |
|------|---------|---------|
| SiteSettings | `logo?: {url, alternativeText?} \| null` | - |
| NavigationItem | - | `children?: NavigationItem[]` |
| Footer | - | `socialLinks?: SocialLink[]`、`quickLinks?: QuickLink[]` |
| SocialLink | - | - |
| QuickLink | - | - |
| Page | - | `sections: Section[]` |
| Seo | `ogImage?: {url, alternativeText?} \| null` | - |
| Product | `image?`、`thumbnail?`、`images?` | `categories?: ProductCategory[]`、`specs?: ProductSpec[]` |
| ProductCategory | - | `parent?: ProductCategory \| null`、`children?: ProductCategory[]` |
| ProductSpec | - | - |
| FaqItem | - | - |
| NewsArticle | `coverImage?: {url, alternativeText?} \| null` | - |
| KnowledgeBase | - | - |
| Teacher | `avatar?: {url, alternativeText?} \| null` | `campus?: Campus \| null` |
| Campus | - | `teachers?: Teacher[]` |

**字段补充**：NewsArticle 和 Campus 接口添加 `seo?: Seo` 字段（详情页需要访问 SEO 元数据）。

**死代码清理**：删除 `toV4Item` 和 `toV4Value` 两个兼容函数（无任何调用方）。

### 3.3 组件层变更

所有组件的 `.attributes` 访问扁平化，涉及文件：

| 分类 | 文件 | 变更说明 |
|------|------|---------|
| 布局 | [Layout.tsx](file:///home/tishensnoopy/project/superpowers-zh/frontend/src/layout/Layout.tsx) | 删除 socialAttrs/itemAttrs/childAttrs 别名变量 |
| 布局 | [Footer.tsx](file:///home/tishensnoopy/project/superpowers-zh/frontend/src/layout/Footer.tsx) | socialLinks/quickLinks 直接访问 |
| SEO | [Seo.tsx](file:///home/tishensnoopy/project/superpowers-zh/frontend/src/components/Seo.tsx) | ogImage.url 直接访问 |
| 页面 | [PageRenderer.tsx](file:///home/tishensnoopy/project/superpowers-zh/frontend/src/pages/PageRenderer.tsx) | page.attributes → page 直接访问 |
| Section | 9 个 section 组件 | section.attributes → section 直接访问 |
| 课程 | [CourseDetail.tsx](file:///home/tishensnoopy/project/superpowers-zh/frontend/src/components/course/CourseDetail.tsx) | 移除 `const { attributes } = product;` 解构 |
| 课程 | [CourseHeader.tsx](file:///home/tishensnoopy/project/superpowers-zh/frontend/src/components/course/CourseHeader.tsx) | product.attributes → product 解构 |
| 课程 | [CategoryFilter.tsx](file:///home/tishensnoopy/project/superpowers-zh/frontend/src/components/course/CategoryFilter.tsx) | 删除 normalizeCategory 双格式兼容函数 |
| 课程 | [SearchResultsGrid.tsx](file:///home/tishensnoopy/project/superpowers-zh/frontend/src/components/course/SearchResultsGrid.tsx) | 删除 `p = product.attributes \|\| product` 别名 |
| 新闻 | [NewsCard.tsx](file:///home/tishensnoopy/project/superpowers-zh/frontend/src/components/news/NewsCard.tsx) | coverImage.url 直接访问 |
| 新闻 | [NewsDetailPage.tsx](file:///home/tishensnoopy/project/superpowers-zh/frontend/src/pages/NewsDetailPage.tsx) | coverImage + seo 扁平访问 |
| 校区 | 5 个 campus 组件 | campus/teacher 扁平访问 |
| 校区 | [CampusDetailPage.tsx](file:///home/tishensnoopy/project/superpowers-zh/frontend/src/pages/CampusDetailPage.tsx) | 移除 `const { attributes } = campus;` 解构 |
| 教师 | [TeacherCard.tsx](file:///home/tishensnoopy/project/superpowers-zh/frontend/src/components/team/TeacherCard.tsx) | teacher/avatar/campus 扁平访问 |
| 教师 | [TeacherDetail.tsx](file:///home/tishensnoopy/project/superpowers-zh/frontend/src/components/team/TeacherDetail.tsx) | teacher 扁平访问 |
| FAQ | [FaqPage.tsx](file:///home/tishensnoopy/project/superpowers-zh/frontend/src/pages/FaqPage.tsx) | faq.attributes → faq 直接访问 |

### 3.4 后端控制器变更（任务 1-7，会话前完成）

后端控制器移除 v4 包装函数，直接返回 Strapi v5 Document Service 的扁平格式：

| 控制器 | 删除的函数 |
|--------|-----------|
| teacher | `transformTeacher`、`wrapMedia` |
| campus | `transformCampus`、`wrapMedia` |
| product | `findBySlug` 中的 v4 包装逻辑 |

### 3.5 测试 mock 数据扁平化

所有单元测试的 mock 数据从 v4 格式改为 v5 扁平格式：

```typescript
// 之前（v4 mock）
const mockProduct = { id: 1, attributes: { name: '课程A', slug: 'a' } };

// 之后（v5 mock）
const mockProduct = { id: 1, documentId: 'd1', name: '课程A', slug: 'a' };
```

涉及测试文件：Layout.test.tsx、Footer.test.tsx、Homepage.test.tsx、PageRenderer.test.tsx、9 个 section 测试、CourseDetail.test.tsx、CourseHeader.test.tsx、CategoryFilter.test.tsx、SearchResultsGrid.test.tsx、CourseSearchPanel.test.tsx、CoursesPage.test.tsx、NewsCard.test.tsx、NewsDetailPage.test.tsx、NewsListPage.test.tsx、5 个 campus 测试、CampusDetailPage.test.tsx、CampusOverviewPage.test.tsx、TeacherCard.test.tsx、TeacherDetail.test.tsx、TeamGrid.test.tsx、TeamPage.test.tsx、FaqPage.test.tsx、useProductSearch.test.ts。

## 4. useProductSearch 竞态修复详情

### 4.1 问题描述

**文件**：[frontend/src/hooks/useProductSearch.ts](file:///home/tishensnoopy/project/superpowers-zh/frontend/src/hooks/useProductSearch.ts)

原实现使用 `requestingRef` 布尔值阻塞策略：

```typescript
// 原实现（有问题）
if (requestingRef.current) return;  // 阻塞第二次请求
requestingRef.current = true;
try {
  const response = await searchProducts({...});
  // ...
} finally {
  requestingRef.current = false;
}
```

**问题场景**：用户快速连续输入 "a" → "ab"：
1. 输入 "a"，触发请求 1，`requestingRef.current = true`
2. 300ms 防抖后，输入 "ab"，触发请求 2，但因 `requestingRef.current === true` 被阻塞
3. 请求 1 完成，`requestingRef.current = false`
4. 请求 2 永远不会发出，用户看到的是 "a" 的结果而非 "ab" 的结果

### 4.2 修复方案

采用 `requestIdRef`（递增 ID 检查）+ `AbortController`（取消标记）双保险策略：

```typescript
const requestIdRef = useRef(0);
const abortControllerRef = useRef<AbortController | null>(null);

const doSearch = useCallback(async () => {
  const currentRequestId = ++requestIdRef.current;

  // 取消前一个请求
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
  const controller = new AbortController();
  abortControllerRef.current = controller;

  setLoading(true);
  setError(null);
  try {
    const response = await searchProducts({...});

    // 双重检查：请求 ID 不匹配或已取消，则丢弃结果
    if (currentRequestId !== requestIdRef.current || controller.signal.aborted) {
      return;
    }

    setResults(response.data);
    setTotal(response.meta.total);
    setPageCount(response.meta.pageCount);
  } catch (err) {
    if (controller.signal.aborted) return;
    if (currentRequestId !== requestIdRef.current) return;
    setError(err instanceof Error ? err.message : String(err));
  } finally {
    if (currentRequestId === requestIdRef.current && !controller.signal.aborted) {
      setLoading(false);
    }
  }
}, [query, category, sort, page]);
```

**卸载时清理**：

```typescript
useEffect(() => {
  return () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  };
}, []);
```

### 4.3 TDD 流程

**Red 阶段**：先写测试证明 `requestingRef` 阻塞问题。

```typescript
it('快速连续查询时，两次请求都发出且只应用最新请求的结果', async () => {
  // ... 设置 pending promises ...
  act(() => { result.current.setQuery('a'); });
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
  act(() => { result.current.setQuery('ab'); });
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });

  // 关键断言：两次查询都应触发请求（不被 requestingRef 阻塞）
  expect(searchProducts).toHaveBeenCalledTimes(2);

  // 旧结果不应被应用
  await act(async () => { resolveFirst({...}); });
  expect(result.current.results).toEqual([]);

  // 新结果应被应用
  await act(async () => { resolveSecond({...}); });
  expect(result.current.results).toEqual([{ id: 2, name: '新结果', ... }]);
});
```

**Green 阶段**：重写实现，验证测试通过。

**卸载 abort 测试**：使用 `vi.spyOn(AbortController.prototype, 'abort')` 验证卸载时 abort 被调用。

```typescript
it('组件卸载时取消进行中的请求，旧结果不应用', async () => {
  const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
  // ... 设置 pending request ...
  unmount();
  expect(abortSpy).toHaveBeenCalled();
  abortSpy.mockRestore();
});
```

## 5. 验证结果

### 5.1 单元测试

```
Test Files  43 passed (43)
     Tests  345 passed (345)
```

### 5.2 TypeScript 检查

12 个预存错误（非 v5 相关），所有 v5 迁移相关错误已修复。

### 5.3 浏览器验证

使用 TRAE 内建浏览器工具（browser_use subagent）验证：

| 页面 | 路由 | 渲染 | 控制台错误 | API 请求 |
|------|------|------|-----------|---------|
| 首页 | `/` | ✅ | 无 v5 相关错误 | 全部 200 |
| 课程搜索 | `/courses` | ✅ | 无 | `/api/products/search` 200 |
| 课程详情 | `/courses/:slug` | ✅ | 无 | 200 |
| 新闻列表 | `/news` | ✅ | 无 | 200 |
| 新闻详情 | `/news/:slug` | ✅ | 无 | 200 |
| 校区列表 | `/campuses` | ✅ | 无 | 200 |
| FAQ | `/faq` | ✅ | 无 | 200 |

**注**：教师页 `/teachers` 返回 404，是路由/内容配置问题，非 v5 迁移导致，不在本次范围。

## 6. 遗留问题与后续计划

### 6.1 E2E Mock 数据未迁移（已知遗留）

**文件**：`frontend/e2e/mocks/data.ts`、`frontend/e2e/mocks/routeHandlers.ts`

这些 E2E 测试 mock 数据仍使用 v4 格式 `{id, attributes: {...}}`。根据项目决策，E2E 测试目前不启用（开发阶段使用 TRAE 内建浏览器工具，Playwright 保留供未来 CI/CD 使用），因此不阻塞当前功能。

**后续行动**：当启用 E2E 测试进 CI/CD 时，需要将 mock数据迁移到 v5 扁平格式。

### 6.2 Strapi 生成类型文件（无需清理）

`backend/types/generated/contentTypes.d.ts` 和 `components.d.ts` 中的 `attributes` 是 Strapi schema 定义的语法，非 v4 API 响应格式，正常保留。

### 6.3 教师页 404（非 v5 问题）

`/teachers` 路由返回 404，需检查 Strapi 路由配置或前端路由定义。不在本次技术债修复范围。

## 7. 经验总结

### 7.1 grep 搜索的局限性

grep 搜索 `.attributes` 模式会遗漏解构用法：

```typescript
// grep ".attributes" 能找到
product.attributes.name

// grep ".attributes" 找不到（解构后通过 attributes 变量访问）
const { attributes } = product;
attributes.name;
```

**教训**：v5 迁移时需要同时搜索 `.attributes` 和 `const { attributes`` 两种模式。

### 7.2 TDD 在竞态修复中的价值

竞态问题难以通过手动测试复现（需要精确控制请求完成顺序）。TDD 流程（先写 Red 测试用 fake timers 控制 promise resolve 顺序）能可靠复现问题，并验证修复有效。

### 7.3 双格式兼容代码是技术债

`normalizeCategory`、`p = product.attributes || product` 等双格式兼容代码在迁移期看似方便，但会掩盖真实问题，增加后续清理成本。应在迁移完成后立即删除，而非长期保留。

## 8. 提交历史

```
58582ab docs(plan): 归档阶段 1 技术债修复实现计划
1d7c457 test(frontend): 增强卸载 abort 测试——验证 AbortController.abort 被调用
6185b14 fix(frontend): useProductSearch 竞态修复——AbortController + requestIdRef 替换 requestingRef 阻塞
ef48bd5 fix(frontend): useProductSearch.test.ts mock 数据改为 v5 扁平格式（任务 13 规格补充）
9e5a1bc refactor(frontend): FaqPage+CampusDetailPage 适配 v5 扁平格式，完成全量 TypeScript 检查
af4d878 fix(frontend): 修复任务 12 遗留——TeamGrid/TeamPage 测试 mock 扁平化 + NewsArticle 接口添加 seo 字段
fc32408 refactor(frontend): News/Campus/Teacher 组件适配 v5 扁平格式
f106c9c refactor(frontend): Course 组件适配 v5 扁平格式，移除双格式兼容代码
53b9bcb refactor(frontend): PageRenderer + section 组件适配 v5 扁平格式
f640956 refactor(frontend): 修复任务 9 代码审查问题——删除死代码别名 + 统一测试 mock 格式
19ccdee refactor(frontend): Seo/Layout/Footer/Homepage 组件适配 v5 扁平格式
b6ff994 refactor(frontend): 补充 Teacher/Campus 接口为 v5 扁平格式（任务 8 规格补充）
e429323 refactor(frontend): lib/api.ts 接口改为 v5 扁平格式 + 删除 toV4 死代码 + 优化 logResponse
```
