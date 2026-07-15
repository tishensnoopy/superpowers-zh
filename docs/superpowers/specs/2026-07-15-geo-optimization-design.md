# 子项目 5B-2：GEO 优化（llms.txt 增强 + AI 摘要）设计

- **项目**：佑森小课堂（Yousen Education）官方网站
- **子项目**：5B-2（GEO 优化）
- **日期**：2026-07-15
- **状态**：待用户审查
- **前置条件**：子项目 5A（i18n）已完成；子项目 5B-1（SEO 基础）已完成（8 个 JSON-LD 生成器 + sitemap 补全 + 遗留清理）

## 1. 背景与目标

### 1.1 背景

佑森小课堂网站已完成 SEO 基础设施（5B-1）：8 个 JSON-LD schema 生成器、sitemap 双语动态 URL、hreflang 标签。现有 `app/llms.txt/route.ts` 已存在但内容简陋——仅 50 行，只包含链接列表（首页/师资/校区/课程/FAQ/退费政策），缺少课程描述、教师介绍、校区地址等实质内容，无法为 AI 搜索引擎（ChatGPT、Perplexity、Google AI Overviews）提供有效上下文。

GEO（Generative Engine Optimization）要求：

- **llms.txt 内容质量**：从链接列表升级为包含实质摘要的全量内容
- **AI 摘要**：为每个内容实体生成结构化摘要，供 AI 引擎摄取和引用
- **结构化数据增强**：JSON-LD 的 `description` 字段使用更丰富的摘要

### 1.2 目标

- 创建 `lib/geo.ts`，提供 6 个摘要生成器函数 + 1 个组装函数（`buildLlmsTxtContent`），从现有 Strapi 字段模板化提取内容
- 重写 `app/llms.txt/route.ts`，调用摘要生成器输出全量内容（机构简介 + 课程 + 教师 + 校区 + FAQ + 新闻）
- 增强 3 个 JSON-LD schema 生成器的 `description` 字段，复用 `geo.ts` 摘要
- 零 LLM API 调用、零 Strapi schema 修改、零 UI 组件新增

### 1.3 非目标（YAGNI）

- 不调用 LLM API 生成摘要（纯模板提取，零成本、确定性）
- 不新增 Strapi 字段（使用现有字段）
- 不新增可见 UI 组件（摘要仅写入 llms.txt + JSON-LD，用户不可见）
- 不实现 `llms-full.txt` 分层文件（单文件足够）
- 不实现 `speakable` schema（语音搜索优化，暂无需求）
- 不修改后端代码（纯前端实现）
- 不实现 AI 摘要的实时生成/缓存（模板提取无需缓存）
- 不修改 robots.ts（现有配置已足够）

## 2. 架构设计

### 2.1 方案选型

**方案 A（已选定）：独立 `lib/geo.ts` 摘要生成器**

创建 `lib/geo.ts`，为每种内容类型提供 `buildXxxSummary()` 函数。模式与 5B-1 的 `lib/seo.ts` schema 生成器一致——纯函数、接收数据对象 + locale、返回字符串。

理由：
- 摘要逻辑单一来源（DRY），llms.txt 和 JSON-LD 共用
- 独立文件便于单元测试
- 遵循现有 `lib/seo.ts` 模式，开发者心智模型一致
- 关注点分离：`seo.ts` 负责 schema.org 结构化数据，`geo.ts` 负责 AI 摘要内容

### 2.2 文件结构

**新建文件：**
- `frontend-next/lib/geo.ts` — GEO 摘要生成器（~200 行）
- `frontend-next/lib/__tests__/geo.test.ts` — geo.ts 单元测试

**修改文件：**
- `frontend-next/app/llms.txt/route.ts` — 重写：调用 geo.ts 生成全量内容
- `frontend-next/lib/seo.ts` — 增强：3 个 schema 的 description 复用 geo.ts 摘要
- `frontend-next/e2e/seo.spec.ts` — 扩展：llms.txt 内容验证测试

### 2.3 摘要生成器函数签名

