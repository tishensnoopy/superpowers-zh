# 阶段 1：技术债修复 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将后端 9 个控制器统一为 Strapi v5 扁平格式，前端全部适配，修复 useProductSearch 竞态和 DB 回退性能问题，为 Next.js 迁移建立一致的基础。

**架构：** 后端移除所有 `transformXxx()`/`wrapItem()`/`wrapMedia()` 包装函数，控制器直接返回 Document Service 原生扁平格式。前端 `lib/api.ts` 接口从 `{id, attributes: {...}}` 改为 `{id, documentId, ...fields}`，所有页面组件、布局组件、测试 mock 同步适配。性能层面用 `AbortController + requestIdRef` 替换 `requestingRef` 阻塞策略。

**技术栈：** Strapi v5 Document Service、React 18、TypeScript、Vite 6、Vitest

---

## 文件结构

### 后端修改（7 个控制器文件）

| 文件 | 职责 | 修改内容 |
|------|------|----------|
| `backend/src/api/page/controllers/page.ts` | 页面 CRUD | 移除 4 处 `{id, ...attributes}` 包装 |
| `backend/src/api/faq-item/controllers/faq-item.ts` | FAQ CRUD + 搜索 | 移除 `wrapItem()` + 4 处调用 |
| `backend/src/api/site-settings/controllers/site-settings.ts` | 站点设置 | 移除 `find()` 中包装 |
| `backend/src/api/footer/controllers/footer.ts` | 页脚 | 移除 `find()` 中包装 |
| `backend/src/api/navigation/controllers/navigation.ts` | 导航 | 移除 `find()` + `getNavigationTree()` 包装 |
| `backend/src/api/news-article/controllers/news-article.ts` | 新闻 | 移除 `transformArticle()` + `wrapMedia()` |
| `backend/src/api/teacher/controllers/teacher.ts` | 教师 | 移除 `transformTeacher()` + `wrapMedia()` + `wrapItem()` |
| `backend/src/api/campus/controllers/campus.ts` | 校区 | 移除 `transformCampus()` + `wrapMedia()` + `wrapItem()` + `transformTeacherRef()` |
| `backend/src/api/product/controllers/product.ts` | 课程 | 移除 `findBySlug` 中 `wrapMedia()` + 优化 DB 回退 |

### 前端修改

| 文件 | 职责 | 修改内容 |
|------|------|----------|
| `frontend/src/lib/api.ts` | API 客户端 + TS 接口 | 接口扁平化 + 删除 `toV4Item/toV4Value` + 优化 `logResponse` |
| `frontend/src/components/Seo.tsx` | SEO meta 注入 | `ogImage` 访问路径扁平化 |
| `frontend/src/pages/PageRenderer.tsx` | 动态页面渲染 | `page.attributes.sections` → `page.sections` |
| `frontend/src/pages/FaqPage.tsx` | FAQ 页 | `item.attributes.xxx` → `item.xxx` |
| `frontend/src/pages/Homepage.tsx` | 首页 | `settings.attributes.xxx` → `settings.xxx` |
| `frontend/src/layout/Layout.tsx` | 布局 | `nav.attributes.children` → `nav.children` |
| `frontend/src/components/layout/Footer.tsx` | 页脚组件 | `footer.attributes.xxx` → `footer.xxx` |
| `frontend/src/components/course/CourseDetail.tsx` | 课程详情 | `product.attributes.xxx` → `product.xxx` |
| `frontend/src/components/course/CourseHeader.tsx` | 课程头部 | 同上 |
| `frontend/src/components/course/SearchResultsGrid.tsx` | 搜索结果 | 移除双格式兼容，仅 v5 |
| `frontend/src/components/course/CategoryFilter.tsx` | 分类筛选 | 移除 `normalizeCategory`，仅 v5 |
| `frontend/src/components/news/NewsCard.tsx` | 新闻卡片 | `article.attributes.xxx` → `article.xxx` |
| `frontend/src/components/campus/*.tsx` | 校区组件（6 个） | `campus.attributes.xxx` → `campus.xxx` |
| `frontend/src/components/team/*.tsx` | 教师组件（4 个） | `teacher.attributes.xxx` → `teacher.xxx` |
| `frontend/src/components/sections/*.tsx` | 首页 section（8 个） | 各 section 内 `xxx.attributes` → `xxx` |
| `frontend/src/hooks/useProductSearch.ts` | 搜索 hook | `AbortController` + `requestIdRef` 替换 `requestingRef` |
| `frontend/src/**/__tests__/*.test.{ts,tsx}` | 全部测试（30+ 文件） | mock 数据从 v4 改为 v5 扁平 |

---

## 任务 1：后端 page.ts → v5 扁平格式

**文件：**
- 修改：`backend/src/api/page/controllers/page.ts`

**背景：** `page.ts` 使用 `factories.createCoreController` + `super.find()/super.findOne()`，然后在 4 个方法中手动将 `{id, ...fields}` 包装为 `{id, attributes: {...}}`。Strapi v5 的 `super.find()` 已经返回扁平格式，包装是多余的。

- [ ] **步骤 1：启动后端并验证当前 v4 格式**

运行（如果后端未启动）：
```bash
cd backend && npm run develop
```

验证当前返回 v4 包装格式：
```bash
curl -s http://localhost:1337/api/pages | python3 -m json.tool | head -20
```
预期：`data` 数组中每个元素有 `id` 和 `attributes` 两个键。

- [ ] **步骤 2：修改 `find()` 方法移除包装**

将 `backend/src/api/page/controllers/page.ts` 的 `find()` 方法中：

```typescript
const result = await super.find(ctx);
if (result.data && Array.isArray(result.data)) {
  result.data = result.data.map(item => {
    const { id, ...attributes } = item;
    return { id, attributes };
  });
}
console.log('[Page] find() completed, count:', result.data?.length);
return result;
```

改为：

```typescript
const result = await super.find(ctx);
console.log('[Page] find() completed, count:', result.data?.length);
return result;
```

- [ ] **步骤 3：修改 `findOne()` 方法移除包装**

将 `findOne()` 方法中：

```typescript
const result = await super.findOne(ctx);
console.log('[Page] findOne() completed');
if (result.data) {
  const { id, ...attributes } = result.data;
  result.data = { id, attributes };
}
return result;
```

改为：

```typescript
const result = await super.findOne(ctx);
console.log('[Page] findOne() completed');
return result;
```

- [ ] **步骤 4：修改 `findBySlug()` 方法移除包装**

将 `findBySlug()` 方法中：

```typescript
const item = result.data?.[0];
if (!item) {
  console.warn('[Page] findBySlug() page not found:', ctx.params.slug);
  return ctx.notFound('Page not found');
}
const { id, ...attributes } = item;
const page = { id, attributes };
console.log('[Page] findBySlug() completed, id:', page.id);
return { data: page, meta: {} };
```

改为：

```typescript
const item = result.data?.[0];
if (!item) {
  console.warn('[Page] findBySlug() page not found:', ctx.params.slug);
  return ctx.notFound('Page not found');
}
console.log('[Page] findBySlug() completed, id:', item.id);
return { data: item, meta: {} };
```

- [ ] **步骤 5：修改 `getHomepage()` 方法移除包装**

将 `getHomepage()` 方法中：

```typescript
const item = result.data?.[0];
if (!item) {
  console.warn('[Page] getHomepage() homepage not found');
  return ctx.notFound('Homepage not found');
}
const { id, ...attributes } = item;
const page = { id, attributes };
console.log('[Page] getHomepage() completed, id:', page.id);
return { data: page, meta: {} };
```

改为：

```typescript
const item = result.data?.[0];
if (!item) {
  console.warn('[Page] getHomepage() homepage not found');
  return ctx.notFound('Homepage not found');
}
console.log('[Page] getHomepage() completed, id:', item.id);
return { data: item, meta: {} };
```

- [ ] **步骤 6：验证 API 返回扁平格式**

