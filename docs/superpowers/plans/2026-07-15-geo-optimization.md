# 5B-2 GEO 优化（llms.txt 增强 + AI 摘要）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 创建 `lib/geo.ts` 摘要生成器，重写 llms.txt route handler 输出全量内容，增强 3 个 JSON-LD schema 的 description 字段。

**架构：** `lib/geo.ts` 提供 6 个摘要生成器 + 1 个组装函数（`buildLlmsTxtContent`），纯模板提取无 LLM。`app/llms.txt/route.ts` 并行获取 6 类 Strapi 数据后调用组装函数。`lib/seo.ts` 的 3 个 schema 生成器复用摘要作为 `description` 字段。

**技术栈：** Next.js App Router、TypeScript、vitest（单元测试）、Playwright（E2E 测试）

**规格文件：** `docs/superpowers/specs/2026-07-15-geo-optimization-design.md`

---

## 文件结构

**创建的文件：**
- `frontend-next/lib/geo.ts` — GEO 摘要生成器（6 个摘要函数 + 1 个组装函数，~200 行）
- `frontend-next/lib/__tests__/geo.test.ts` — geo.ts 单元测试

**修改的文件：**
- `frontend-next/lib/seo.ts` — 增强 3 个 schema 生成器的 description + 扩宽 Pick 类型
- `frontend-next/app/llms.txt/route.ts` — 重写为调用 buildLlmsTxtContent
- `frontend-next/e2e/seo.spec.ts` — 新增 llms.txt 内容验证测试

---

## 任务 1：geo.ts Part 1 — buildOrgSummary + buildCourseSummary

**文件：**
- 创建：`frontend-next/lib/geo.ts`
- 创建：`frontend-next/lib/__tests__/geo.test.ts`

- [ ] **步骤 1：编写 buildOrgSummary + buildCourseSummary 的失败测试**

创建 `frontend-next/lib/__tests__/geo.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import {
  buildOrgSummary,
  buildCourseSummary,
} from '../geo';
import type { SiteSettings, Product, CourseObjective } from '../api';

describe('buildOrgSummary', () => {
  it('returns org summary with name, slogan, and contact info for zh-CN', () => {
    const settings = {
      name: '佑森小课堂',
      slogan: '专注幼小衔接教育8年',
      phone: '027-12345678',
      email: 'info@example.com',
      address: '武汉市武昌区',
    } as Pick<SiteSettings, 'name' | 'slogan' | 'phone' | 'email' | 'address'>;
    const result = buildOrgSummary(settings, 'zh-CN');
    expect(result).toContain('佑森小课堂');
    expect(result).toContain('专注幼小衔接教育8年');
    expect(result).toContain('027-12345678');
    expect(result).toContain('info@example.com');
    expect(result).toContain('武汉市武昌区');
  });

  it('uses English labels for en-US locale', () => {
    const settings = {
      name: 'Yousen Education',
      phone: '027-12345678',
    } as Pick<SiteSettings, 'name' | 'slogan' | 'phone' | 'email' | 'address'>;
    const result = buildOrgSummary(settings, 'en-US');
    expect(result).toContain('Yousen Education');
    expect(result).toContain('Phone:');
    expect(result).not.toContain('电话:');
  });

  it('omits missing optional fields', () => {
    const settings = {
      name: 'Test Org',
    } as Pick<SiteSettings, 'name' | 'slogan' | 'phone' | 'email' | 'address'>;
    const result = buildOrgSummary(settings, 'zh-CN');
    expect(result).toContain('Test Org');
    expect(result).not.toContain('电话');
    expect(result).not.toContain('邮箱');
    expect(result).not.toContain('地址');
  });
});

describe('buildCourseSummary', () => {
  it('returns course summary with name, description, objectives, method, and price', () => {
    const product = {
      name: '拼音班',
      slug: 'pinyin',
      shortDescription: '系统学习汉语拼音',
      description: '适合4-6岁儿童的拼音启蒙课程',
      objectives: [
        { id: 1, title: '掌握23个声母' },
        { id: 2, title: '认识24个韵母' },
        { id: 3, title: '熟练拼读' },
        { id: 4, title: '第四项目标应被截断' },
      ] as CourseObjective[],
      teachingMethod: '小班教学',
      price: 2800,
    } as Pick<Product, 'name' | 'slug' | 'shortDescription' | 'description' | 'objectives' | 'teachingMethod' | 'price'>;
    const result = buildCourseSummary(product, 'zh-CN');
    expect(result).toContain('拼音班');
    expect(result).toContain('系统学习汉语拼音');
    expect(result).toContain('掌握23个声母');
    expect(result).toContain('认识24个韵母');
    expect(result).toContain('熟练拼读');
    expect(result).not.toContain('第四项目标应被截断');
    expect(result).toContain('小班教学');
    expect(result).toContain('2800');
  });

  it('omits objectives section when empty', () => {
    const product = {
      name: '测试课程',
      slug: 'test',
      objectives: [],
    } as Pick<Product, 'name' | 'slug' | 'shortDescription' | 'description' | 'objectives' | 'teachingMethod' | 'price'>;
    const result = buildCourseSummary(product, 'zh-CN');
    expect(result).toContain('测试课程');
    expect(result).not.toContain('教学目标');
  });

  it('omits price when undefined', () => {
    const product = {
      name: '免费课程',
      slug: 'free',
    } as Pick<Product, 'name' | 'slug' | 'shortDescription' | 'description' | 'objectives' | 'teachingMethod' | 'price'>;
    const result = buildCourseSummary(product, 'zh-CN');
    expect(result).toContain('免费课程');
    expect(result).not.toContain('价格');
  });

  it('uses English labels for en-US locale', () => {
    const product = {
      name: 'Pinyin Class',
      slug: 'pinyin',
      shortDescription: 'Learn Chinese pinyin',
      teachingMethod: 'Small class',
      price: 2800,
    } as Pick<Product, 'name' | 'slug' | 'shortDescription' | 'description' | 'objectives' | 'teachingMethod' | 'price'>;
    const result = buildCourseSummary(product, 'en-US');
    expect(result).toContain('Pinyin Class');
    expect(result).toContain('Description:');
    expect(result).toContain('Teaching Method:');
    expect(result).toContain('Price:');
    expect(result).not.toContain('简介');
    expect(result).not.toContain('教学方式');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：
```bash
cd frontend-next && npx vitest run lib/__tests__/geo.test.ts
```
预期：FAIL，报错 `Failed to resolve import "../geo"` 或 `buildOrgSummary is not a function`

- [ ] **步骤 3：实现 buildOrgSummary + buildCourseSummary**

创建 `frontend-next/lib/geo.ts`：

```typescript
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
export function buildOrgSummary(
  settings: Pick<SiteSettings, 'name' | 'slogan' | 'phone' | 'email' | 'address'>,
  locale: Locale
): string {
  const labels = locale === 'en-US'
    ? { phone: 'Phone', email: 'Email', address: 'Address' }
    : { phone: '电话', email: '邮箱', address: '地址' };

  const lines: string[] = [settings.name];

  if (settings.slogan) {
    lines.push(settings.slogan);
  }
  if (settings.phone) {
    lines.push(`${labels.phone}: ${settings.phone}`);
  }
  if (settings.email) {
    lines.push(`${labels.email}: ${settings.email}`);
  }
  if (settings.address) {
    lines.push(`${labels.address}: ${settings.address}`);
  }

  return lines.join('\n');
}

