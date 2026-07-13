# Next.js 迁移阶段 3：内容迁移与数据对接设计

## 1. 背景与目标

阶段 2（骨架搭建）已完成，创建了所有页面路由、组件、SEO 基础设施和错误处理。但存在以下问题：

- **路由不一致**：导航链接 `/contact` 无对应页面、`/team` vs `/teachers` 不一致、`/nonexistent` 返回 200 而非 404
- **技术债**：Seo.tsx/CourseDetail.tsx 残留、Sentry 事件重复捕获、4xx 噪音未过滤、CourseSearchPanel act 警告、llms.txt SWR 值缺失
- **测试缺失**：Vite 有 43 个测试文件，Next.js 仅 35 个；缺失 8 个页面级测试 + Seo 组件测试
- **性能问题**：First Load JS 209KB（超标 130KB 目标），主要是 Sentry 客户端代码
- **样式/交互未验证**：未逐页对比 Vite 和 Next.js 的渲染效果

**阶段 3 目标**：全面收尾，确保 Next.js 项目在功能、测试、性能、用户体验上完全对齐 Vite 项目，为阶段 4（切换部署）做好准备。

## 2. 关键决策

### 2.1 测试策略：Playwright E2E

Next.js App Router 的页面是 Server Component，传统 vitest 组件测试无法直接测试页面渲染。决策：引入 Playwright 做端到端测试，覆盖：
- 页面渲染（SSR/ISR/CSR）
- 导航流程
- 搜索功能（MeiliSearch）
- 表单提交（预约流程）
- 错误页面（404/500）

保留现有 vitest 组件级测试（262 个），Playwright 作为补充层。

### 2.2 性能优化：Sentry 动态加载

Sentry 的 `replayIntegration` 引入约 50-70KB 客户端代码。决策：将 replay 集成改为懒加载——仅在发生错误后动态加载 replay SDK。保留 `browserTracingIntegration` 但降低开发环境采样率。

预期效果：First Load JS 从 209KB 降至约 140-150KB。

### 2.3 任务分解：按功能模块分拆

4 层结构，每层有明确的完成标准和可验证的产出。

## 3. 任务分解

### 第一层：基础设施修复（3 个任务）

#### 任务 1：路由一致性修复

**问题清单：**
1. `/contact` — 导航和 CTA 按钮链接到 `/contact`，但无对应页面路由。原 Vite 项目通过 `/:slug` 匹配 Strapi 中 slug 为 "contact" 的页面。
2. `/team` vs `/teachers` — 原导航配置可能使用 `/team`，Next.js 项目路由为 `/teachers`。
3. `/nonexistent` 返回 200 — `app/[slug]/page.tsx` 的 `getPageBySlug` 失败时未正确触发 `notFound()`，或 Strapi 返回了空数据而非 404。

**修复方案：**
- 检查 Strapi 中是否有 slug 为 "contact" 的页面；如果有，确认 `app/[slug]/page.tsx` 能正确渲染；如果没有，创建独立的 `app/contact/page.tsx`（包含 ContactForm section）
- 在 Navigation.tsx 中添加路由重定向配置：`/team` → `/teachers`（通过 `next.config.ts` 的 `redirects()` 或 `app/team/page.tsx` 的 redirect）
- 修复 `app/[slug]/page.tsx` 的 404 行为：确保 `getPageBySlug` 返回空数据时调用 `notFound()`

#### 任务 2：阶段 2 遗留技术债清理

