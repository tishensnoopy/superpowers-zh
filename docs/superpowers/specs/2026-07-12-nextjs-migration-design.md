# Next.js 迁移设计规格

> 日期：2026-07-12
> 状态：已批准（方案 A：骨架优先 + 逐页填充）

## 1. 背景与动机

当前前端是 Vite + React 18 SPA，存在以下问题：
- **SEO 不足**：`react-helmet-async` 客户端注入 meta，首屏 HTML 无 SEO 标签，搜索引擎和 AI 引擎无法正确索引
- **无 SSG/SSR**：所有页面客户端渲染，首屏白屏时间长
- **无 hreflang**：无法实现双语 SEO
- **格式不一致**：后端 Strapi v5 但手动伪装 v4 格式，部分端点 v4 包装、部分 v5 扁平——技术债

迁移到 Next.js App Router 的核心目标：ISR 静态生成 + `generateMetadata` 服务端 SEO + 未来 i18n 路由。

## 2. 关键决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 迁移策略 | 先修技术债 → 全量重写 | 从一致的基础开始，避免迁移中处理格式问题 |
| 路由模式 | App Router | `generateMetadata` 对 SEO/hreflang 支持更好 |
| 渲染策略 | ISR 为主 + CSR/SSR 辅助 | 内容更新不频繁但需及时生效 |
| i18n 时间线 | 迁移后再加 | 降低迁移复杂度，先稳定单语 SEO |
| 格式统一 | 后端统一为 v5 扁平 | Strapi v5 原生格式，移除不必要的包装层 |

## 3. 阶段 1：技术债修复

### 3.1 后端统一为 v5 扁平格式

**目标：** 移除所有手动 v4 格式包装，控制器直接返回 Strapi v5 Document Service 原生格式。

**需要修改的控制器（9 个）：**

| 控制器 | 当前 v4 包装函数 | 修改内容 |
|--------|-----------------|----------|
| `campus.ts` | `transformCampus()` + `wrapMedia()` | 移除，`find`/`findOne` 用 `super.find()` 原生返回 |
| `teacher.ts` | `transformTeacher()` + `wrapMedia()` | 同上 |
| `news-article.ts` | `transformArticle()` + `wrapMedia()` | 同上，`findBySlug` 同样移除包装 |
| `product.ts` | `wrapMedia()` in `findBySlug` | 移除 `wrapMedia`，`findBySlug` 返回扁平格式 |
| `page.ts` | 手动 `{id, attributes}` 包装 | `find`/`findOne`/`getHomepage`/`findBySlug` 返回扁平 |
| `faq-item.ts` | `wrapItem()` | 移除，`find`/`findOne`/`search`/`findByCategory` 返回扁平 |
| `navigation.ts` | 手动包装 | `find`/`getNavigationTree` 返回扁平 |
| `site-settings.ts` | 手动包装 | `find` 返回扁平 |
| `footer.ts` | 手动包装 | `find` 返回扁平 |

**自定义端点格式统一：**
- `/products/search` — 已返回扁平格式（`searchProductsViaDb` 的 hits 是扁平的），保持不变
- `/products/featured` — 当前返回 db.query 原始对象（v5 扁平），保持不变
- `/products/compare` — 同上
- `/products/category/:slug` — 同上
- `/product-categories` — 当前 `super.find()` 未包装，保持不变
- `/product-categories/tree` — 已是扁平，保持不变

### 3.2 前端适配 v5 扁平格式

**`lib/api.ts` TS 接口改造：**

所有接口从 `{ id: number; attributes: { ... } }` 改为 `{ id: number; documentId: string; ...fields }` 扁平结构。

媒体字段从 `{ data?: { attributes: { url: string } } }` 改为 `{ url: string; alternativeText?: string } | null`。

**页面组件改造：**

所有 `xxx.attributes.yyy` 访问改为 `xxx.yyy`。涉及文件：
- `PageRenderer.tsx` — `page.attributes.sections` → `page.sections`
- `Seo.tsx` — `seo?.ogImage?.data?.attributes?.url` → `seo?.ogImage?.url`
- `CourseDetailPage.tsx` / `CourseDetail.tsx` — `product.attributes.xxx` → `product.xxx`
- `NewsDetailPage.tsx` — `article.attributes.xxx` → `article.xxx`
- `CampusDetailPage.tsx` / `CampusOverviewPage.tsx` — `campus.attributes.xxx` → `campus.xxx`
- `TeacherSection` 相关 — `teacher.attributes.xxx` → `teacher.xxx`
- `FaqPage.tsx` — `item.attributes.xxx` → `item.xxx`
- `CoursesPage.tsx` / `CourseSearchPanel.tsx` / `SearchResultsGrid.tsx` — 已经兼容双格式，简化为仅 v5
- `Layout.tsx` — `navigation.attributes.children` → `navigation.children`
- `Footer.tsx` — `footer.attributes.xxx` → `footer.xxx`
- `Homepage.tsx` — `settings.attributes.xxx` → `settings.xxx`

**测试改造：**