/**
 * 构建课程摘要（用于 llms.txt 课程分区 + JSON-LD Course.description）
 * 内容: 简述 + 教学目标(前3条) + 教学方式 + 价格
 */
export function buildCourseSummary(
  product: Pick<Product, 'name' | 'slug' | 'shortDescription' | 'description' | 'objectives' | 'teachingMethod' | 'price'>,
  locale: Locale
): string {
  const labels = locale === 'en-US'
    ? { desc: 'Description', objectives: 'Objectives', method: 'Teaching Method', price: 'Price' }
    : { desc: '简介', objectives: '教学目标', method: '教学方式', price: '价格' };

  const lines: string[] = [];

  const desc = product.shortDescription || product.description || '';
  if (desc) {
    lines.push(`${labels.desc}: ${desc}`);
  }

  const objectives = (product.objectives || []).slice(0, 3).filter((o) => o.title);
  if (objectives.length > 0) {
    lines.push(`${labels.objectives}: ${objectives.map((o) => o.title).join(' | ')}`);
  }

  if (product.teachingMethod) {
    lines.push(`${labels.method}: ${product.teachingMethod}`);
  }

  if (typeof product.price === 'number') {
    lines.push(`${labels.price}: ${product.price}元`);
  }

  return lines.join('\n');
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：
```bash
cd frontend-next && npx vitest run lib/__tests__/geo.test.ts
```
预期：PASS，所有测试用例通过

- [ ] **步骤 5：Commit**

```bash
git add frontend-next/lib/geo.ts frontend-next/lib/__tests__/geo.test.ts
git commit -m "feat(geo): add buildOrgSummary and buildCourseSummary generators

Add first 2 GEO summary generators to lib/geo.ts:
- buildOrgSummary: org name, slogan, contact info with locale labels
- buildCourseSummary: description, objectives (top 3), method, price

Template extraction strategy - no LLM API calls.
Unit tests cover locale switching, empty field handling, objective truncation."
```

---

## 任务 2：geo.ts Part 2 — buildTeacherSummary + buildCampusSummary

**文件：**
- 修改：`frontend-next/lib/geo.ts`
- 修改：`frontend-next/lib/__tests__/geo.test.ts`

- [ ] **步骤 1：编写 buildTeacherSummary + buildCampusSummary 的失败测试**

在 `frontend-next/lib/__tests__/geo.test.ts` 文件末尾追加：

```typescript
import {
  buildOrgSummary,
  buildCourseSummary,
  buildTeacherSummary,
  buildCampusSummary,
} from '../geo';
import type { Teacher, Campus } from '../api';

describe('buildTeacherSummary', () => {
  it('returns teacher summary with title, years, education, features, achievements', () => {
    const teacher = {
      name: '张老师',
      slug: 'zhang-laoshi',
      title: '高级教师',
      teachingYears: 10,
      education: '本科',
      teachingFeatures: '寓教于乐，注重思维培养',
      achievements: ['武汉市优秀青年教师', '教学论文一等奖', '第三项成就应被截断'],
    } as Pick<Teacher, 'name' | 'slug' | 'title' | 'teachingYears' | 'education' | 'teachingFeatures' | 'achievements'>;
    const result = buildTeacherSummary(teacher, 'zh-CN');
    expect(result).toContain('张老师');
    expect(result).toContain('高级教师');
    expect(result).toContain('10');
    expect(result).toContain('本科');
    expect(result).toContain('寓教于乐，注重思维培养');
    expect(result).toContain('武汉市优秀青年教师');
    expect(result).toContain('教学论文一等奖');
    expect(result).not.toContain('第三项成就应被截断');
  });

  it('omits teachingYears when undefined', () => {
    const teacher = {
      name: '新老师',
      slug: 'new-teacher',
      title: '教师',
    } as Pick<Teacher, 'name' | 'slug' | 'title' | 'teachingYears' | 'education' | 'teachingFeatures' | 'achievements'>;
    const result = buildTeacherSummary(teacher, 'zh-CN');
    expect(result).toContain('新老师');
    expect(result).not.toContain('教龄');
  });

  it('handles empty achievements array', () => {
    const teacher = {
      name: '测试教师',
      slug: 'test',
      title: '教师',
      achievements: [],
    } as Pick<Teacher, 'name' | 'slug' | 'title' | 'teachingYears' | 'education' | 'teachingFeatures' | 'achievements'>;
    const result = buildTeacherSummary(teacher, 'zh-CN');
    expect(result).toContain('测试教师');
    expect(result).not.toContain('成就');
  });

  it('uses English labels for en-US locale', () => {
    const teacher = {
      name: 'Teacher Zhang',
      slug: 'zhang',
      title: 'Senior Teacher',
      teachingYears: 10,
    } as Pick<Teacher, 'name' | 'slug' | 'title' | 'teachingYears' | 'education' | 'teachingFeatures' | 'achievements'>;
    const result = buildTeacherSummary(teacher, 'en-US');
    expect(result).toContain('Teacher Zhang');
    expect(result).toContain('Title:');
    expect(result).toContain('Teaching Years:');
    expect(result).not.toContain('职称');
    expect(result).not.toContain('教龄');
  });
});

describe('buildCampusSummary', () => {
  it('returns campus summary with address, phone, hours, transportation', () => {
    const campus = {
      name: '百步亭校区',
      slug: 'baibuting',
      address: '武汉市江岸区百步亭花园路',
      phone: '027-82345678',
      businessHours: '周一至周五 8:00-18:00',
      transportation: '地铁3号线百步亭站',
    } as Pick<Campus, 'name' | 'slug' | 'address' | 'phone' | 'businessHours' | 'transportation'>;
    const result = buildCampusSummary(campus, 'zh-CN');
    expect(result).toContain('百步亭校区');
    expect(result).toContain('武汉市江岸区百步亭花园路');
    expect(result).toContain('027-82345678');
    expect(result).toContain('周一至周五 8:00-18:00');
    expect(result).toContain('地铁3号线百步亭站');
  });

  it('omits transportation when undefined', () => {
    const campus = {
      name: '测试校区',
      slug: 'test',
      address: '测试地址',
    } as Pick<Campus, 'name' | 'slug' | 'address' | 'phone' | 'businessHours' | 'transportation'>;
    const result = buildCampusSummary(campus, 'zh-CN');
    expect(result).toContain('测试校区');
    expect(result).toContain('测试地址');
    expect(result).not.toContain('交通');
  });

  it('omits phone when undefined', () => {
    const campus = {
      name: '无电话校区',
      slug: 'no-phone',
      address: '某地址',
    } as Pick<Campus, 'name' | 'slug' | 'address' | 'phone' | 'businessHours' | 'transportation'>;
    const result = buildCampusSummary(campus, 'zh-CN');
    expect(result).toContain('无电话校区');
    expect(result).not.toContain('电话');
  });

  it('uses English labels for en-US locale', () => {
    const campus = {
      name: 'Baibuting Campus',
      slug: 'baibuting',
      address: 'Baibuting Garden Road, Wuhan',
      phone: '027-82345678',
    } as Pick<Campus, 'name' | 'slug' | 'address' | 'phone' | 'businessHours' | 'transportation'>;
    const result = buildCampusSummary(campus, 'en-US');
    expect(result).toContain('Baibuting Campus');
    expect(result).toContain('Address:');
    expect(result).toContain('Phone:');
    expect(result).not.toContain('地址');
    expect(result).not.toContain('电话');
  });
});
```

同时更新测试文件顶部的导入（替换之前的导入块）：

```typescript
import {
  buildOrgSummary,
  buildCourseSummary,
  buildTeacherSummary,
  buildCampusSummary,
} from '../geo';
import type { SiteSettings, Product, CourseObjective, Teacher, Campus } from '../api';
```

- [ ] **步骤 2：运行测试验证失败**

运行：
```bash
cd frontend-next && npx vitest run lib/__tests__/geo.test.ts
```
预期：FAIL，报错 `buildTeacherSummary is not a function` 或类似导入错误

- [ ] **步骤 3：实现 buildTeacherSummary + buildCampusSummary**

在 `frontend-next/lib/geo.ts` 文件末尾追加：

```typescript
/**
 * 构建教师摘要（用于 llms.txt 教师分区 + JSON-LD Person.description）
 * 内容: 职称 + 教龄 + 学历 + 教学特色 + 成就(前2条)
 */
export function buildTeacherSummary(
  teacher: Pick<Teacher, 'name' | 'slug' | 'title' | 'teachingYears' | 'education' | 'teachingFeatures' | 'achievements'>,
  locale: Locale
): string {
  const labels = locale === 'en-US'
    ? { title: 'Title', years: 'Teaching Years', education: 'Education', features: 'Teaching Features', achievements: 'Achievements' }
    : { title: '职称', years: '教龄', education: '学历', features: '教学特色', achievements: '成就' };

  const lines: string[] = [teacher.name];

  if (teacher.title) {
    lines.push(`${labels.title}: ${teacher.title}`);
  }
  if (typeof teacher.teachingYears === 'number') {
    lines.push(`${labels.years}: ${teacher.teachingYears}${locale === 'en-US' ? ' years' : '年'}`);
  }
  if (teacher.education) {
    lines.push(`${labels.education}: ${teacher.education}`);
  }
  if (teacher.teachingFeatures) {
    lines.push(`${labels.features}: ${teacher.teachingFeatures}`);
  }

  const achievements = (teacher.achievements || []).slice(0, 2).filter(Boolean);
  if (achievements.length > 0) {
    lines.push(`${labels.achievements}: ${achievements.join(' | ')}`);
  }

  return lines.join('\n');
}

/**
 * 构建校区摘要（用于 llms.txt 校区分区 + JSON-LD LocalBusiness.description）
 * 内容: 地址 + 电话 + 营业时间 + 交通指引
 */
export function buildCampusSummary(
  campus: Pick<Campus, 'name' | 'slug' | 'address' | 'phone' | 'businessHours' | 'transportation'>,
  locale: Locale
): string {
  const labels = locale === 'en-US'
    ? { address: 'Address', phone: 'Phone', hours: 'Business Hours', transport: 'Transportation' }
    : { address: '地址', phone: '电话', hours: '营业时间', transport: '交通' };

  const lines: string[] = [campus.name];

  if (campus.address) {
    lines.push(`${labels.address}: ${campus.address}`);
  }
  if (campus.phone) {
    lines.push(`${labels.phone}: ${campus.phone}`);
  }
  if (campus.businessHours) {
    lines.push(`${labels.hours}: ${campus.businessHours}`);
  }
  if (campus.transportation) {
    lines.push(`${labels.transport}: ${campus.transportation}`);
  }

  return lines.join('\n');
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：
```bash
cd frontend-next && npx vitest run lib/__tests__/geo.test.ts
```
预期：PASS，所有测试用例通过

- [ ] **步骤 5：Commit**

```bash
git add frontend-next/lib/geo.ts frontend-next/lib/__tests__/geo.test.ts
git commit -m "feat(geo): add buildTeacherSummary and buildCampusSummary generators

Add 2 more GEO summary generators:
- buildTeacherSummary: title, years, education, features, achievements (top 2)
- buildCampusSummary: address, phone, business hours, transportation

Unit tests cover locale switching, missing fields, achievement truncation."
```

---

## 任务 3：geo.ts Part 3 — buildNewsSummary + buildFaqSummary

**文件：**
- 修改：`frontend-next/lib/geo.ts`
- 修改：`frontend-next/lib/__tests__/geo.test.ts`

- [ ] **步骤 1：编写 buildNewsSummary + buildFaqSummary 的失败测试**

在 `frontend-next/lib/__tests__/geo.test.ts` 文件末尾追加：

```typescript
import {
  buildOrgSummary,
  buildCourseSummary,
  buildTeacherSummary,
  buildCampusSummary,
  buildNewsSummary,
  buildFaqSummary,
} from '../geo';
import type { NewsArticle, FaqItem } from '../api';

describe('buildNewsSummary', () => {
  it('returns news summary with title and excerpt', () => {
    const news = {
      title: '暑期班报名开始',
      slug: 'summer-enrollment',
      excerpt: '暑假班开始报名了，名额有限。',
      publishedAt: '2026-07-10T00:00:00.000Z',
    } as Pick<NewsArticle, 'title' | 'slug' | 'excerpt' | 'content' | 'publishedAt'>;
    const result = buildNewsSummary(news, 'zh-CN');
    expect(result).toContain('暑期班报名开始');
    expect(result).toContain('暑假班开始报名了');
    expect(result).toContain('2026-07-10');
  });

  it('truncates content to 100 characters with ellipsis', () => {
    const longContent = '这是一段很长的新闻正文内容'.repeat(20);
    const news = {
      title: '长文新闻',
      slug: 'long-news',
      content: longContent,
    } as Pick<NewsArticle, 'title' | 'slug' | 'excerpt' | 'content' | 'publishedAt'>;
    const result = buildNewsSummary(news, 'zh-CN');
    expect(result).toContain('长文新闻');
    expect(result).toContain('...');
    // Content should be truncated
    expect(result.length).toBeLessThan(longContent.length + 200);
  });

  it('prefers excerpt over content', () => {
    const news = {
      title: '测试新闻',
      slug: 'test',
      excerpt: '这是摘要',
      content: '这是正文内容，应该不被使用',
    } as Pick<NewsArticle, 'title' | 'slug' | 'excerpt' | 'content' | 'publishedAt'>;
    const result = buildNewsSummary(news, 'zh-CN');
    expect(result).toContain('这是摘要');
    expect(result).not.toContain('这是正文内容');
  });

  it('handles missing publishedAt', () => {
    const news = {
      title: '无日期新闻',
      slug: 'no-date',
      excerpt: '摘要',
    } as Pick<NewsArticle, 'title' | 'slug' | 'excerpt' | 'content' | 'publishedAt'>;
    const result = buildNewsSummary(news, 'zh-CN');
    expect(result).toContain('无日期新闻');
    expect(result).toContain('摘要');
  });
});

describe('buildFaqSummary', () => {
  it('formats Q&A pairs', () => {
    const faqItems = [
      { id: 1, question: '什么是幼小衔接？', answer: '幼小衔接是幼儿园到小学的过渡期教育。' },
      { id: 2, question: '课程如何安排？', answer: '每周3次课，每次2小时。' },
    ] as FaqItem[];
    const result = buildFaqSummary(faqItems);
    expect(result).toContain('Q: 什么是幼小衔接？');
    expect(result).toContain('A: 幼小衔接是幼儿园到小学的过渡期教育。');
    expect(result).toContain('Q: 课程如何安排？');
    expect(result).toContain('A: 每周3次课，每次2小时。');
  });

  it('limits to 5 items', () => {
    const faqItems = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      question: `问题${i + 1}`,
      answer: `答案${i + 1}`,
    })) as FaqItem[];
    const result = buildFaqSummary(faqItems);
    expect(result).toContain('问题1');
    expect(result).toContain('问题5');
    expect(result).not.toContain('问题6');
    expect(result).not.toContain('问题7');
  });

  it('returns empty string for empty array', () => {
    const result = buildFaqSummary([]);
    expect(result).toBe('');
  });
});
```

同时更新测试文件顶部的导入：

```typescript
import {
  buildOrgSummary,
  buildCourseSummary,
  buildTeacherSummary,
  buildCampusSummary,
  buildNewsSummary,
  buildFaqSummary,
} from '../geo';
import type { SiteSettings, Product, CourseObjective, Teacher, Campus, NewsArticle, FaqItem } from '../api';
```

- [ ] **步骤 2：运行测试验证失败**

运行：
```bash
cd frontend-next && npx vitest run lib/__tests__/geo.test.ts
```
预期：FAIL，报错 `buildNewsSummary is not a function`

- [ ] **步骤 3：实现 buildNewsSummary + buildFaqSummary**

在 `frontend-next/lib/geo.ts` 文件末尾追加：

```typescript
/**
 * 构建新闻摘要（用于 llms.txt 新闻分区）
 * 内容: 标题 + 摘要(content 截断到 100 字)
 */
