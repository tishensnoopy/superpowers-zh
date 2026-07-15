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

  const lines: string[] = [product.name];

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
      sections.push(`- English: ${baseUrl}/en-US/courses/${product.slug}`);
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
      sections.push(`- English: ${baseUrl}/en-US/teachers/${teacher.slug}`);
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
      sections.push(`- English: ${baseUrl}/en-US/campuses/${campus.slug}`);
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
      sections.push(`- English: ${baseUrl}/en-US/news/${item.slug}`);
    }
    sections.push('');
  }

  return sections.join('\n').trim() + '\n';
}