重启后端（Strapi develop 会自动热重载，等待控制台输出 `reloaded`）。

运行：
```bash
curl -s http://localhost:1337/api/pages | python3 -m json.tool | head -20
```
预期：`data` 数组中每个元素直接包含 `id`、`documentId`、`title`、`slug` 等字段，**无 `attributes` 键**。

```bash
curl -s http://localhost:1337/api/pages/homepage | python3 -m json.tool | head -20
```
预期：同上，`data` 对象直接包含 `title`、`sections` 等字段。

- [ ] **步骤 7：Commit**

```bash
git add backend/src/api/page/controllers/page.ts
git commit -m "refactor(backend): page 控制器移除 v4 包装，返回 v5 扁平格式"
```

---

## 任务 2：后端 faq-item.ts → v5 扁平格式

**文件：**
- 修改：`backend/src/api/faq-item/controllers/faq-item.ts`

**背景：** `faq-item.ts` 定义了 `wrapItem()` 函数，在 `find`/`findOne`/`findByCategory`/`search` 4 个方法中使用，将 `{id, documentId, ...rest}` 包装为 `{id, documentId, attributes: rest}`。

- [ ] **步骤 1：删除 `wrapItem()` 函数**

删除 `backend/src/api/faq-item/controllers/faq-item.ts` 第 5-9 行：

```typescript
function wrapItem(item: any) {
  if (!item) return null;
  const { id, documentId, ...rest } = item;
  return { id, documentId, attributes: rest };
}
```

- [ ] **步骤 2：修改 `find()` 方法**

将 `find()` 中：

```typescript
const data = (faqs || []).map(wrapItem);
console.log('[FaqItem] find() completed, count:', data.length);
return { data, meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } } };
```

改为：

```typescript
const data = faqs || [];
console.log('[FaqItem] find() completed, count:', data.length);
return { data, meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } } };
```

- [ ] **步骤 3：修改 `findOne()` 方法**

将 `findOne()` 中：

```typescript
return { data: wrapItem(faq), meta: {} };
```

改为：

```typescript
return { data: faq, meta: {} };
```

- [ ] **步骤 4：修改 `findByCategory()` 方法**

将 `findByCategory()` 中：

```typescript
const data = (faqs || []).map(wrapItem);
```

改为：

```typescript
const data = faqs || [];
```

- [ ] **步骤 5：修改 `search()` 方法**

将 `search()` 中：

```typescript
const data = (faqs || []).map(wrapItem);
```

改为：

```typescript
const data = faqs || [];
```

- [ ] **步骤 6：验证 API**

```bash
curl -s 'http://localhost:1337/api/faq-items' | python3 -m json.tool | head -15
```
预期：`data` 数组中每个元素直接包含 `id`、`documentId`、`question`、`answer` 等字段。

- [ ] **步骤 7：Commit**

```bash
git add backend/src/api/faq-item/controllers/faq-item.ts
git commit -m "refactor(backend): faq-item 控制器移除 wrapItem，返回 v5 扁平格式"
```

---

## 任务 3：后端单例控制器（site-settings / footer / navigation）→ v5 扁平格式

**文件：**
- 修改：`backend/src/api/site-settings/controllers/site-settings.ts`
- 修改：`backend/src/api/footer/controllers/footer.ts`
- 修改：`backend/src/api/navigation/controllers/navigation.ts`

**背景：** 3 个单例控制器都在 `find()` 中使用相同的包装模式：`result.data.map(item => { const { id, ...attributes } = item; return { id, attributes }; })`。`navigation.ts` 的 `getNavigationTree()` 还有更复杂的递归包装。

- [ ] **步骤 1：修改 `site-settings.ts` 的 `find()` 方法**

删除 `find()` 中的包装代码：

```typescript
if (result.data && Array.isArray(result.data)) {
  result.data = result.data.map(item => {
    const { id, ...attributes } = item;
    return { id, attributes };
  });
}
```

保留 `return result;`。

- [ ] **步骤 2：修改 `footer.ts` 的 `find()` 方法**

删除 `find()` 中相同的包装代码块（与步骤 1 相同的模式）。

- [ ] **步骤 3：修改 `navigation.ts` 的 `find()` 方法**

删除 `find()` 中相同的包装代码块。

- [ ] **步骤 4：修改 `navigation.ts` 的 `getNavigationTree()` 方法**

将 `getNavigationTree()` 中：

```typescript
const formatItem = (item) => {
  const { id, children, ...attributes } = item;
  const formattedChildren = children?.map(child => formatItem(child)) || [];
  return { id, attributes: { ...attributes, children: { data: formattedChildren } } };
};

const formattedItems = items.map(item => formatItem(item));
console.log('[Navigation] getNavigationTree() completed, root items:', formattedItems.length);
return { data: formattedItems, meta: {} };
```

改为：

```typescript
console.log('[Navigation] getNavigationTree() completed, root items:', items.length);
return { data: items, meta: {} };
```

**说明：** Strapi v5 Document Service 的 `findMany` 已经返回扁平格式，`children` 关系字段在 `populate` 中配置后直接作为数组返回，无需递归包装。

- [ ] **步骤 5：验证 3 个 API 端点**

```bash
curl -s http://localhost:1337/api/site-settings | python3 -m json.tool | head -15
curl -s 'http://localhost:1337/api/footer?populate=socialLinks&populate=quickLinks' | python3 -m json.tool | head -15
curl -s http://localhost:1337/api/navigation/tree | python3 -m json.tool | head -20
```

预期：3 个端点的 `data` 都直接包含字段，无 `attributes` 键。`navigation/tree` 的 `children` 直接是数组（不是 `{data: [...]}` 包装）。

- [ ] **步骤 6：Commit**

```bash
git add backend/src/api/site-settings/controllers/site-settings.ts \
        backend/src/api/footer/controllers/footer.ts \
        backend/src/api/navigation/controllers/navigation.ts
git commit -m "refactor(backend): 单例控制器（site-settings/footer/navigation）移除 v4 包装"
```

---

## 任务 4：后端 news-article.ts → v5 扁平格式

**文件：**
- 修改：`backend/src/api/news-article/controllers/news-article.ts`

**背景：** `news-article.ts` 定义了 `wrapMedia()` 和 `transformArticle()`，在 `find`/`findOne`/`findBySlug` 3 个方法中使用。`transformArticle` 将 `coverImage` 和 `seo.ogImage` 包装为 `{data: {id, documentId, attributes}}` 格式。

- [ ] **步骤 1：删除 `wrapMedia()` 和 `transformArticle()` 函数**

删除文件第 5-22 行的全部代码：

```typescript
function wrapMedia(media: any) {
  if (!media) return { data: null };
  const { id, documentId, ...attributes } = media;
  return { data: { id, documentId, attributes } };
}

function transformArticle(article: any) {
  if (!article) return null;
  const { id, documentId, coverImage, ...rest } = article;
  const attributes: any = { ...rest };
  if (coverImage !== undefined) {
    attributes.coverImage = wrapMedia(coverImage);
  }
  if (attributes.seo?.ogImage !== undefined) {
    attributes.seo.ogImage = wrapMedia(attributes.seo.ogImage);
  }
  return { id, documentId, attributes };
}
```

- [ ] **步骤 2：修改 `find()` 方法**

将 `find()` 中：

```typescript
const data = (articles || []).map(transformArticle);
```

改为：

```typescript
const data = articles || [];
```

- [ ] **步骤 3：修改 `findOne()` 方法**

将 `findOne()` 中：

```typescript
ctx.body = { data: transformArticle(article), meta: {} };
```

改为：

```typescript
ctx.body = { data: article, meta: {} };
```

- [ ] **步骤 4：修改 `findBySlug()` 方法**

将 `findBySlug()` 中：

```typescript
ctx.body = { data: transformArticle(article), meta: {} };
```

改为：

```typescript
ctx.body = { data: article, meta: {} };
```

- [ ] **步骤 5：验证 API**