所有测试文件的 mock 数据从 v4 格式改为 v5 扁平格式。约 30+ 测试文件。

**删除死代码：**

`lib/api.ts` 中的 `toV4Item` / `toV4Value` 函数。

### 3.3 性能修复

**HIGH — `useProductSearch` 竞态修复：**
- 移除 `requestingRef` 阻塞策略
- 改用 `AbortController` + 请求序号（`requestIdRef`）
- 旧请求被 abort 或结果被忽略，确保 UI 状态与最新请求一致
- `skipDebounce` 路径返回 cleanup，组件卸载时 abort 进行中的请求

**MEDIUM — 后端 DB 回退优化：**
- 移除 `description` 字段的 `$containsi` 搜索（长文本 LIKE 开销过高）
- 移除 `populate: ['thumbnail']`（查询了但未使用）

**MEDIUM — 前端日志优化：**
- `logResponse` 的 `JSON.stringify` 改用 `content-length` header 或生产环境跳过

## 4. 阶段 2：Next.js 骨架

### 4.1 项目结构

```
frontend-next/
├── app/
│   ├── layout.tsx              # root layout + global metadata
│   ├── page.tsx                # 首页（ISR）
│   ├── courses/
│   │   ├── page.tsx            # 课程搜索（CSR）
│   │   └── [slug]/
│   │       └── page.tsx        # 课程详情（ISR）
│   ├── news/
│   │   ├── page.tsx            # 新闻列表（ISR）
│   │   └── [slug]/
│   │       └── page.tsx        # 新闻详情（ISR）
│   ├── campuses/
│   │   ├── page.tsx            # 校区列表（ISR）
│   │   └── [slug]/
│   │       └── page.tsx        # 校区详情（ISR）
│   ├── teachers/
│   │   └── page.tsx            # 教师列表（ISR）
│   ├── faq/
│   │   └── page.tsx            # FAQ（ISR）
│   ├── appointment/
│   │   └── page.tsx            # 预约试听（SSR）
│   ├── [slug]/
│   │   └── page.tsx            # 动态页面（ISR，由 Strapi Page 驱动）
│   ├── refund-policy/
│   ├── privacy-policy/
│   ├── user-agreement/
│   └── not-found.tsx           # 404
├── components/
│   ├── sections/               # 12 个 section 组件（从 Vite 移植）
│   ├── course/                 # 课程搜索组件（从 Vite 移植）
│   ├── layout/                 # Navigation, Footer, Layout
│   └── ui/                     # 通用 UI 组件
├── lib/
│   ├── api.ts                  # Strapi API client（v5 扁平格式）
│   └── seo.ts                  # generateMetadata 辅助函数
├── types/
│   └── strapi.ts               # Strapi 内容类型 TS 定义
├── public/
│   └── ...
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

### 4.2 数据获取层

- Server Components 中直接 `fetch` Strapi API
- `generateMetadata` 中获取 SEO 数据
- `generateStaticParams` 用于 SSG 预渲染
- ISR 配置：`export const revalidate = 300`（5 分钟）
- 搜索页保持 CSR（`'use client'` + `useProductSearch` hook）

### 4.3 SEO 实现

- root `layout.tsx` 导出全局 `metadata`（站点标题、描述、OG 默认值）
- 每个页面 `generateMetadata` 函数从 Strapi SEO 组件读取 `metaTitle`/`metaDescription`/`ogImage` 等
- JSON-LD 结构化数据通过 `generateMetadata` 的 `other` 字段注入
- `llms.txt`、`robots.txt`、`sitemap.xml` 通过 Next.js metadata files 实现

## 5. 阶段 3：逐页迁移

按 SEO 优先级顺序：
1. **首页** — `/` (ISR, `getHomepage` + Dynamic Zone sections)
2. **课程搜索** — `/courses` (CSR, `useProductSearch`)
3. **课程详情** — `/courses/[slug]` (ISR, `findBySlug`)
4. **新闻列表** — `/news` (ISR)
5. **新闻详情** — `/news/[slug]` (ISR)
6. **校区列表/详情** — `/campuses`, `/campuses/[slug]` (ISR)
7. **教师列表** — `/teachers` (ISR)
8. **FAQ** — `/faq` (ISR)
9. **合规页** — `/refund-policy` 等 (ISR, Strapi Page + RichText)
10. **预约试听** — `/appointment` (SSR)
11. **404** — `not-found.tsx`

## 6. 阶段 4：切换部署

- Docker Compose 添加 Next.js 服务
- 全量测试通过后切换
- 下线 Vite 服务

## 7. 阶段 5（迁移后）：双语支持

- 激活 Strapi 字段级 localization（所有内容类型的文本字段）
- Next.js App Router i18n 配置（`[locale]` 动态段）
- `generateMetadata` 中 hreflang 标签
- 翻译 API 集成

## 8. 不在本次范围内

- AI 客服系统（独立子系统）
- 知识库 RAG（独立子系统）
- 向量库配置（独立子系统）
- 举报中心（集成到 AI 客服）