**清理清单：**
1. **Seo.tsx 保留** — CourseSearchPanel.tsx（CSR 页面 courses/page.tsx 的子组件）仍需要 Seo.tsx 渲染 meta 标签。CSR 页面无法使用 generateMetadata，Seo.tsx 是唯一方案。保留 Seo.tsx 不做改动
2. **CourseDetail.tsx 移除** — 任务 8 已用 `app/courses/[slug]/page.tsx`（Server Component + generateMetadata）替代。确认 app/courses/[slug]/page.tsx 不引用 CourseDetail.tsx 后，删除组件文件和测试文件 `CourseDetail.test.tsx`
3. **Sentry 事件重复** — `lib/api.ts` 的 `fetchApi` 捕获 HTTP 错误后，错误冒泡到 `error.tsx` 又被捕获一次。在 `error.tsx` 的 `useEffect` 中添加判断：`if (error.message.includes('API request failed')) return;` 跳过已被 `fetchApi` 捕获的 API 错误
4. **4xx 噪音过滤** — `lib/api.ts` 的 `if (!res.ok)` 块改为：5xx 发送 Sentry，4xx 仅记录日志不发送 Sentry（4xx 是业务错误如 404 页面不存在、422 校验失败，不是 bug）
5. **CourseSearchPanel act 警告** — 使用 `vi.useFakeTimers()` 控制 debounce 的 setTimeout，消除 act 警告
6. **llms.txt SWR 值** — `stale-while-revalidate` 补充 `=86400`
7. **`app/[slug]` generateStaticParams 重复路径** — 在 `generateStaticParams` 中过滤掉与静态路由冲突的 slug（如 refund-policy、privacy-policy、user-agreement）
8. **/nonexistent 404 状态码** — 调查 `app/[slug]/page.tsx` 调用 `notFound()` 后仍返回 200 的原因。可能是 `next start` 与 `output: standalone` 不兼容导致。改用 `node .next/standalone/server.js` 验证

#### 任务 3：Sentry 劢态加载优化

**优化方案：**
1. `sentry.client.config.ts` 移除 `Sentry.replayIntegration` 的静态导入，改用 Sentry v8 的 `lazyLoadIntegration` API：`Sentry.lazyLoadIntegration('replayIntegration').then(integration => Sentry.addIntegration(integration))`
2. 保留 `browserTracingIntegration`（体积较小，约 10KB）
3. 开发环境 `tracesSampleRate` 从 1.0 降至 0.5，生产环境保持 0.1
4. 验证 First Load JS 降至 150KB 以下
5. 验证错误发生时 replay SDK 能正确动态加载并开始录制

### 第二层：Playwright E2E 测试基础设施（2 个任务）

#### 任务 4：Playwright 配置与测试环境

**搭建内容：**
1. 安装 `@playwright/test` 依赖
2. 创建 `playwright.config.ts` — 配置 baseURL、webServer（自动启动 `npm run start`）、浏览器（Chromium only）、测试目录 `e2e/`
3. 创建 `e2e/fixtures.ts` — 自定义 fixture（如 `expectNoConsoleErrors`）
4. 在 `package.json` 中添加 `test:e2e` 脚本
5. 创建测试环境配置 — 确保 Strapi 后端在测试期间可用

**验收标准：**
- `npm run test:e2e` 能启动并运行一个示例测试
- 测试报告生成在 `e2e-report/` 目录

#### 任务 5：关键路径烟雾测试

**测试用例：**
1. 首页加载 — 访问 `/`，验证标题、导航、Hero section、Footer 渲染
2. 导航流程 — 点击导航链接，验证页面切换
3. 课程搜索 — 访问 `/courses`，输入搜索词，验证结果更新
4. 课程详情 — 点击课程卡片，验证详情页加载
5. 预约流程 — 填写 ContactForm，提交，验证跳转到成功页
6. 404 页面 — 访问不存在的路径，验证 404 页面显示

### 第三层：逐页 E2E 测试 + 样式对齐（4 个任务）

#### 任务 6：首页 + 合规页 E2E + 样式对齐

**范围：** `/`、`/refund-policy`、`/privacy-policy`、`/user-agreement`

**E2E 测试：**
- 首页所有 section 渲染验证（Hero、Advantages、Features、ProductGrid、Testimonials、FAQ、Gallery、ContactForm、ProductComparison、FloatingButton）
- 合规页面 RichText 内容渲染验证
- 页面 meta 标签验证（title、description、og:*）
- JSON-LD 结构化数据验证