```bash
curl -s 'http://localhost:1337/api/news-articles' | python3 -m json.tool | head -20
```

预期：`data` 数组中每篇文章直接包含 `id`、`documentId`、`title`、`slug`、`coverImage` 等字段。`coverImage` 直接是 `{id, documentId, url, ...}` 或 `null`，**不是 `{data: {attributes: {url}}}`**。

- [ ] **步骤 6：Commit**

```bash
git add backend/src/api/news-article/controllers/news-article.ts
git commit -m "refactor(backend): news-article 控制器移除 transformArticle/wrapMedia，返回 v5 扁平格式"
```

---

## 任务 5：后端 teacher.ts → v5 扁平格式

**文件：**
- 修改：`backend/src/api/teacher/controllers/teacher.ts`

**背景：** `teacher.ts` 定义了 `wrapItem()`、`wrapMedia()`、`transformTeacher()`，处理 `avatar`（媒体）和 `campus`（关系）的包装。

- [ ] **步骤 1：删除 3 个包装函数**

删除文件第 5-31 行的全部代码：

```typescript
function wrapItem(item: any) { ... }
function wrapMedia(media: any) { ... }
function transformTeacher(teacher: any) { ... }
```

- [ ] **步骤 2：修改 `find()` 方法**

将 `find()` 中：

```typescript
const data = (teachers || []).map(transformTeacher);
```

改为：

```typescript
const data = teachers || [];
```

- [ ] **步骤 3：修改 `findOne()` 方法**

将 `findOne()` 中：

```typescript
ctx.body = { data: transformTeacher(teacher), meta: {} };
```

改为：

```typescript
ctx.body = { data: teacher, meta: {} };
```

- [ ] **步骤 4：验证 API**

```bash
curl -s 'http://localhost:1337/api/teachers' | python3 -m json.tool | head -25
```

预期：`data` 中每个教师对象直接包含 `name`、`avatar`（`{id, documentId, url, ...}` 或 `null`）、`campus`（`{id, documentId, name, slug, ...}` 或 `null`）。

- [ ] **步骤 5：Commit**

```bash
git add backend/src/api/teacher/controllers/teacher.ts
git commit -m "refactor(backend): teacher 控制器移除 transformTeacher/wrapMedia，返回 v5 扁平格式"
```

---

## 任务 6：后端 campus.ts → v5 扁平格式

**文件：**
- 修改：`backend/src/api/campus/controllers/campus.ts`

**背景：** `campus.ts` 是最复杂的控制器，定义了 `wrapItem()`、`wrapMedia()`、`transformTeacherRef()`、`transformCampus()`，处理 `coverImage`、`gallery`（媒体数组）、`teachers`（关系数组）、`seo.ogImage` 的包装。

- [ ] **步骤 1：删除 4 个包装函数**

删除文件第 5-52 行的全部代码：

```typescript
function wrapItem(item: any) { ... }
function wrapMedia(media: any) { ... }
function transformTeacherRef(teacher: any) { ... }
function transformCampus(campus: any) { ... }
```

- [ ] **步骤 2：修改 `find()` 方法**

将 `find()` 中：

```typescript
const data = (campuses || []).map(transformCampus);
```

改为：

```typescript
const data = campuses || [];
```

- [ ] **步骤 3：修改 `findOne()` 方法**

将 `findOne()` 中：

```typescript
ctx.body = { data: transformCampus(campus), meta: {} };
```

改为：

```typescript
ctx.body = { data: campus, meta: {} };
```

- [ ] **步骤 4：检查是否有其他方法使用 transformCampus**

搜索文件中是否还有 `transformCampus`、`transformTeacherRef`、`wrapMedia`、`wrapItem` 的引用。如果文件中有 `findBySlug` 或其他方法使用，同样改为直接返回。

```bash
cd backend && grep -n 'transform\|wrapMedia\|wrapItem' src/api/campus/controllers/campus.ts
```

预期：无输出（所有引用已删除）。

- [ ] **步骤 5：验证 API**

```bash
curl -s 'http://localhost:1337/api/campuses' | python3 -m json.tool | head -30
```

预期：`data` 中每个校区对象直接包含 `name`、`coverImage`（`{id, url, ...}` 或 `null`）、`gallery`（数组，每项是 `{id, url, ...}`）、`teachers`（数组，每项是 `{id, documentId, name, ...}`）。

- [ ] **步骤 6：Commit**

```bash
git add backend/src/api/campus/controllers/campus.ts
git commit -m "refactor(backend): campus 控制器移除 transformCampus/wrapMedia，返回 v5 扁平格式"
```

---

## 任务 7：后端 product.ts findBySlug → v5 扁平格式 + DB 回退优化

**文件：**
- 修改：`backend/src/api/product/controllers/product.ts`

**背景：** `product.ts` 的 `findBySlug` 方法使用 `strapi.db.query()` 获取产品后，手动将 `seo.ogImage` 用 `wrapMedia()` 包装，并将结果包装为 `{id, documentId, attributes: {...}}`。其他自定义方法（search/featured/compare/withCategory）已经返回扁平格式，无需修改。

DB 回退函数 `searchProductsViaDb` 有两个性能问题：
1. `description` 字段的 `$containsi` 搜索（长文本 LIKE 开销过高）
2. `populate: ['thumbnail']` 查询了但返回的 hits 中未使用 thumbnail 字段

- [ ] **步骤 1：删除 `wrapMedia()` 函数**

删除文件第 4-8 行：

```typescript
function wrapMedia(media: any) {
  if (!media) return { data: null };
  const { id, documentId, ...attributes } = media;
  return { data: { id, documentId, attributes } };
}
```

- [ ] **步骤 2：修改 `findBySlug()` 方法返回扁平格式**

将 `findBySlug()` 中：

```typescript
const { id, documentId, ...attributes } = product;

if (attributes.seo?.ogImage) {
  attributes.seo.ogImage = wrapMedia(attributes.seo.ogImage);
}

ctx.body = {
  data: {
    id,
    documentId,
    attributes,
  },
  meta: {},
};
```

改为：

```typescript
ctx.body = {
  data: product,
  meta: {},
};
```

- [ ] **步骤 3：优化 DB 回退 — 移除 description 搜索**

在 `searchProductsViaDb()` 函数中，将：

```typescript
if (params.query) {
  where.$or = [
    { name: { $containsi: params.query } },
    { shortDescription: { $containsi: params.query } },
    { description: { $containsi: params.query } },
  ];
}
```

改为：

```typescript
if (params.query) {
  where.$or = [
    { name: { $containsi: params.query } },
    { shortDescription: { $containsi: params.query } },
  ];
}
```

**说明：** `description` 是富文本长文本字段，LIKE 查询开销过高。`name` 和 `shortDescription` 已覆盖主要搜索场景。

- [ ] **步骤 4：优化 DB 回退 — 移除未使用的 thumbnail populate**

在 `searchProductsViaDb()` 函数中，将：

```typescript
populate: ['categories', 'thumbnail'],
```

改为：

```typescript
populate: ['categories'],
```

**说明：** 返回的 `hits` 对象不包含 `thumbnail` 字段，populate 是无用查询。

- [ ] **步骤 5：验证 API**

```bash
# 验证 findBySlug 返回扁平格式（用实际存在的 slug 替换）
curl -s 'http://localhost:1337/api/products/slug/yuyan-qimeng-jichu' | python3 -m json.tool | head -25
```

预期：`data` 对象直接包含 `id`、`documentId`、`name`、`slug`、`seo` 等字段。`seo.ogImage`（如果存在）直接是 `{id, url, ...}`，不是 `{data: {attributes: {url}}}`。

```bash
# 验证搜索仍正常工作
curl -s 'http://localhost:1337/api/products/search?query=启蒙' | python3 -m json.tool | head -20
```

预期：搜索结果正常返回。

- [ ] **步骤 6：Commit**

