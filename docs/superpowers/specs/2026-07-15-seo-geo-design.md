# 子项目 5B-1：前端 SEO 基础设计

- **项目**：佑森小课堂（Yousen Education）官方网站
- **子项目**：5B-1（前端 SEO 基础）
- **日期**：2026-07-15
- **状态**：已批准（待规格自检 + 用户审查）
- **前置条件**：子项目 5A（i18n）已完成；hreflang 标签、sitemap 双语 URL、llms.txt 双语内容已就位

## 1. 背景与目标

### 1.1 背景

佑森小课堂是武汉地区幼小衔接教育机构，拥有 6 个物理校区。网站已完成中英双语 i18n（子项目 5A），具备基础 SEO 设施（`buildMetadata`、`buildJsonLd`、sitemap、llms.txt、robots.ts），但结构化数据覆盖不全、质量不足：

- 仅 4 个页面有内联 JSON-LD（WebSite、Course、FAQPage、NewsArticle），且字段简陋
- 缺少 Organization、LocalBusiness（6 校区本地 SEO）、BreadcrumbList、Person（教师）schema
- sitemap 缺少 campuses/[slug] 和 teachers/[slug] 动态 URL
- 存在遗留客户端 SEO 组件 `components/Seo.tsx`，与服务端 `buildMetadata` 功能重复

### 1.2 目标

- **本地 SEO 优先**：为 6 个校区注入 LocalBusiness schema，让 Google Maps/本地搜索能索引各校区地址、电话、营业时间
- 扩展结构化数据覆盖：Organization（全站根实体）、LocalBusiness（6 校区）、BreadcrumbList（所有页面）、Person（教师）、增强现有 Course/NewsArticle/WebSite/FAQPage
- 集中 JSON-LD 生成逻辑到 `lib/seo.ts`，替换各页面内联 schema
- 补全 sitemap 动态 URL
- 移除遗留客户端 SEO 组件

### 1.3 非目标（YAGNI）

- 不实现 GEO 优化（llms.txt 内容质量、AI 摘要）—— 属 5B-2 范围
- 不实现 AI 客服向量召回质量优化 —— 属 5B-3 范围
- 不修改 Strapi schema（使用现有字段）
- 不实现 `geo` 坐标（Strapi 无经纬度字段，Map Embed 已满足用户需求）
- 不实现 `aggregateRating`（无评价数据系统）
- 不实现 `Review` schema（testimonials 是课程评价，非第三方评价）
- 不实现 `SearchAction`（网站无全局搜索功能）
- 不实现 `openingHoursSpecification` 复杂时间解析（`businessHours` 是字符串，直接映射到 `openingHours`）
- 不实现 `hasCourseInstance`（Strapi 无课程时间表字段）
- 不实现 `offers` 的复杂价格结构（仅用 `price` + `priceCurrency`）

## 2. 架构设计

### 2.1 JSON-LD 架构方案

**方案 A（已选定）：扩展现有 `lib/seo.ts`**

在 `lib/seo.ts` 中新增 8 个 schema 生成器函数。所有函数返回 `Record<string, unknown>`，由现有 `buildJsonLd()` 统一序列化为 XSS 安全的 JSON 字符串。

理由：
- 遵循现有模式（`buildMetadata`、`buildJsonLd` 已在此文件）
- SEO 与结构化数据是相关关注点，单一文件易于查找
- 300 行规模仍可管理，如未来膨胀再拆分

### 2.2 Schema 生成器函数签名