```typescript
// lib/geo.ts

import type {
  SiteSettings,
  Product,
  Teacher,
  Campus,
  NewsArticle,
  FaqItem,
  Locale,
} from './api';

/**
 * 构建机构摘要（用于 llms.txt 机构简介分区）
 */
buildOrgSummary(settings: Pick<SiteSettings, 'name' | 'slogan' | 'phone' | 'email' | 'address'>, locale: Locale): string

/**
 * 构建课程摘要（用于 llms.txt 课程分区 + JSON-LD Course.description）
 * 内容: 简述 + 教学目标(前3条) + 教学方式 + 价格
 */
buildCourseSummary(product: Pick<Product, 'name' | 'slug' | 'shortDescription' | 'description' | 'objectives' | 'teachingMethod' | 'price'>, locale: Locale): string

/**
 * 构建教师摘要（用于 llms.txt 教师分区 + JSON-LD Person.description）
 * 内容: 职称 + 教龄 + 学历 + 教学特色 + 成就(前2条)
 */
buildTeacherSummary(teacher: Pick<Teacher, 'name' | 'slug' | 'title' | 'teachingYears' | 'education' | 'teachingFeatures' | 'achievements'>, locale: Locale): string

/**
 * 构建校区摘要（用于 llms.txt 校区分区 + JSON-LD LocalBusiness.description）
 * 内容: 地址 + 电话 + 营业时间 + 交通指引
 */
buildCampusSummary(campus: Pick<Campus, 'name' | 'slug' | 'address' | 'phone' | 'businessHours' | 'transportation'>, locale: Locale): string

/**
 * 构建新闻摘要（用于 llms.txt 新闻分区）
 * 内容: 标题 + 摘要(content 截断到 100 字)
 */
buildNewsSummary(news: Pick<NewsArticle, 'title' | 'slug' | 'excerpt' | 'content' | 'publishedAt'>, locale: Locale): string

/**
 * 构建 FAQ 摘要（用于 llms.txt FAQ 分区）
 * 内容: 前5条 Q&A 格式化
 */
buildFaqSummary(faqItems: FaqItem[]): string

/**
 * 组装完整 llms.txt 内容
 * 调用以上所有生成器，按 llms.txt 标准格式组装
 */
buildLlmsTxtContent(
  settings: Pick<SiteSettings, 'name' | 'slogan' | 'phone' | 'email' | 'address'>,
  products: Product[],
  teachers: Teacher[],
  campuses: Campus[],
  news: NewsArticle[],
  faqItems: FaqItem[],
  locale: Locale
): string
```

### 2.4 数据流

```
Strapi API → lib/api.ts → getProducts/getTeachers/getCampuses/getNews/getFaqItems/getSiteSettings
                                    ↓
                    app/llms.txt/route.ts (GET handler)
                                    ↓
                    lib/geo.ts (buildLlmsTxtContent)
                                    ↓
                    /llms.txt (text/plain, ISR 1h, revalidate=3600)

Strapi API → 各详情页 page.tsx → lib/seo.ts (buildXxxSchema)
                                          ↓
                                   lib/geo.ts (buildXxxSummary) ← 复用
                                          ↓
                                   JSON-LD <script> (description 字段增强)
```

## 3. llms.txt 内容结构