```bash
git add backend/src/api/product/controllers/product.ts
git commit -m "refactor(backend): product findBySlug 移除 v4 包装 + DB 回退移除 description 搜索和未用 thumbnail populate"
```

---

## 任务 8：前端 lib/api.ts 接口 → v5 扁平格式 + 删除死代码 + 优化 logResponse

**文件：**
- 修改：`frontend/src/lib/api.ts`

**背景：** `lib/api.ts` 中所有 TS 接口使用 `{id: number; attributes: {...}}` 模式，需要改为 `{id: number; documentId?: string; ...fields}` 扁平结构。媒体字段从 `{data?: {attributes: {url: string}}}` 改为 `{url: string; alternativeText?: string} | null`。文件末尾有 `toV4Item()`/`toV4Value()` 死代码需删除。`logResponse()` 中 `JSON.stringify(data)` 在大响应时开销高，改用 `content-length` header。

**注意：** 此任务修改接口后，所有引用 `.attributes` 的组件会产生 TypeScript 错误，这些错误将在任务 9-12 中逐个修复。本任务只修改 `lib/api.ts` 本身。

- [ ] **步骤 1：修改 `SiteSettings` 接口**

将：

```typescript
export interface SiteSettings {
  id: number;
  attributes: {
    name: string;
    slogan?: string;
    logo?: { data?: { attributes: { url: string } } };
    favicon?: { data?: { attributes: { url: string } } };
    phone?: string;
    email?: string;
    address?: string;
    wechat?: string;
    seo?: Seo;
  };
}
```

改为：

```typescript
export interface SiteSettings {
  id: number;
  documentId?: string;
  name: string;
  slogan?: string;
  logo?: { url: string; alternativeText?: string } | null;
  favicon?: { url: string; alternativeText?: string } | null;
  phone?: string;
  email?: string;
  address?: string;
  wechat?: string;
  seo?: Seo;
}
```

- [ ] **步骤 2：修改 `NavigationItem` 接口**

将：

```typescript
export interface NavigationItem {
  id: number;
  attributes: {
    name: string;
    url: string;
    icon?: string;
    position: number;
    isActive: boolean;
    children?: { data: NavigationItem[] };
  };
}
```

改为：

```typescript
export interface NavigationItem {
  id: number;
  documentId?: string;
  name: string;
  url: string;
  icon?: string;
  position: number;
  isActive: boolean;
  children?: NavigationItem[];
}
```

**说明：** `children` 从 `{data: NavigationItem[]}` 改为直接 `NavigationItem[]`。

- [ ] **步骤 3：修改 `Footer` 接口**

将：

```typescript
export interface Footer {
  id: number;
  attributes: {
    copyright?: string;
    socialLinks?: { data: SocialLink[] };
    quickLinks?: { data: QuickLink[] };
  };
}
```

改为：

```typescript
export interface Footer {
  id: number;
  documentId?: string;
  copyright?: string;
  socialLinks?: SocialLink[];
  quickLinks?: QuickLink[];
}
```

- [ ] **步骤 4：修改 `SocialLink` 和 `QuickLink` 接口**

将：

```typescript
export interface SocialLink {
  id: number;
  attributes: {
    platform: string;
    url: string;
    icon?: string;
  };
}

export interface QuickLink {
  id: number;
  attributes: {
    name: string;
    url: string;
  };
}
```

改为：

```typescript
export interface SocialLink {
  id: number;
  documentId?: string;
  platform: string;
  url: string;
  icon?: string;
}

export interface QuickLink {
  id: number;
  documentId?: string;
  name: string;
  url: string;
}
```

- [ ] **步骤 5：修改 `Page` 接口**

将：

```typescript
export interface Page {
  id: number;
  attributes: {
    title: string;
    slug: string;
    isHomepage: boolean;
    sections: Section[];
    seo?: Seo;
  };
}
```

改为：

```typescript
export interface Page {
  id: number;
  documentId?: string;
  title: string;
  slug: string;
  isHomepage: boolean;
  sections: Section[];
  seo?: Seo;
}
```

- [ ] **步骤 6：修改 `Seo` 接口**

将：

```typescript
export interface Seo {
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: { data?: { attributes: { url: string } } };
  ogType?: string;
}
```

改为：

```typescript
export interface Seo {
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: { url: string; alternativeText?: string } | null;
  ogType?: string;
}
```

- [ ] **步骤 7：修改 `Product` 接口**

将：

```typescript
export interface Product {
  id: number;
  attributes: {
    name: string;
    slug: string;
    description?: string;
    shortDescription?: string;
    price?: number;
    originalPrice?: number;
    image?: { data?: { attributes: { url: string } } };
    images?: { data: { attributes: { url: string } }[] };
    isFeatured?: boolean;
    isNew?: boolean;
    categories?: { data: ProductCategory[] };
    specs?: { data: ProductSpec[] };
    specValues?: Record<string, string>;
    teachingMethod?: string;
    objectives?: CourseObjective[];
    outline?: CourseModule[];
    testimonials?: CourseTestimonial[];
    seo?: Seo;
    createdAt?: string;
    updatedAt?: string;
  };
}
```

改为：

```typescript
export interface Product {
  id: number;
  documentId?: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  price?: number;
  originalPrice?: number;
  image?: { url: string; alternativeText?: string } | null;
  images?: { url: string; alternativeText?: string }[];
  thumbnail?: { url: string; alternativeText?: string } | null;
  isFeatured?: boolean;
  isNew?: boolean;
  categories?: ProductCategory[];
  specs?: ProductSpec[];
  specValues?: Record<string, string>;
  teachingMethod?: string;
  objectives?: CourseObjective[];
  outline?: CourseModule[];
  testimonials?: CourseTestimonial[];
  seo?: Seo;
  createdAt?: string;
  updatedAt?: string;
}
```

**说明：** 新增 `thumbnail` 字段（`featured`/`withCategory` 端点返回），`categories`/`specs`/`images` 都从 `{data: [...]}` 改为直接数组。

- [ ] **步骤 8：修改 `ProductCategory` 接口**

将：

```typescript
export interface ProductCategory {
  id: number;
  attributes: {
    name: string;
    slug: string;
    description?: string;
    parent?: { data?: ProductCategory };
    children?: { data: ProductCategory[] };
  };
}
```

改为：

```typescript
export interface ProductCategory {
  id: number;
  documentId?: string;
  name: string;
  slug: string;
  description?: string;
  parent?: ProductCategory | null;
  children?: ProductCategory[];
}
```

- [ ] **步骤 9：修改 `ProductSpec` 接口**

将：

```typescript
export interface ProductSpec {
  id: number;
  attributes: {
    name: string;
    value: string;
    unit?: string;
  };
}
```

改为：

```typescript
export interface ProductSpec {
  id: number;
  documentId?: string;
  name: string;
  value: string;
  unit?: string;
}
```

- [ ] **步骤 10：修改 `FaqItem` 接口**

将：

```typescript
export interface FaqItem {
  id: number;
  attributes: {
    question: string;
    answer: string;
    category?: string;
    isActive?: boolean;
    helpfulCount?: number;
    notHelpfulCount?: number;
  };
}
```

改为：

```typescript
export interface FaqItem {
  id: number;
  documentId?: string;
  question: string;
  answer: string;
  category?: string;
  isActive?: boolean;
  helpfulCount?: number;
  notHelpfulCount?: number;
}
```

- [ ] **步骤 11：修改 `NewsArticle` 接口**

将：

```typescript
export interface NewsArticle {
  id: number;
  documentId?: string;
  attributes: {
    title: string;
    slug: string;
    excerpt?: string;
    content?: string;
    coverImage?: { data?: { attributes: { url: string } } };
    category?: 'company_news' | 'industry_news' | 'event_notice';
    isFeatured?: boolean;
    publishedAt?: string;
    viewCount?: number;
  };
}
```

改为：