```typescript
// lib/seo.ts 新增函数

// 1. 全站根实体 — 在 layout.tsx 注入
buildOrganizationSchema(
  settings: SiteSettings,
  socialLinks: SocialLink[],
  locale: Locale
): Record<string, unknown>
// @type: 'EducationalOrganization'
// 字段: name, url, logo, telephone, email, address (PostalAddress), sameAs (从 socialLinks)

// 2. 校区本地实体 — 在 campuses/[slug]/page.tsx 注入
buildLocalBusinessSchema(
  campus: Campus,
  locale: Locale
): Record<string, unknown>
// @type: ['LocalBusiness', 'EducationalOrganization']
// 字段: name, address, telephone, openingHours, url, image

// 3. 面包屑导航 — 所有非首页页面注入
buildBreadcrumbSchema(
  items: { name: string; url: string }[],
  locale: Locale
): Record<string, unknown>
// @type: 'BreadcrumbList'
// 字段: itemListElement: [{ @type: ListItem, position, name, item }]
// 注意: 生成器根据 locale 为每个 item.url 自动加 /en-US 前缀（zh-CN 无前缀）
// 调用方传入的 url 为相对路径（如 '/courses'、'/courses/abc'），不含 locale 前缀

// 4. 增强 Course — 替换现有 courses/[slug] 内联 schema
buildCourseSchema(
  product: Product,
  settings: SiteSettings,
  locale: Locale
): Record<string, unknown>
// @type: 'Course'
// 字段: name, description, provider (@type: EducationalOrganization, name), offers (price, priceCurrency)

// 5. 增强 NewsArticle — 替换现有 news/[slug] 内联 schema
buildNewsArticleSchema(
  news: NewsArticle,
  settings: SiteSettings,
  locale: Locale
): Record<string, unknown>
// @type: 'NewsArticle'
// 字段: headline, datePublished, dateModified, author (Organization), publisher (Organization), image

// 6. 增强 WebSite — 替换现有首页内联 schema
buildWebSiteSchema(
  settings: SiteSettings,
  locale: Locale
): Record<string, unknown>
// @type: 'WebSite'
// 字段: name, url（不包含 potentialAction，因无全局搜索）

// 7. 教师实体 — 在 teachers/[slug]/page.tsx 注入
buildPersonSchema(
  teacher: Teacher,
  locale: Locale
): Record<string, unknown>
// @type: 'Person'
// 字段: name, jobTitle, image, worksFor (@type: EducationalOrganization), knowsAbout

// 8. FAQPage — 从 faq/page.tsx 提取
buildFaqPageSchema(
  faqItems: FaqItem[]
): Record<string, unknown>
// @type: 'FAQPage'
// 字段: mainEntity: [{ @type: Question, name, acceptedAnswer: { @type: Answer, text } }]
```

### 2.3 类型设计

- `Locale` 类型从 `@/lib/api` 导入（`'zh-CN' | 'en-US'`）
- `SiteSettings`、`SocialLink`、`Campus`、`Product`、`NewsArticle`、`Teacher`、`FaqItem` 从 `@/lib/api` 导入
- Schema 生成器函数接收完整数据对象（非 SEO 子对象），避免调用方拆包
- `locale` 参数用于生成 locale 感知的内容（如 `url` 前缀 `/en-US`）

## 3. 页面注入策略

### 3.1 全局 Schema（layout.tsx）

`app/[locale]/layout.tsx` 注入 Organization + WebSite 两个全局 schema：

```tsx
// layout.tsx
const settings = ...; // 已获取
const footer = ...; // 已获取
const websiteSchema = buildWebSiteSchema(settings, locale);
const orgSchema = buildOrganizationSchema(settings, footer?.socialLinks || [], locale);

return (
  <html lang={locale}>
    <body>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: buildJsonLd(websiteSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: buildJsonLd(orgSchema) }} />
      {children}
    </body>
  </html>
);
```

### 3.2 各页面 Schema 注入

| 页面 | 注入的 Schema | 备注 |
|------|--------------|------|
| `app/[locale]/page.tsx`（首页） | 无（WebSite 移到 layout） | 删除现有内联 WebSite schema |
| `app/[locale]/courses/[slug]/page.tsx` | Course + BreadcrumbList | 替换现有内联 Course schema |
| `app/[locale]/news/[slug]/page.tsx` | NewsArticle + BreadcrumbList | 替换现有内联 NewsArticle schema |
| `app/[locale]/campuses/[slug]/page.tsx` | LocalBusiness + BreadcrumbList | 新增 |
| `app/[locale]/teachers/[slug]/page.tsx` | Person + BreadcrumbList | 新增 |
| `app/[locale]/faq/page.tsx` | FAQPage + BreadcrumbList | 提取到生成器，删除内联 |
| 列表页（courses/news/campuses/teachers） | BreadcrumbList | 新增 |
| 静态页（refund-policy/privacy-policy/user-agreement/[slug]） | BreadcrumbList | 新增 |
| 功能页（appointment/contact） | BreadcrumbList | 新增 |

### 3.3 BreadcrumbList 数据来源

面包屑路径由各页面手动构造，传入 `buildBreadcrumbSchema`。调用方传入的 `url` 为相对路径（不含 locale 前缀），生成器根据 `locale` 参数自动为 en-US 添加 `/en-US` 前缀，并为所有 url 拼接 baseUrl：