export function buildNewsSummary(
  news: Pick<NewsArticle, 'title' | 'slug' | 'excerpt' | 'content' | 'publishedAt'>,
  locale: Locale
): string {
  void locale; // 新闻摘要不区分 locale 标签
  const lines: string[] = [];

  const date = news.publishedAt ? news.publishedAt.split('T')[0] : '';
  if (date) {
    lines.push(`[${date}] ${news.title}`);
  } else {
    lines.push(news.title);
  }

  const summary = news.excerpt || news.content || '';
  if (summary) {
    const truncated = summary.length > 100 ? summary.slice(0, 100) + '...' : summary;
    lines.push(truncated);
  }

  return lines.join('\n');
}

/**
 * 构建 FAQ 摘要（用于 llms.txt FAQ 分区）
 * 内容: 前5条 Q&A 格式化
 */
export function buildFaqSummary(faqItems: FaqItem[]): string {
  const items = faqItems.slice(0, 5);
  if (items.length === 0) {
    return '';
  }

  return items
    .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
    .join('\n\n');
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：
```bash
cd frontend-next && npx vitest run lib/__tests__/geo.test.ts
```
预期：PASS，所有测试用例通过

- [ ] **步骤 5：Commit**

```bash
git add frontend-next/lib/geo.ts frontend-next/lib/__tests__/geo.test.ts
git commit -m "feat(geo): add buildNewsSummary and buildFaqSummary generators

Add 2 more GEO summary generators:
- buildNewsSummary: title, date, excerpt (prefers excerpt over content, truncates to 100 chars)
- buildFaqSummary: Q&A format, limited to 5 items

Unit tests cover truncation, excerpt priority, 5-item limit, empty array."
```

---

## 任务 4：geo.ts — buildLlmsTxtContent 组装函数

**文件：**
- 修改：`frontend-next/lib/geo.ts`
- 修改：`frontend-next/lib/__tests__/geo.test.ts`

- [ ] **步骤 1：编写 buildLlmsTxtContent 的失败测试**

在 `frontend-next/lib/__tests__/geo.test.ts` 文件末尾追加：

```typescript
import { buildLlmsTxtContent } from '../geo';

describe('buildLlmsTxtContent', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
  });
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it('contains H1 title and blockquote summary', () => {
    const settings = { name: '佑森小课堂' } as any;
    const result = buildLlmsTxtContent(settings, [], [], [], [], [], 'zh-CN');
    expect(result).toContain('# 佑森小课堂');
    expect(result).toMatch(/^> /m);
  });

  it('contains all section headers when data is present', () => {
    const settings = { name: '测试机构', address: '测试地址' } as any;
    const products = [{ name: '课程A', slug: 'course-a' }] as any;
    const teachers = [{ name: '教师A', slug: 'teacher-a', title: '教师' }] as any;
    const campuses = [{ name: '校区A', slug: 'campus-a', address: '地址A' }] as any;
    const news = [{ title: '新闻A', slug: 'news-a' }] as any;
    const faqItems = [{ question: '问题A', answer: '答案A' }] as any;
    const result = buildLlmsTxtContent(settings, products, teachers, campuses, news, faqItems, 'zh-CN');
    expect(result).toContain('## 机构简介');
    expect(result).toContain('## 课程体系');
    expect(result).toContain('## 师资团队');
    expect(result).toContain('## 校区信息');
    expect(result).toContain('## 常见问题');
    expect(result).toContain('## 新闻动态');
  });

  it('omits sections when data is empty', () => {
    const settings = { name: '测试机构' } as any;
    const result = buildLlmsTxtContent(settings, [], [], [], [], [], 'zh-CN');
    expect(result).toContain('# 测试机构');
    expect(result).not.toContain('## 课程体系');
    expect(result).not.toContain('## 师资团队');
    expect(result).not.toContain('## 校区信息');
    expect(result).not.toContain('## 常见问题');
    expect(result).not.toContain('## 新闻动态');
  });

  it('contains course name (not just link)', () => {
    const settings = { name: '测试' } as any;
    const products = [{ name: '拼音专项班', slug: 'pinyin', shortDescription: '学拼音' }] as any;
    const result = buildLlmsTxtContent(settings, products, [], [], [], [], 'zh-CN');
    expect(result).toContain('拼音专项班');
    expect(result).toContain('学拼音');
    expect(result).toContain('https://example.com/courses/pinyin');
  });

  it('contains campus address', () => {
    const settings = { name: '测试' } as any;
    const campuses = [{ name: '百步亭校区', slug: 'baibuting', address: '武汉市江岸区百步亭花园路' }] as any;
    const result = buildLlmsTxtContent(settings, [], [], campuses, [], [], 'zh-CN');
    expect(result).toContain('百步亭校区');
    expect(result).toContain('武汉市江岸区百步亭花园路');
    expect(result).toContain('https://example.com/campuses/baibuting');
  });

  it('contains teacher name', () => {
    const settings = { name: '测试' } as any;
    const teachers = [{ name: '张老师', slug: 'zhang', title: '高级教师' }] as any;
    const result = buildLlmsTxtContent(settings, [], teachers, [], [], [], 'zh-CN');
    expect(result).toContain('张老师');
    expect(result).toContain('https://example.com/teachers/zhang');
  });

  it('limits news to 10 items', () => {
    const settings = { name: '测试' } as any;
    const news = Array.from({ length: 15 }, (_, i) => ({
      title: `新闻${i + 1}`,
      slug: `news-${i + 1}`,
    })) as any;
    const result = buildLlmsTxtContent(settings, [], [], [], news, [], 'zh-CN');
    expect(result).toContain('新闻1');
    expect(result).toContain('新闻10');
    expect(result).not.toContain('新闻11');
  });
});
```

同时在测试文件顶部添加 `beforeEach`/`afterEach` 导入：

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
```

- [ ] **步骤 2：运行测试验证失败**

运行：
```bash
cd frontend-next && npx vitest run lib/__tests__/geo.test.ts
```
预期：FAIL，报错 `buildLlmsTxtContent is not a function`

- [ ] **步骤 3：实现 buildLlmsTxtContent**

在 `frontend-next/lib/geo.ts` 文件末尾追加：

```typescript
/**
 * 组装完整 llms.txt 内容
 * 调用以上所有生成器，按 llms.txt 标准格式组装
 */
export function buildLlmsTxtContent(
  settings: Pick<SiteSettings, 'name' | 'slogan' | 'phone' | 'email' | 'address'>,
  products: Product[],
  teachers: Teacher[],
  campuses: Campus[],
  news: NewsArticle[],
  faqItems: FaqItem[],
  locale: Locale
): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const sections: string[] = [];

  // H1 title + blockquote summary
  sections.push(`# ${settings.name} (Yousen Education)`);
  sections.push('');
  sections.push(`> ${settings.slogan || '专注幼小衔接教育'} | Focus on preschool-primary transition education.`);
  sections.push('');

  // 机构简介 / About
  const orgSummary = buildOrgSummary(settings, locale);
  sections.push('## 机构简介 / About');
  sections.push('');
  sections.push(orgSummary);
  sections.push('');

  // 课程体系 / Courses
  if (products.length > 0) {
    sections.push('## 课程体系 / Courses');
    sections.push('');
    for (const product of products) {
      sections.push(`### ${product.name}`);
      sections.push(buildCourseSummary(product, locale));
      sections.push(`- 链接: ${baseUrl}/courses/${product.slug}`);
      sections.push('');
    }
  }

  // 师资团队 / Teachers
  if (teachers.length > 0) {
    sections.push('## 师资团队 / Teachers');
    sections.push('');
    for (const teacher of teachers) {
      sections.push(`### ${teacher.name}`);
      sections.push(buildTeacherSummary(teacher, locale));
      sections.push(`- 链接: ${baseUrl}/teachers/${teacher.slug}`);
      sections.push('');
    }
  }

  // 校区信息 / Campuses
  if (campuses.length > 0) {
    sections.push('## 校区信息 / Campuses');
    sections.push('');
    for (const campus of campuses) {
      sections.push(`### ${campus.name}`);
      sections.push(buildCampusSummary(campus, locale));
      sections.push(`- 链接: ${baseUrl}/campuses/${campus.slug}`);
      sections.push('');
    }
  }

  // 常见问题 / FAQ
  const faqSummary = buildFaqSummary(faqItems);
  if (faqSummary) {
    sections.push('## 常见问题 / FAQ');
    sections.push('');
    sections.push(faqSummary);
    sections.push('');
  }

  // 新闻动态 / News
  if (news.length > 0) {
    sections.push('## 新闻动态 / News');
    sections.push('');
    const newsItems = news.slice(0, 10);
    for (const item of newsItems) {
      const date = item.publishedAt ? item.publishedAt.split('T')[0] : '';
      const datePrefix = date ? `[${date}] ` : '';
      sections.push(`- ${datePrefix}${item.title}: ${baseUrl}/news/${item.slug}`);
    }
    sections.push('');
  }

  return sections.join('\n').trim() + '\n';
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：
```bash
cd frontend-next && npx vitest run lib/__tests__/geo.test.ts
```
预期：PASS，所有测试用例通过

- [ ] **步骤 5：Commit**

```bash
git add frontend-next/lib/geo.ts frontend-next/lib/__tests__/geo.test.ts
git commit -m "feat(geo): add buildLlmsTxtContent assembler function

Add the final GEO function that assembles all summary generators into
a complete llms.txt document following the llms.txt standard format:
- H1 title + blockquote summary
- Sectioned content (About, Courses, Teachers, Campuses, FAQ, News)
- Empty sections are omitted
- News limited to 10 items
- Each content item includes a link

Unit tests cover section presence/omission, content verification, news limit."
```

---

## 任务 5：seo.ts — JSON-LD description 增强

**文件：**
- 修改：`frontend-next/lib/seo.ts`（第 4-13 行导入区、第 184-210 行 buildLocalBusinessSchema、第 215-244 行 buildPersonSchema、第 250-279 行 buildCourseSchema）
- 修改：`frontend-next/lib/__tests__/seo.test.ts`（更新现有测试以适配新 description）

- [ ] **步骤 1：更新 seo.ts 导入和 3 个 schema 生成器**

在 `frontend-next/lib/seo.ts` 第 13 行之后（现有导入块末尾）新增导入：

```typescript
import { buildCourseSummary, buildTeacherSummary, buildCampusSummary } from './geo';
```

替换 `buildCourseSchema` 函数（当前第 250-279 行）为：

```typescript
/**
 * 构建 Course schema（课程实体，增强版）
 * provider 为 EducationalOrganization，offers 含 price + priceCurrency
 * description 复用 geo.ts 的 buildCourseSummary
 */
export function buildCourseSchema(
  product: Pick<Product, 'name' | 'slug' | 'description' | 'shortDescription' | 'objectives' | 'teachingMethod' | 'price'>,
  settings: Pick<SiteSettings, 'name'>,
  locale: Locale
): Record<string, unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const prefix = locale === 'en-US' ? '/en-US' : '';
  const description = buildCourseSummary(product, locale);
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: product.name,
    description,
    url: `${baseUrl}${prefix}/courses/${product.slug}`,
    provider: {
      '@type': 'EducationalOrganization',
      name: settings.name,
    },
  };

  if (typeof product.price === 'number') {
    schema.offers = {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'CNY',
    };
  }

  return schema;
}
```

替换 `buildPersonSchema` 函数（当前第 215-244 行）为：

```typescript
/**
 * 构建 Person schema（教师实体）
 * description 复用 geo.ts 的 buildTeacherSummary
 */
export function buildPersonSchema(
  teacher: Pick<Teacher, 'name' | 'title' | 'slug' | 'avatar' | 'achievements' | 'teachingYears' | 'education' | 'teachingFeatures'>,
  locale: Locale
): Record<string, unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const prefix = locale === 'en-US' ? '/en-US' : '';
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: teacher.name,
    description: buildTeacherSummary(teacher, locale),
    url: `${baseUrl}${prefix}/teachers/${teacher.slug}`,
    worksFor: {
      '@type': 'EducationalOrganization',
      name: '佑森小课堂',
    },
  };

  if (teacher.title) schema.jobTitle = teacher.title;
  if (teacher.avatar?.url) {
    schema.image = getImageUrl(teacher.avatar);
  }
  const achievements = Array.isArray(teacher.achievements)
    ? teacher.achievements.filter(Boolean)
    : [];
  if (achievements.length > 0) {
    schema.knowsAbout = achievements;
  }

  return schema;
}
```

替换 `buildLocalBusinessSchema` 函数（当前第 184-210 行）为：

```typescript
/**
 * 构建 LocalBusiness schema（校区本地商业实体）
 * 使用双类型 ['LocalBusiness', 'EducationalOrganization'] 兼顾本地 SEO 和教育权威
 * description 复用 geo.ts 的 buildCampusSummary
 */
export function buildLocalBusinessSchema(
  campus: Pick<Campus, 'name' | 'slug' | 'address' | 'phone' | 'businessHours' | 'coverImage' | 'transportation'>,
  locale: Locale
): Record<string, unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const prefix = locale === 'en-US' ? '/en-US' : '';
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'EducationalOrganization'],
    name: campus.name,
    description: buildCampusSummary(campus, locale),
    url: `${baseUrl}${prefix}/campuses/${campus.slug}`,
  };

  if (campus.address) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: campus.address,
    };
  }
  if (campus.phone) schema.telephone = campus.phone;
  if (campus.businessHours) schema.openingHours = campus.businessHours;
  if (campus.coverImage?.url) {
    schema.image = getImageUrl(campus.coverImage);
  }

  return schema;
}
```

- [ ] **步骤 2：更新 seo.test.ts 中受影响的测试**

在 `frontend-next/lib/__tests__/seo.test.ts` 中，找到 `buildLocalBusinessSchema` 的测试块，为测试数据添加 `transportation` 字段以确保 Pick 类型匹配：

找到 `buildLocalBusinessSchema` 的第一个测试（`returns LocalBusiness + EducationalOrganization dual type`），在 campus 对象中添加 `transportation: '地铁3号线'`。

找到 `buildPersonSchema` 的测试块，为测试数据添加 `teachingYears`、`education`、`teachingFeatures` 字段。

找到 `buildCourseSchema` 的测试块，为测试数据添加 `objectives` 和 `teachingMethod` 字段。

具体修改：在 `buildLocalBusinessSchema` describe 块的 campus 对象中添加 `transportation: '地铁3号线百步亭站'`；在 `buildPersonSchema` describe 块的 teacher 对象中添加 `teachingYears: 10, education: '本科', teachingFeatures: '寓教于乐'`；在 `buildCourseSchema` describe 块的 product 对象中添加 `objectives: [{ id: 1, title: '掌握声母' }], teachingMethod: '小班教学'`。

- [ ] **步骤 3：运行所有测试验证通过**

运行：
```bash
cd frontend-next && npx vitest run lib/__tests__/seo.test.ts lib/__tests__/geo.test.ts
```
预期：PASS，所有测试用例通过（seo.test.ts + geo.test.ts）

- [ ] **步骤 4：运行全量测试确认无回归**

运行：
```bash
cd frontend-next && npx vitest run
```
预期：PASS，所有测试通过（395 + geo.test.ts 新增）

- [ ] **步骤 5：Commit**

```bash
git add frontend-next/lib/seo.ts frontend-next/lib/__tests__/seo.test.ts
git commit -m "feat(seo): enhance JSON-LD description with geo.ts summaries

Enhance 3 schema generators to use geo.ts summaries for description:
- buildCourseSchema: description now uses buildCourseSummary
- buildPersonSchema: new description field using buildTeacherSummary
- buildLocalBusinessSchema: new description field using buildCampusSummary

Widen Pick types to include fields needed by summary generators:
- Course: +objectives, +teachingMethod
- Person: +teachingYears, +education, +teachingFeatures
- LocalBusiness: +transportation

Update existing tests with required fields."
```

---

## 任务 6：llms.txt route handler 重写

**文件：**
- 修改：`frontend-next/app/llms.txt/route.ts`

- [ ] **步骤 1：重写 route handler**

将 `frontend-next/app/llms.txt/route.ts` 全部内容替换为：

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

- [ ] **步骤 2：运行全量测试确认无回归**

运行：
```bash
cd frontend-next && npx vitest run
```
预期：PASS，所有测试通过

- [ ] **步骤 3：Commit**

```bash
git add frontend-next/app/llms.txt/route.ts
git commit -m "feat(llms-txt): rewrite route handler with full content via geo.ts

Replace basic link-list llms.txt with full content:
- Fetch 6 data types in parallel (settings, products, teachers, campuses, news, FAQ)
- Call buildLlmsTxtContent to generate complete llms.txt
- Include course descriptions, teacher bios, campus addresses, FAQ Q&A
- ISR revalidate=3600 (1h), Cache-Control unchanged
- Fallback to { name: '佑森小课堂' } when settings missing"
```

---

## 任务 7：E2E 测试扩展 — llms.txt 内容验证

**文件：**
- 修改：`frontend-next/e2e/seo.spec.ts`

- [ ] **步骤 1：在 seo.spec.ts 末尾新增 llms.txt 测试用例**

在 `frontend-next/e2e/seo.spec.ts` 的 `test.describe('SEO structured data', ...)` 块内，在最后一个 test（sitemap.xml）之后追加：

```typescript
  test('llms.txt contains course names (not just links)', async ({ page }) => {
    const response = await page.request.get('/llms.txt');
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toContain('## 课程体系');
    // Should contain actual course content, not just URLs
    expect(text).toContain('简介:');
  });

  test('llms.txt contains teacher information', async ({ page }) => {
    const response = await page.request.get('/llms.txt');
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toContain('## 师资团队');
  });

  test('llms.txt contains campus addresses', async ({ page }) => {
    const response = await page.request.get('/llms.txt');
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toContain('## 校区信息');
    expect(text).toContain('地址:');
  });
```

- [ ] **步骤 2：运行全量单元测试确认无回归**

运行：
```bash
cd frontend-next && npx vitest run
```
预期：PASS，所有单元测试通过

- [ ] **步骤 3：Commit**

```bash
git add frontend-next/e2e/seo.spec.ts
git commit -m "test(e2e): add llms.txt content verification tests

Add 3 E2E test cases to seo.spec.ts:
- llms.txt contains course names with descriptions (not just links)
- llms.txt contains teacher information section
- llms.txt contains campus addresses

These verify the GEO enhancement: llms.txt now includes substantive
content for AI search engines, not just a link list."
```