```typescript
export interface NewsArticle {
  id: number;
  documentId?: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  coverImage?: { url: string; alternativeText?: string } | null;
  category?: 'company_news' | 'industry_news' | 'event_notice';
  isFeatured?: boolean;
  publishedAt?: string;
  viewCount?: number;
}
```

- [ ] **步骤 12：修改 `KnowledgeBase` 接口**

将：

```typescript
export interface KnowledgeBase {
  id: number;
  attributes: {
    title: string;
    content: string;
    sourceType?: string;
    status?: string;
    statusMessage?: string;
    createdAt?: string;
  };
}
```

改为：

```typescript
export interface KnowledgeBase {
  id: number;
  documentId?: string;
  title: string;
  content: string;
  sourceType?: string;
  status?: string;
  statusMessage?: string;
  createdAt?: string;
}
```

- [ ] **步骤 13：删除死代码 `toV4Item()` / `toV4Value()`**

搜索并删除文件中 `toV4Item` 和 `toV4Value` 函数定义（约在文件末尾 470-496 行）：

```bash
cd frontend && grep -n 'toV4Item\|toV4Value' src/lib/api.ts
```

删除这两个函数及其全部代码。

- [ ] **步骤 14：优化 `logResponse()` 函数**

将：

```typescript
function logResponse(path: string, status: number, duration: number, data?: any) {
  const dataSize = data ? JSON.stringify(data).length : 0;
  console.log(`${LOG_PREFIX} Response ${path}: status=${status}, duration=${duration}ms, size=${dataSize} bytes`);
}
```

改为：

```typescript
function logResponse(path: string, status: number, duration: number, contentLength?: string | null) {
  const sizeStr = contentLength ? `, size=${contentLength} bytes` : '';
  console.log(`${LOG_PREFIX} Response ${path}: status=${status}, duration=${duration}ms${sizeStr}`);
}
```

并在 `fetchApi()` 中修改调用处，将：

```typescript
const data = await res.json();
logResponse(path, res.status, duration, data);
return data;
```

改为：

```typescript
const data = await res.json();
logResponse(path, res.status, duration, res.headers.get('content-length'));
return data;
```

- [ ] **步骤 15：修复 `lib/api.ts` 内部的 `.attributes` 访问**

搜索 `lib/api.ts` 中所有 `.attributes` 访问：

```bash
cd frontend && grep -n '\.attributes' src/lib/api.ts
```

逐个修改：
- `getSiteSettings()` 中 `item?.attributes?.name` → `item?.name`
- `getHomepage()` 中 `result.data.attributes.title` → `result.data.title`，`result.data.attributes.sections` → `result.data.sections`
- `getPageBySlug()` 中 `result.data.attributes.title` → `result.data.title`
- `getProductBySlug()` 中 `result.data.attributes.name` → `result.data.name`
- `getNewsBySlug()` 中 `result.data.attributes.title` → `result.data.title`

- [ ] **步骤 16：验证 TypeScript 编译（预期会有组件错误）**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -50
```

预期：`lib/api.ts` 本身无错误，但会有大量组件文件错误（`.attributes` 访问不存在）。这些错误将在任务 9-12 中修复。

- [ ] **步骤 17：Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "refactor(frontend): lib/api.ts 接口改为 v5 扁平格式 + 删除 toV4 死代码 + 优化 logResponse"
```

---

## 任务 9：前端 Seo.tsx + Layout/Footer/Homepage 组件 → v5 扁平格式

**文件：**
- 修改：`frontend/src/components/Seo.tsx`
- 修改：`frontend/src/pages/Homepage.tsx`
- 修改：`frontend/src/layout/Layout.tsx`
- 修改：`frontend/src/components/layout/Footer.tsx`（如果存在，否则在 Layout.tsx 中）
- 修改对应测试：`frontend/src/components/__tests__/Seo.test.tsx`、`frontend/src/layout/__tests__/Layout.test.tsx`

- [ ] **步骤 1：修改 `Seo.tsx` 的 ogImage 访问**

将 `frontend/src/components/Seo.tsx` 第 39 行：

```typescript
const ogImage = resolveImageUrl(seo?.ogImage?.data?.attributes?.url) ?? image;
```

改为：

```typescript
const ogImage = resolveImageUrl(seo?.ogImage?.url) ?? image;
```

- [ ] **步骤 2：修改 `Homepage.tsx`**

搜索 `Homepage.tsx` 中所有 `.attributes` 访问：

```bash
cd frontend && grep -n '\.attributes' src/pages/Homepage.tsx
```

逐个改为扁平访问，例如：
- `settings.attributes.name` → `settings.name`
- `settings.attributes.logo` → `settings.logo`
- `settings.attributes.seo` → `settings.seo`
- `homepage.attributes.sections` → `homepage.sections`
- `homepage.attributes.seo` → `homepage.seo`

- [ ] **步骤 3：修改 `Layout.tsx`**

搜索 `Layout.tsx` 中所有 `.attributes` 访问：

```bash
cd frontend && grep -n '\.attributes' src/layout/Layout.tsx
```

逐个改为扁平访问，例如：
- `nav.attributes.children` → `nav.children`
- `nav.attributes.name` → `nav.name`
- `nav.attributes.url` → `nav.url`

**注意：** `children` 之前是 `{data: NavigationItem[]}`，现在是 `NavigationItem[]`。如果代码中有 `nav.attributes.children.data`，改为 `nav.children`。如果代码中有 `nav.attributes.children?.data`，改为 `nav.children`。

- [ ] **步骤 4：修改 Footer 组件**

搜索 Footer 组件文件：

```bash
cd frontend && grep -rn '\.attributes' src/layout/ src/components/layout/
```

逐个改为扁平访问，例如：
- `footer.attributes.copyright` → `footer.copyright`
- `footer.attributes.socialLinks` → `footer.socialLinks`（之前是 `.data`，现在直接是数组）
- `footer.attributes.quickLinks` → `footer.quickLinks`
- `link.attributes.platform` → `link.platform`
- `link.attributes.url` → `link.url`
- `link.attributes.name` → `link.name`

- [ ] **步骤 5：更新 Seo 测试 mock**

修改 `frontend/src/components/__tests__/Seo.test.tsx` 中所有 mock 数据，从 v4 格式改为 v5 扁平：

```typescript
// 之前
seo: {
  ogImage: { data: { attributes: { url: '/test-image.jpg' } } }
}

// 之后
seo: {
  ogImage: { url: '/test-image.jpg' }
}
```

- [ ] **步骤 6：更新 Layout 测试 mock**

修改 `frontend/src/layout/__tests__/Layout.test.tsx` 中所有 mock 数据为 v5 扁平格式：

```typescript
// 之前
const mockNav = { id: 1, attributes: { name: '首页', url: '/', children: { data: [...] } } };

// 之后
const mockNav = { id: 1, documentId: 'abc', name: '首页', url: '/', children: [...] };
```

- [ ] **步骤 7：运行测试验证**

```bash
cd frontend && npx vitest run src/components/__tests__/Seo.test.tsx src/layout/__tests__/Layout.test.tsx 2>&1 | tail -30
```

预期：所有测试通过。

- [ ] **步骤 8：Commit**

```bash
git add frontend/src/components/Seo.tsx \
        frontend/src/pages/Homepage.tsx \
        frontend/src/layout/Layout.tsx \
        frontend/src/components/layout/ \
        frontend/src/components/__tests__/Seo.test.tsx \
        frontend/src/layout/__tests__/Layout.test.tsx
git commit -m "refactor(frontend): Seo/Layout/Footer/Homepage 组件适配 v5 扁平格式"
```

---

## 任务 10：前端 PageRenderer + section 组件 → v5 扁平格式

**文件：**
- 修改：`frontend/src/pages/PageRenderer.tsx`
- 修改：`frontend/src/components/sections/*.tsx`（Hero、Features、Advantages、Team、ProductGrid、ProductComparison、Gallery、Testimonials、Faq、ContactForm 等）
- 修改对应测试

- [ ] **步骤 1：修改 `PageRenderer.tsx`**