```typescript
// 示例：课程详情页
const breadcrumbs = [
  { name: locale === 'en-US' ? 'Home' : '首页', url: '/' },
  { name: locale === 'en-US' ? 'Courses' : '课程', url: '/courses' },
  { name: product.name, url: `/courses/${product.slug}` },
];
const breadcrumbSchema = buildBreadcrumbSchema(breadcrumbs, locale);
// 生成器输出（locale='en-US' 时）：
// itemListElement[0].item = 'http://localhost:3000/en-US/'
// itemListElement[1].item = 'http://localhost:3000/en-US/courses'
// itemListElement[2].item = 'http://localhost:3000/en-US/courses/abc'
```

### 3.4 多 Schema 渲染

一个页面可能有多个 schema（如 Course + BreadcrumbList）。渲染多个 `<script type="application/ld+json">` 标签，每个标签一个 schema 对象（不使用 `@graph` 数组，保持简单）。

## 4. Sitemap 补全

### 4.1 新增动态 URL

`app/sitemap.ts` 新增：

```typescript
// campuses/[slug] 动态 URL
const { data: campuses } = await getCampuses().catch(() => ({ data: [] as never[] }));
campuses.forEach((c) => {
  const zhUrl = `${baseUrl}/campuses/${c.slug}`;
  const enUrl = `${baseUrl}/en-US/campuses/${c.slug}`;
  [zhUrl, enUrl].forEach((url) => {
    entries.push({
      url,
      lastModified: new Date(),
      priority: 0.7,
      alternates: { languages: { 'zh-CN': zhUrl, 'en-US': enUrl } },
    });
  });
});

// teachers/[slug] 动态 URL
const { data: teachers } = await getTeachers().catch(() => ({ data: [] as never[] }));
teachers.forEach((t) => {
  const zhUrl = `${baseUrl}/teachers/${t.slug}`;
  const enUrl = `${baseUrl}/en-US/teachers/${t.slug}`;
  [zhUrl, enUrl].forEach((url) => {
    entries.push({
      url,
      lastModified: new Date(),
      priority: 0.6,
      alternates: { languages: { 'zh-CN': zhUrl, 'en-US': enUrl } },
    });
  });
});
```

### 4.2 导入更新

`app/sitemap.ts` 新增导入 `getCampuses` 和 `getTeachers`。

## 5. 遗留清理

### 5.1 删除 `components/Seo.tsx`

完全删除文件。该组件仅在 `CourseSearchPanel.tsx` 使用，用于客户端动态 title/description，对 SEO 无价值（搜索引擎看到服务端 HTML）。

### 5.2 修改 `components/course/CourseSearchPanel.tsx`

- 移除 `import Seo from '@/components/Seo';`（第 8 行）
- 移除 `<Seo title={title} description={description} />`（第 35 行）

## 6. 测试策略

### 6.1 单元测试（vitest）

**`lib/__tests__/seo.test.ts` 扩展：**

为每个 schema 生成器新增测试用例：

| 生成器 | 测试点 |
|--------|--------|
| `buildOrganizationSchema` | @type='EducationalOrganization'；name/url/logo 正确；sameAs 从 socialLinks 提取；空 socialLinks 容错；address 为 PostalAddress 结构 |
| `buildLocalBusinessSchema` | @type=['LocalBusiness','EducationalOrganization']；address/telephone/openingHours 正确；空字段容错 |
| `buildBreadcrumbSchema` | @type='BreadcrumbList'；itemListElement 数量正确；position 从 1 递增；item URL 含 locale 前缀 |
| `buildCourseSchema` | @type='Course'；provider 为 EducationalOrganization；offers 含 price/priceCurrency；price 缺失时无 offers |
| `buildNewsArticleSchema` | @type='NewsArticle'；datePublished/dateModified；author/publisher 为 Organization；image 正确 |
| `buildWebSiteSchema` | @type='WebSite'；name/url 正确；无 potentialAction |
| `buildPersonSchema` | @type='Person'；name/jobTitle/image；worksFor 为 EducationalOrganization；knowsAbout 从 achievements |
| `buildFaqPageSchema` | @type='FAQPage'；mainEntity 为 Question 数组；acceptedAnswer 为 Answer |

**`lib/__tests__/sitemap.test.ts`（新增）：**

- sitemap 包含 campuses/[slug] 动态 URL
- sitemap 包含 teachers/[slug] 动态 URL
- sitemap 条目含 hreflang alternates