**样式对齐：**
- 对比 Vite 和 Next.js 的首页截图
- 修复 Tailwind class 差异、字体渲染差异、图片尺寸差异

#### 任务 7：课程搜索 + 详情 E2E + 样式对齐

**范围：** `/courses`、`/courses/[slug]`

**E2E 测试：**
- 搜索功能：输入关键词、筛选分类、排序、分页
- 竞态修复验证：快速连续输入，验证最终结果匹配最后一次查询
- 课程详情：课程标题、描述、学习目标、课程大纲、家长评价、CTA 按钮
- 课程详情 meta 标签 + JSON-LD（Course 类型）

**样式对齐：**
- 搜索结果网格布局
- 筛选器/排序控件样式
- 课程详情页面布局

#### 任务 8：新闻 + 校区 E2E + 样式对齐

**范围：** `/news`、`/news/[slug]`、`/campuses`、`/campuses/[slug]`

**E2E 测试：**
- 新闻列表：分类筛选、分页、卡片渲染
- 新闻详情：标题、内容、封面图、发布日期、浏览量
- 校区列表：卡片渲染、排序
- 校区详情：封面图、相册、地址、电话、营业时间、交通、教师列表
- meta 标签 + JSON-LD

**样式对齐：**
- 新闻卡片样式
- 校区相册（Gallery）布局
- StrapiImage 渲染效果

#### 任务 9：教师 + FAQ + 404 E2E + 样式对齐

**范围：** `/teachers`、`/faq`、404 页面

**E2E 测试：**
- 教师列表：筛选（校区、科目）、教师卡片
- FAQ：分类筛选、搜索、展开/收起、反馈
- 404 页面：访问不存在路径，验证 404 内容和状态码
- meta 标签验证

**样式对齐：**
- 教师卡片样式
- FAQ 手风琴组件样式
- 404 页面样式

### 第四层：收尾验证（2 个任务）

#### 任务 10：数据对接验证

**验证内容：**
1. **ISR 缓存行为** — 访问页面后修改 Strapi 数据，验证 5 分钟后缓存更新
2. **MeiliSearch 搜索** — 验证搜索结果与 Strapi 数据一致
3. **Strapi API 数据流** — 验证所有 API 调用返回正确的 v5 扁平格式数据
4. **SEO 基础设施** — 验证 sitemap.xml、robots.txt、llms.txt 内容正确
5. **sessionStorage 跨页数据** — 验证 ContactForm → appointment-success 的数据传递

#### 任务 11：全量验证与 Git 标签

**验证清单：**
1. vitest 全量测试通过（262+ 测试）
2. Playwright E2E 测试全部通过
3. TypeScript 类型检查通过
4. 生产构建成功（First Load JS < 150KB）
5. 所有页面浏览器验证通过
6. 更新项目 memory
7. 打 Git 标签 `nextjs-content-complete`

## 4. 技术约束

- **零新依赖原则**：除 `@playwright/test`（测试依赖）外不引入新的运行时依赖
- **Strapi v5 扁平格式**：所有数据流必须使用 v5 扁平格式，不回退到 v4 嵌套格式
- **Server/Client 边界**：保持阶段 2 的边界划分，不随意添加 `'use client'`
- **YAGNI**：不添加规格之外的功能、重构或抽象

## 5. 成功标准

| 指标 | 目标 |
|------|------|
| vitest 测试 | 262+ 全部通过 |
| Playwright E2E | 20+ 测试全部通过 |
| First Load JS | < 150KB（首页） |
| 路由一致性 | 所有导航链接可达，无 404 |
| 样式对齐 | 与 Vite 版本视觉一致 |
| TypeScript | typecheck 通过 |
| 生产构建 | 成功，standalone 输出 |

## 6. 不在范围内

- AI 客服系统（独立子系统）
- 知识库 RAG（独立子系统）
- 双语支持（阶段 5）
- Docker Compose 部署（阶段 4）
- Strapi 后端改动（除非修复 404 行为需要）