遵循 [llms.txt 标准](https://llmstxt.org/) 格式（H1 标题 + blockquote 摘要 + markdown 分区），增强为全量内容：

```text
# 佑森小课堂 (Yousen Education)

> 专注幼小衔接教育8年，武汉6大校区，提供全日制托班、幼小衔接全能班等课程。
> Focus on preschool-primary transition education for 8 years, 6 campuses in Wuhan.

## 机构简介 / About

[buildOrgSummary 输出]
佑森小课堂，专注幼小衔接教育8年。
电话: 027-12345678
邮箱: info@example.com
地址: 武汉市武昌区

## 课程体系 / Courses

### 拼音班
[buildCourseSummary 输出]
简介: 系统学习汉语拼音...
教学目标: 掌握23个声母 | 认识24个韵母 | 熟练拼读
教学方式: 小班教学
价格: 2800元
- 链接: https://example.com/courses/pinyin

### 数学思维班
[buildCourseSummary 输出]
...

## 师资团队 / Teachers

### 张老师
[buildTeacherSummary 输出]
职称: 高级教师
教龄: 10年
学历: 本科
教学特色: 寓教于乐，注重思维培养
成就: 武汉市优秀青年教师 | 教学论文一等奖
- 链接: https://example.com/teachers/zhang-laoshi

## 校区信息 / Campuses

### 百步亭校区
[buildCampusSummary 输出]
地址: 武汉市江岸区百步亭花园路
电话: 027-82345678
营业时间: 周一至周五 8:00-18:00
交通: 地铁3号线百步亭站
- 链接: https://example.com/campuses/baibuting

## 常见问题 / FAQ

[buildFaqSummary 输出]
Q: 什么是幼小衔接？
A: 幼小衔接是幼儿园到小学的过渡期教育...

Q: 课程如何安排？
A: 每周3次课，每次2小时...

## 新闻动态 / News

[新闻标题列表，前10条]
- [2026-07-10] 佑森小课堂暑期班报名开始: https://example.com/news/summer-enrollment
- [2026-07-05] 武汉市教育局领导视察: https://example.com/news/leadership-visit
```

### 3.1 设计要点

- **单文件双语**：中文为主，英文标签并行（`## 课程体系 / Courses`），与现有 llms.txt 一致
- **llms.txt 标准格式**：H1 标题、`>` blockquote 摘要、`##` 分区、`###` 子项、`-` 链接列表
- **摘要长度控制**：课程 ~150 字、教师 ~80 字、校区 ~100 字、新闻 ~50 字
- **content 截断**：`buildNewsSummary` 中 `content` 截断到 100 字（避免 llms.txt 过大）
- **FAQ 限制**：`buildFaqSummary` 仅包含前 5 条（避免文件膨胀）
- **新闻限制**：新闻分区仅包含前 10 条标题
- **空数据容错**：任一分区数据为空时，跳过该分区（不输出空标题）

### 3.2 locale 处理

- `buildLlmsTxtContent` 接收 `locale` 参数，但 llms.txt 始终输出**双语内容**（中文为主 + 英文标签）
- 各 `buildXxxSummary` 函数的 `locale` 参数用于：
  - 切换字段标签语言（如 zh-CN: "教学目标" / en-US: "Objectives"）
  - 选择对应 locale 的数据（如 `getProducts('en-US')` 返回英文内容）
- llms.txt route handler 同时拉取 zh-CN 数据（主内容），英文标签为静态字符串

## 4. JSON-LD description 增强

3 个现有 schema 生成器的 `description` 字段改用 `geo.ts` 摘要：

| 生成器 | 当前 description | 增强后 | 文件 |
|--------|-----------------|--------|------|
| `buildCourseSchema` | `product.description \|\| product.shortDescription \|\| ''` | `buildCourseSummary(product, locale)` | `lib/seo.ts` |
| `buildPersonSchema` | 无 description 字段 | 新增 `description: buildTeacherSummary(teacher, locale)` | `lib/seo.ts` |
| `buildLocalBusinessSchema` | 无 description 字段 | 新增 `description: buildCampusSummary(campus, locale)` | `lib/seo.ts` |

### 4.1 实现方式

`lib/seo.ts` 新增导入：

```typescript
import { buildCourseSummary, buildTeacherSummary, buildCampusSummary } from './geo';
```

**扩宽 3 个 schema 生成器的 Pick 类型**（以包含摘要函数所需字段）：

```typescript
// buildCourseSchema — 新增 objectives, teachingMethod
export function buildCourseSchema(
  product: Pick<Product, 'name' | 'slug' | 'description' | 'shortDescription' | 'objectives' | 'teachingMethod' | 'price'>,
  ...
)

// buildPersonSchema — 新增 teachingYears, education, teachingFeatures
export function buildPersonSchema(
  teacher: Pick<Teacher, 'name' | 'title' | 'slug' | 'avatar' | 'achievements' | 'teachingYears' | 'education' | 'teachingFeatures'>,
  ...
)

// buildLocalBusinessSchema — 新增 transportation
export function buildLocalBusinessSchema(
  campus: Pick<Campus, 'name' | 'slug' | 'address' | 'phone' | 'businessHours' | 'coverImage' | 'transportation'>,
  ...
)
```

**替换/新增 description 字段：**

在 `buildCourseSchema` 中替换 description：
```typescript
// Before
const description = product.description || product.shortDescription || '';
// After
const description = buildCourseSummary(product, locale);
```

在 `buildPersonSchema` 中新增：
```typescript
schema.description = buildTeacherSummary(teacher, locale);
```

在 `buildLocalBusinessSchema` 中新增：
```typescript
schema.description = buildCampusSummary(campus, locale);
```

**调用方影响**：各详情页 `page.tsx` 传入的是完整 product/teacher/campus 对象（已通过 `populate` 获取关联字段），Pick 类型扩宽不影响调用方。

### 4.2 不增强的生成器

- `buildWebSiteSchema` — 无 description 字段（WebSite schema 不需要）
- `buildOrganizationSchema` — 无 description 字段（Organization schema 不需要）
- `buildBreadcrumbSchema` — 无 description 字段（BreadcrumbList 不需要）
- `buildFaqPageSchema` — 无 description 字段（FAQPage 的 mainEntity 已含完整 Q&A）
- `buildNewsArticleSchema` — 保持 `news.excerpt`（NewsArticle 的 description 应为文章摘要，excerpt 已是最佳来源）

## 5. Strapi 字段映射（已验证）

所有摘要函数使用的字段已在 TypeScript 接口中确认存在：

| 接口 | 字段 | 类型 |
|------|------|------|
| `SiteSettings` | name, slogan, phone, email, address | string (slogan/phone/email/address 可选) |
| `Product` | name, slug, shortDescription, description, objectives, teachingMethod, price | string/snumber/CourseObjective[] |
| `CourseObjective` | title, description | string (description 可选) |
| `Teacher` | name, slug, title, teachingYears, education, teachingFeatures, achievements | string/number/string[] |
| `Campus` | name, slug, address, phone, businessHours, transportation | string (phone/businessHours/transportation 可选) |
| `NewsArticle` | title, slug, excerpt, content, publishedAt | string (excerpt/content/publishedAt 可选) |
| `FaqItem` | question, answer, category | string (category 可选) |

**API 函数**（均接收 `locale` 参数）：
- `getSiteSettings(locale)` / `getProducts(locale)` / `getNews(locale)` / `getFaqItems(locale)` / `getTeachers(locale)` / `getCampuses(locale)`

## 6. llms.txt route handler 重写

### 6.1 当前实现（50 行）

仅获取 settings + products，输出链接列表。

### 6.2 重写后

```typescript
import { getSiteSettings, getProducts, getTeachers, getCampuses, getNews, getFaqItems } from '@/lib/api';
import { buildLlmsTxtContent } from '@/lib/geo';

export const revalidate = 3600;

export async function GET() {
  const [settingsRes, productsRes, teachersRes, campusesRes, newsRes, faqRes] = await Promise.all([
    getSiteSettings().catch(() => ({ data: [] as never[] })),
    getProducts().catch(() => ({ data: [] as never[] })),
    getTeachers().catch(() => ({ data: [] as never[] })),
    getCampuses().catch(() => ({ data: [] as never[] })),
    getNews().catch(() => ({ data: [] as never[] })),
    getFaqItems().catch(() => ({ data: [] as never[] })),
  ]);

  const settings = Array.isArray(settingsRes.data) ? settingsRes.data[0] : settingsRes.data;
  const content = buildLlmsTxtContent(
    settings || { name: '佑森小课堂' },
    productsRes.data,
    teachersRes.data,
    campusesRes.data,
    newsRes.data,
    faqRes.data,
    'zh-CN'
  );

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
```

### 6.3 变更要点

- 新增 `getTeachers` / `getCampuses` / `getNews` / `getFaqItems` 获取
- 调用 `buildLlmsTxtContent` 生成完整内容
- `revalidate = 3600`（1 小时 ISR，不变）
- `Cache-Control` 头不变
- settings 为空时使用 fallback `{ name: '佑森小课堂' }`

## 7. 测试策略

### 7.1 单元测试（`lib/__tests__/geo.test.ts`）

| 函数 | 测试点 |
|------|--------|
| `buildOrgSummary` | 含名称+口号；空字段容错（phone/email/address 缺失时省略）；locale 标签切换 |
| `buildCourseSummary` | 含课程名+简述+目标+教学方式+价格；objectives 为空时省略目标段；price 缺失时省略价格；locale 标签切换 |
| `buildTeacherSummary` | 含姓名+职称+教龄+学历+特色+成就；achievements 为空时容错；teachingYears 缺失时省略教龄；locale 标签切换 |
| `buildCampusSummary` | 含地址+电话+营业时间+交通；transportation 缺失时省略；phone 缺失时省略；locale 标签切换 |
| `buildNewsSummary` | 含标题+摘要；content 截断到 100 字（含省略号）；publishedAt 格式化；excerpt 优先于 content |
| `buildFaqSummary` | Q&A 格式化；超过 5 条时截断；空数组返回空字符串 |
| `buildLlmsTxtContent` | 含所有分区标题；空数据时仅含 H1+blockquote；含课程名称（非仅链接）；含校区地址；locale 参数传递正确 |

### 7.2 E2E 测试（`e2e/seo.spec.ts` 扩展）

新增测试用例：

| 测试 | 验证点 |
|------|--------|
| llms.txt 含课程实质内容 | response text 包含课程名称（非仅链接） |
| llms.txt 含教师信息 | response text 包含教师姓名 |
| llms.txt 含校区地址 | response text 包含校区地址文本 |

### 7.3 不测试的内容

- 不测试 AI 搜索引擎的实际索引结果（属运营验证）
- 不测试 llms.txt 标准合规性验证器（信任格式正确性 + 单元测试）
- 不测试 JSON-LD description 字段的具体内容（信任 geo.ts 单元测试）

## 8. 实现顺序

实现阶段将按以下顺序推进（详细任务拆分由 writing-plans 技能生成）：

1. **`lib/geo.ts` 摘要生成器**：6 个函数 + 单元测试
2. **`lib/seo.ts` JSON-LD 增强**：3 个 schema 的 description 复用 geo.ts
3. **`app/llms.txt/route.ts` 重写**：调用 buildLlmsTxtContent
4. **E2E 测试扩展**：llms.txt 内容验证

## 9. 风险与边界

### 9.1 已知风险

| 风险 | 缓解措施 |
|------|----------|
| llms.txt 内容过大（全量数据） | 摘要长度控制 + FAQ 限 5 条 + 新闻限 10 条 + content 截断 100 字 |
| Strapi API 6 个并发请求增加延迟 | Promise.all 并行获取 + ISR 1 小时缓存 |
| `seo.ts` 导入 `geo.ts` 产生循环依赖 | `geo.ts` 不导入 `seo.ts`，单向依赖，无循环 |
| 摘要内容质量受限于 Strapi 字段丰富度 | 接受现状（模板提取策略的已知限制，YAGNI 不引入 LLM） |
| en-US locale 数据未 seed（5A 已知限制） | llms.txt 使用 zh-CN 数据 + 英文静态标签，en-US 内容缺失时不影响输出 |

### 9.2 与其他子项目的边界

- **5B-3（AI 客服向量召回）**：本子项目不涉及后端 RAG / 向量库
- **5C（微信集成）**：本子项目不涉及微信
- **6A（部署）**：本子项目不修改 docker-compose.yml
- **5B-1（SEO 基础）**：已完成，本子项目复用其 schema 生成器，不重复创建

## 10. 验收标准

- [ ] `lib/geo.ts` 新增 6 个摘要生成器 + 1 个组装函数（buildOrgSummary, buildCourseSummary, buildTeacherSummary, buildCampusSummary, buildNewsSummary, buildFaqSummary, buildLlmsTxtContent）
- [ ] `lib/__tests__/geo.test.ts` 单元测试全部通过
- [ ] `lib/seo.ts` 的 `buildCourseSchema` description 使用 `buildCourseSummary`
- [ ] `lib/seo.ts` 的 `buildPersonSchema` 新增 description 使用 `buildTeacherSummary`
- [ ] `lib/seo.ts` 的 `buildLocalBusinessSchema` 新增 description 使用 `buildCampusSummary`
- [ ] `app/llms.txt/route.ts` 重写为调用 `buildLlmsTxtContent` 生成全量内容
- [ ] llms.txt 包含课程名称（非仅链接）
- [ ] llms.txt 包含教师姓名
- [ ] llms.txt 包含校区地址
- [ ] llms.txt 包含 FAQ 问答内容
- [ ] E2E 测试（`e2e/seo.spec.ts`）新增 llms.txt 内容验证测试
- [ ] 前端单元测试总数不回退（395+ → 395+ 新增）
- [ ] `lib/seo.ts` 与 `lib/geo.ts` 无循环依赖