### 6.2 E2E 测试（Playwright）

**`e2e/seo.spec.ts`（新增）：**

| 测试 | 验证点 |
|------|--------|
| 首页含 Organization + WebSite schema | `script[type="application/ld+json"]` 数量 >= 2；解析 JSON 验证 @type |
| 课程详情页含 Course + BreadcrumbList schema | 验证 @type 和关键字段 |
| 校区详情页含 LocalBusiness + BreadcrumbList schema | 验证 @type 含 LocalBusiness |
| FAQ 页含 FAQPage schema | 验证 @type='FAQPage' |
| sitemap.xml 含 campuses/teachers URL | XML 解析验证 |

### 6.3 不测试的内容

- 不测试 Google Search Console 的实际索引结果（属运营验证）
- 不测试 schema.org 验证器（信任生成器正确性 + 单元测试）
- 不测试 `buildJsonLd` 的 XSS 防护（已有测试，不重复）

## 7. 实现顺序与依赖

实现阶段将按以下顺序推进（详细任务拆分由 writing-plans 技能生成）：

1. **Schema 生成器函数**：`lib/seo.ts` 新增 8 个函数 + 单元测试
2. **全局 Schema 注入**：`layout.tsx` 注入 Organization + WebSite
3. **页面 Schema 替换/新增**：6 个页面（courses/news/campuses/teachers/faq/首页）
4. **BreadcrumbList 注入**：所有详情页 + 列表页 + 静态页
5. **Sitemap 补全**：新增 campuses/teachers 动态 URL
6. **遗留清理**：删除 `components/Seo.tsx`，修改 `CourseSearchPanel.tsx`
7. **E2E 测试**：`seo.spec.ts`

## 8. 风险与边界

### 8.1 已知风险

| 风险 | 缓解措施 |
|------|----------|
| `SiteSettings.logo` 为 Strapi media 对象，需转为绝对 URL | 使用 `getImageUrl()` 转换 |
| `businessHours` 为字符串，无法结构化为 `openingHoursSpecification` | 直接映射到 `openingHours` 字符串字段 |
| `SocialLink.platform` 可能含非 URL 值（如微信号） | `sameAs` 仅包含以 `http` 开头的 URL，过滤非 URL 值 |
| 多个 `<script type="application/ld+json">` 标签可能影响页面大小 | 每个页面最多 3 个 schema（全局 2 + 页面 1-2），可接受 |
| sitemap 新增 campuses/teachers 调用增加 Strapi 请求 | sitemap 已 ISR 缓存 1 小时，影响可忽略 |

### 8.2 与其他子项目的边界

- **5B-2（GEO 优化）**：本子项目不修改 llms.txt 内容质量、不实现 AI 摘要
- **5B-3（AI 客服向量召回）**：本子项目不涉及后端 RAG
- **5C（微信集成）**：本子项目不涉及微信
- **6A（部署）**：本子项目不修改 docker-compose.yml

## 9. 验收标准

- [ ] `lib/seo.ts` 新增 8 个 schema 生成器函数
- [ ] `app/[locale]/layout.tsx` 注入 Organization + WebSite schema
- [ ] `app/[locale]/courses/[slug]/page.tsx` 注入增强 Course + BreadcrumbList schema
- [ ] `app/[locale]/news/[slug]/page.tsx` 注入增强 NewsArticle + BreadcrumbList schema
- [ ] `app/[locale]/campuses/[slug]/page.tsx` 注入 LocalBusiness + BreadcrumbList schema
- [ ] `app/[locale]/teachers/[slug]/page.tsx` 注入 Person + BreadcrumbList schema
- [ ] `app/[locale]/faq/page.tsx` 使用 `buildFaqPageSchema` 替换内联 schema + 注入 BreadcrumbList
- [ ] 所有非首页页面注入 BreadcrumbList schema（列表页 + 静态页 + 功能页）
- [ ] `app/sitemap.ts` 包含 campuses/[slug] 和 teachers/[slug] 动态 URL
- [ ] `components/Seo.tsx` 已删除
- [ ] `components/course/CourseSearchPanel.tsx` 已移除 `<Seo>` 使用
- [ ] 单元测试全部通过（8 个 schema 生成器 + sitemap）
- [ ] E2E 测试全部通过（5 个 SEO 测试用例）
- [ ] 前端单元测试总数不回退（368+ → 368+ 新增）