搜索 `.attributes` 访问：

```bash
cd frontend && grep -n '\.attributes' src/pages/PageRenderer.tsx
```

逐个改：
- `page.attributes.sections` → `page.sections`
- `page.attributes.title` → `page.title`
- `page.attributes.seo` → `page.seo`

- [ ] **步骤 2：修改 section 组件**

搜索所有 section 组件中的 `.attributes` 访问：

```bash
cd frontend && grep -rn '\.attributes' src/components/sections/
```

逐个文件修改。常见模式：
- `product.attributes.name` → `product.name`
- `product.attributes.image?.data?.attributes?.url` → `product.image?.url`
- `product.attributes.images?.data?.[0]?.attributes?.url` → `product.images?.[0]?.url`
- `teacher.attributes.name` → `teacher.name`
- `teacher.attributes.avatar?.data?.attributes?.url` → `teacher.avatar?.url`
- `category.attributes.name` → `category.name`

- [ ] **步骤 3：修改 Faq section 组件**

`frontend/src/components/sections/Faq.tsx` 中：
- `item.attributes.question` → `item.question`
- `item.attributes.answer` → `item.answer`

- [ ] **步骤 4：修改 ProductComparison 组件**

`frontend/src/components/sections/ProductComparison.tsx` 中：
- `product.attributes.specs?.data` → `product.specs`（直接数组）
- `spec.attributes.name` → `spec.name`
- `spec.attributes.value` → `spec.value`

- [ ] **步骤 5：更新对应测试 mock**

修改以下测试文件的 mock 数据为 v5 扁平格式：
- `frontend/src/components/sections/__tests__/Hero.test.tsx`（如果有）
- `frontend/src/components/sections/__tests__/Features.test.tsx`
- `frontend/src/components/sections/__tests__/Advantages.test.tsx`
- `frontend/src/components/sections/__tests__/Team.test.tsx`
- `frontend/src/components/sections/__tests__/ProductGrid.test.tsx`
- `frontend/src/components/sections/__tests__/ContactForm.test.tsx`

- [ ] **步骤 6：运行测试验证**

```bash
cd frontend && npx vitest run src/components/sections/ src/pages/PageRenderer 2>&1 | tail -30
```

预期：所有测试通过。

- [ ] **步骤 7：Commit**

```bash
git add frontend/src/pages/PageRenderer.tsx \
        frontend/src/components/sections/ \
        frontend/src/components/sections/__tests__/
git commit -m "refactor(frontend): PageRenderer + section 组件适配 v5 扁平格式"
```

---

## 任务 11：前端 Course 组件 → v5 扁平格式（移除双格式兼容）

**文件：**
- 修改：`frontend/src/components/course/CourseDetail.tsx`
- 修改：`frontend/src/components/course/CourseHeader.tsx`
- 修改：`frontend/src/components/course/SearchResultsGrid.tsx`
- 修改：`frontend/src/components/course/CategoryFilter.tsx`
- 修改对应测试

**背景：** `SearchResultsGrid` 和 `CategoryFilter` 当前有双格式兼容代码（`product.attributes || product`、`normalizeCategory()`），本任务简化为仅 v5。

- [ ] **步骤 1：修改 `CourseDetail.tsx`**

搜索 `.attributes` 访问：

```bash
cd frontend && grep -n '\.attributes' src/components/course/CourseDetail.tsx
```

逐个改为扁平访问。常见模式：
- `product.attributes.name` → `product.name`
- `product.attributes.slug` → `product.slug`
- `product.attributes.description` → `product.description`
- `product.attributes.objectives` → `product.objectives`
- `product.attributes.outline` → `product.outline`
- `product.attributes.testimonials` → `product.testimonials`
- `product.attributes.seo` → `product.seo`
- `product.attributes.image?.data?.attributes?.url` → `product.image?.url`

- [ ] **步骤 2：修改 `CourseHeader.tsx`**

同样搜索并修改所有 `.attributes` 访问为扁平访问。

- [ ] **步骤 3：简化 `SearchResultsGrid.tsx` 移除双格式兼容**

搜索 `product.attributes || product` 模式：

```bash
cd frontend && grep -n 'attributes ||' src/components/course/SearchResultsGrid.tsx
```

将所有 `const p = product.attributes || product;` 改为直接使用 `product`，并将后续 `p.xxx` 改为 `product.xxx`。

- [ ] **步骤 4：简化 `CategoryFilter.tsx` 移除 `normalizeCategory`**

将 `frontend/src/components/course/CategoryFilter.tsx` 中：

```typescript
interface CategoryFilterProps {
  categories: { id: number; attributes?: { slug: string; name: string }; slug?: string; name?: string }[];
  selected: string | null;
  onChange: (slug: string | null) => void;
}

function normalizeCategory(cat: CategoryFilterProps['categories'][number]) {
  if (cat.attributes) {
    return { id: cat.id, slug: cat.attributes.slug, name: cat.attributes.name };
  }
  return { id: cat.id, slug: cat.slug!, name: cat.name! };
}
```

简化为：

```typescript
interface CategoryFilterProps {
  categories: { id: number; slug: string; name: string }[];
  selected: string | null;
  onChange: (slug: string | null) => void;
}
```

并删除 `normalizeCategory` 函数，组件内直接使用 `cat.slug` / `cat.name`。

- [ ] **步骤 5：更新 Course 测试 mock**

修改以下测试文件的 mock 数据为 v5 扁平格式：
- `frontend/src/components/course/__tests__/CourseDetail.test.tsx`
- `frontend/src/components/course/__tests__/CourseHeader.test.tsx`
- `frontend/src/components/course/__tests__/SearchResultsGrid.test.tsx`
- `frontend/src/components/course/__tests__/CategoryFilter.test.tsx`
- `frontend/src/components/course/__tests__/CourseSearchPanel.test.tsx`
- `frontend/src/pages/__tests__/CoursesPage.test.tsx`

- [ ] **步骤 6：运行测试验证**

```bash
cd frontend && npx vitest run src/components/course/ src/pages/__tests__/CoursesPage.test.tsx 2>&1 | tail -30
```

预期：所有测试通过。

- [ ] **步骤 7：Commit**

```bash
git add frontend/src/components/course/ \
        frontend/src/pages/__tests__/CoursesPage.test.tsx
git commit -m "refactor(frontend): Course 组件适配 v5 扁平格式，移除双格式兼容代码"
```

---

## 任务 12：前端 News + Campus + Teacher 组件 → v5 扁平格式

**文件：**
- 修改：`frontend/src/components/news/NewsCard.tsx`
- 修改：`frontend/src/pages/NewsDetailPage.tsx`、`frontend/src/pages/NewsListPage.tsx`
- 修改：`frontend/src/components/campus/*.tsx`（6 个组件）
- 修改：`frontend/src/components/team/*.tsx`（TeacherCard、TeacherDetail、TeamPage、TeamGrid 等）
- 修改对应测试

- [ ] **步骤 1：修改 News 组件**

搜索 News 相关文件中的 `.attributes` 访问：

```bash
cd frontend && grep -rn '\.attributes' src/components/news/ src/pages/NewsDetailPage.tsx src/pages/NewsListPage.tsx
```

逐个改为扁平访问：
- `article.attributes.title` → `article.title`
- `article.attributes.coverImage?.data?.attributes?.url` → `article.coverImage?.url`
- `article.attributes.category` → `article.category`
- `article.attributes.excerpt` → `article.excerpt`
- `article.attributes.content` → `article.content`
- `article.attributes.publishedAt` → `article.publishedAt`

- [ ] **步骤 2：修改 Campus 组件（6 个）**

搜索 Campus 相关文件：

```bash
cd frontend && grep -rn '\.attributes' src/components/campus/
```

逐个改为扁平访问：
- `campus.attributes.name` → `campus.name`
- `campus.attributes.address` → `campus.address`
- `campus.attributes.coverImage?.data?.attributes?.url` → `campus.coverImage?.url`
- `campus.attributes.gallery?.data` → `campus.gallery`（直接数组）
- `campus.attributes.teachers?.data` → `campus.teachers`（直接数组）
- `teacher.attributes.name` → `teacher.name`
- `teacher.attributes.avatar?.data?.attributes?.url` → `teacher.avatar?.url`

- [ ] **步骤 3：修改 Teacher 组件**

搜索 Teacher 相关文件：

```bash
cd frontend && grep -rn '\.attributes' src/components/team/
```

逐个改为扁平访问：
- `teacher.attributes.name` → `teacher.name`
- `teacher.attributes.title` → `teacher.title`
- `teacher.attributes.avatar?.data?.attributes?.url` → `teacher.avatar?.url`
- `teacher.attributes.campus?.data?.attributes?.name` → `teacher.campus?.name`
- `teacher.attributes.subject` → `teacher.subject`

- [ ] **步骤 4：更新测试 mock**

修改以下测试文件的 mock 数据为 v5 扁平格式：
- `frontend/src/components/news/__tests__/NewsCard.test.tsx`
- `frontend/src/pages/__tests__/NewsDetailPage.test.tsx`
- `frontend/src/pages/__tests__/NewsListPage.test.tsx`
- `frontend/src/components/campus/__tests__/*.test.tsx`（7 个文件）
- `frontend/src/components/team/__tests__/*.test.tsx`（6 个文件）

- [ ] **步骤 5：运行测试验证**

```bash
cd frontend && npx vitest run src/components/news/ src/components/campus/ src/components/team/ src/pages/__tests__/NewsDetailPage.test.tsx src/pages/__tests__/NewsListPage.test.tsx 2>&1 | tail -30
```

预期：所有测试通过。

- [ ] **步骤 6：Commit**

```bash
git add frontend/src/components/news/ \
        frontend/src/components/campus/ \
        frontend/src/components/team/ \
        frontend/src/pages/NewsDetailPage.tsx \
        frontend/src/pages/NewsListPage.tsx \
        frontend/src/pages/__tests__/NewsDetailPage.test.tsx \
        frontend/src/pages/__tests__/NewsListPage.test.tsx
git commit -m "refactor(frontend): News/Campus/Teacher 组件适配 v5 扁平格式"
```

---

## 任务 13：前端 FaqPage + 剩余页面组件 → v5 扁平格式 + 全量 TypeScript 检查

**文件：**
- 修改：`frontend/src/pages/FaqPage.tsx`
- 修改：任何仍有 `.attributes` 访问的剩余文件
- 修改：`frontend/src/pages/__tests__/FaqPage.test.tsx`

- [ ] **步骤 1：修改 `FaqPage.tsx`**

搜索 `.attributes` 访问：

```bash
cd frontend && grep -n '\.attributes' src/pages/FaqPage.tsx
```

逐个改为扁平访问：
- `item.attributes.question` → `item.question`
- `item.attributes.answer` → `item.answer`
- `item.attributes.category` → `item.category`

- [ ] **步骤 2：全局搜索剩余 `.attributes` 访问**

```bash
cd frontend && grep -rn '\.attributes' src/ --include='*.tsx' --include='*.ts' | grep -v '__tests__' | grep -v 'node_modules'
```

预期：无输出，或仅有 `lib/api.ts` 之外不应有的遗漏。逐个修复。

- [ ] **步骤 3：全局搜索剩余 `.data?.attributes` 或 `.data.attributes` 访问**

```bash
cd frontend && grep -rn '\.data.*attributes' src/ --include='*.tsx' --include='*.ts' | grep -v '__tests__' | grep -v 'node_modules'
```

预期：无输出。逐个修复。

- [ ] **步骤 4：更新 FaqPage 测试**

修改 `frontend/src/pages/__tests__/FaqPage.test.tsx` 中 mock 数据为 v5 扁平格式。

- [ ] **步骤 5：运行全量 TypeScript 检查**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

预期：无错误。

- [ ] **步骤 6：运行全量测试**

```bash
cd frontend && npx vitest run 2>&1 | tail -30
```

预期：所有测试通过（343+ 测试，部分测试的 mock 数据已在前面的任务中更新）。

- [ ] **步骤 7：Commit**

```bash
git add frontend/src/pages/FaqPage.tsx \
        frontend/src/pages/__tests__/FaqPage.test.tsx
# 加上任何其他修改的文件
git commit -m "refactor(frontend): FaqPage 适配 v5 扁平格式，完成全量 TypeScript 检查"
```

---

## 任务 14：前端 useProductSearch 性能修复（AbortController + requestIdRef）

**文件：**
- 修改：`frontend/src/hooks/useProductSearch.ts`
- 修改：`frontend/src/hooks/__tests__/useProductSearch.test.ts`

**背景：** 当前 `useProductSearch` 使用 `requestingRef` 阻塞策略：如果上一个请求未完成，直接跳过新请求。这导致用户快速输入时，最新查询可能被跳过，UI 显示过时结果。

修复方案：
1. 移除 `requestingRef`
2. 每次请求递增 `requestIdRef.current`，请求完成后检查 ID 是否匹配
3. 使用 `AbortController` 取消进行中的旧请求
4. 组件卸载时 abort 进行中的请求

- [ ] **步骤 1：编写竞态测试**

在 `frontend/src/hooks/__tests__/useProductSearch.test.ts` 中添加测试：

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProductSearch } from '../useProductSearch';
import { searchProducts } from '../../lib/api';

jest.mock('../../lib/api', () => ({
  searchProducts: jest.fn(),
}));

describe('useProductSearch race condition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('快速连续查询时，只应用最新请求的结果', async () => {
    let resolveFirst: (value: any) => void;
    let resolveSecond: (value: any) => void;

    const firstPromise = new Promise((resolve) => { resolveFirst = resolve; });
    const secondPromise = new Promise((resolve) => { resolveSecond = resolve; });

    (searchProducts as jest.Mock)
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(secondPromise);

    const { result } = renderHook(() => useProductSearch());

    act(() => {
      result.current.setQuery('a');
    });

    act(() => {
      result.current.setQuery('ab');
    });

    await waitFor(() => {
      expect(searchProducts).toHaveBeenCalledTimes(2);
    });

    act(() => {
      resolveFirst!({ data: [{ id: 1, name: '旧结果' }], meta: { total: 1, pageCount: 1 } });
    });

    await waitFor(() => {
      expect(result.current.results).toEqual([]);
    });

    act(() => {
      resolveSecond!({ data: [{ id: 2, name: '新结果' }], meta: { total: 1, pageCount: 1 } });
    });

    await waitFor(() => {
      expect(result.current.results).toEqual([{ id: 2, name: '新结果' }]);
    });
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd frontend && npx vitest run src/hooks/__tests__/useProductSearch.test.ts 2>&1 | tail -20
```

预期：新测试失败（旧结果被应用，或请求被跳过）。

- [ ] **步骤 3：重写 `useProductSearch.ts`**

将 `frontend/src/hooks/useProductSearch.ts` 完整替换为：

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { searchProducts } from '../lib/api';
import type { Product } from '../lib/api';

export function useProductSearch(initialLimit = 12) {
  const [query, setQueryState] = useState('');
  const [category, setCategoryState] = useState<string | null>(null);
  const [sort, setSortState] = useState<string | null>(null);
  const [page, setPageState] = useState(1);
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipDebounceRef = useRef(true);
  const limitRef = useRef(initialLimit);
  limitRef.current = initialLimit;

  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const doSearch = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const response = await searchProducts({
        query: query || undefined,
        categorySlugs: category ? [category] : undefined,
        sort: sort ? [sort] : undefined,
        page,
        limit: limitRef.current,
      });

      if (currentRequestId !== requestIdRef.current || controller.signal.aborted) {
        return;
      }

      setResults(response.data);
      setTotal(response.meta.total);
      setPageCount(response.meta.pageCount);
    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }
      if (currentRequestId !== requestIdRef.current) {
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (currentRequestId === requestIdRef.current && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [query, category, sort, page]);

  useEffect(() => {
    const skipDebounce = skipDebounceRef.current;
    skipDebounceRef.current = false;

    if (skipDebounce) {
      void doSearch();
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      void doSearch();
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [doSearch]);

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

  const setQuery = useCallback((q: string) => {
    setQueryState(q);
  }, []);

  const setCategory = useCallback((c: string | null) => {
    skipDebounceRef.current = true;
    setCategoryState(c);
    setPageState(1);
  }, []);

  const setSort = useCallback((s: string | null) => {
    skipDebounceRef.current = true;
    setSortState(s);
    setPageState(1);
  }, []);

  const setPage = useCallback((p: number) => {
    skipDebounceRef.current = true;
    setPageState(p);
  }, []);

  const reset = useCallback(() => {
    skipDebounceRef.current = true;
    setQueryState('');
    setCategoryState(null);
    setSortState(null);
    setPageState(1);
  }, []);

  return {
    query,
    category,
    sort,
    page,
    results,
    loading,
    error,
    total,
    pageCount,
    setQuery,
    setCategory,
    setSort,
    setPage,
    reset,
  };
}
```

- [ ] **步骤 4：更新已有测试 mock 数据**

检查 `useProductSearch.test.ts` 中已有的测试，确保 mock 数据使用 v5 扁平格式（`{id, name, slug, ...}` 而非 `{id, attributes: {name, slug, ...}}`）。

- [ ] **步骤 5：运行测试验证通过**

```bash
cd frontend && npx vitest run src/hooks/__tests__/useProductSearch.test.ts 2>&1 | tail -20
```

预期：所有测试通过，包括新竞态测试。

- [ ] **步骤 6：Commit**

```bash
git add frontend/src/hooks/useProductSearch.ts \
        frontend/src/hooks/__tests__/useProductSearch.test.ts
git commit -m "fix(frontend): useProductSearch 竞态修复——AbortController + requestIdRef 替换 requestingRef 阻塞"
```

---

## 任务 15：全量回归 + 浏览器验证

**文件：** 无修改，仅验证

- [ ] **步骤 1：运行全量前端测试**

```bash
cd frontend && npx vitest run 2>&1 | tail -20
```

预期：所有测试通过（343+ 测试）。

- [ ] **步骤 2：运行 TypeScript 严格检查**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

预期：无错误。

- [ ] **步骤 3：启动前端开发服务器**

```bash
cd frontend && npm run dev
```

- [ ] **步骤 4：浏览器验证首页**

使用 TRAE 内建浏览器（`browser_use` 子代理）：
1. 导航到 `http://localhost:5173/`
2. 截图验证首页正常渲染
3. 检查控制台无错误

- [ ] **步骤 5：浏览器验证课程搜索页**

1. 导航到 `http://localhost:5173/courses`
2. 验证分类筛选正常加载
3. 输入搜索关键词，验证搜索结果正常显示
4. 验证排序和分页功能

- [ ] **步骤 6：浏览器验证课程详情页**

1. 在课程搜索页点击一个课程
2. 验证课程详情页正常渲染（标题、图片、大纲、评价等）
3. 检查 SEO meta 标签（通过 `browser_evaluate` 检查 `document.title` 和 meta description）

- [ ] **步骤 7：浏览器验证新闻列表和详情**

1. 导航到 `http://localhost:5173/news`
2. 验证新闻列表正常渲染
3. 点击一篇新闻，验证详情页正常渲染

- [ ] **步骤 8：浏览器验证校区和教师页**

1. 导航到 `http://localhost:5173/campuses`
2. 验证校区列表正常
3. 导航到 `http://localhost:5173/teachers`
4. 验证教师列表正常

- [ ] **步骤 9：浏览器验证 FAQ 页**

1. 导航到 `http://localhost:5173/faq`
2. 验证 FAQ 列表正常渲染

- [ ] **步骤 10：浏览器控制台错误检查**

在上述所有页面检查浏览器控制台，确认无 API 格式相关错误（如 `Cannot read properties of undefined (reading 'xxx')`）。

- [ ] **步骤 11：更新项目 memory**

更新 `/home/tishensnoopy/.trae-cn/memory/projects/-home-tishensnoopy-project-superpowers-zh/project_memory.md`：
- 在 "Lessons Learned" 中记录 v4/v5 格式统一完成
- 更新测试统计数（如果有变化）
- 记录 useProductSearch 竞态修复方案

- [ ] **步骤 12：最终 Commit**

```bash
git add -A
git commit -m "test: 阶段 1 技术债修复全量回归通过——v5 扁平格式统一 + 竞态修复 + 性能优化"
```

---

## 自检

### 1. 规格覆盖度

对照 `docs/superpowers/specs/2026-07-12-nextjs-migration-design.md` 的 §3 阶段 1 章节：

| 规格需求 | 对应任务 |
|----------|----------|
| §3.1 campus.ts 移除 transformCampus/wrapMedia | 任务 6 |
| §3.1 teacher.ts 移除 transformTeacher/wrapMedia | 任务 5 |
| §3.1 news-article.ts 移除 transformArticle/wrapMedia | 任务 4 |
| §3.1 product.ts 移除 wrapMedia | 任务 7 |
| §3.1 page.ts 移除手动包装 | 任务 1 |
| §3.1 faq-item.ts 移除 wrapItem | 任务 2 |
| §3.1 navigation.ts 移除手动包装 | 任务 3 |
| §3.1 site-settings.ts 移除手动包装 | 任务 3 |
| §3.1 footer.ts 移除手动包装 | 任务 3 |
| §3.2 lib/api.ts 接口扁平化 | 任务 8 |
| §3.2 Seo.tsx ogImage 扁平访问 | 任务 9 |
| §3.2 PageRenderer 扁平访问 | 任务 10 |
| §3.2 CourseDetail/CourseHeader 扁平访问 | 任务 11 |
| §3.2 NewsDetailPage 扁平访问 | 任务 12 |
| §3.2 Campus/Teacher 组件扁平访问 | 任务 12 |
| §3.2 FaqPage 扁平访问 | 任务 13 |
| §3.2 Layout/Footer/Homepage 扁平访问 | 任务 9 |
| §3.2 CourseSearchPanel/SearchResultsGrid 移除双格式 | 任务 11 |
| §3.2 CategoryFilter 移除 normalizeCategory | 任务 11 |
| §3.2 删除 toV4Item/toV4Value 死代码 | 任务 8 |
| §3.2 测试 mock 数据改为 v5 扁平 | 任务 9-13 各自覆盖 |
| §3.3 useProductSearch 竞态修复 | 任务 14 |
| §3.3 DB 回退移除 description $containsi | 任务 7 |
| §3.3 DB 回退移除未用 thumbnail populate | 任务 7 |
| §3.3 logResponse 优化 | 任务 8 |

**遗漏：** 无。

### 2. 占位符扫描

- 搜索 "TODO"、"待定"、"后续实现" → 无
- 搜索 "类似任务 N" → 无
- 所有代码步骤都有完整代码块

### 3. 类型一致性

- `Product` 接口在任务 8 中定义为 `{id, documentId?, name, slug, ..., thumbnail?: {url, alternativeText?} | null, ...}`
- 任务 11 中 `SearchResultsGrid` 直接使用 `product.name`、`product.thumbnail?.url` —— 一致
- 任务 14 中 `useProductSearch` 的 `results: Product[]` —— 与任务 8 的 `Product` 定义一致
- `Seo.ogImage` 在任务 8 中定义为 `{url: string; alternativeText?: string} | null`
- 任务 9 中 `Seo.tsx` 访问 `seo?.ogImage?.url` —— 一致
- `NavigationItem.children` 在任务 8 中定义为 `NavigationItem[]`
- 任务 9 中 `Layout.tsx` 直接使用 `nav.children` —— 一致
