import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildOrgSummary,
  buildCourseSummary,
  buildTeacherSummary,
  buildCampusSummary,
  buildNewsSummary,
  buildFaqSummary,
  buildLlmsTxtContent,
} from '../geo';
import type { SiteSettings, Product, CourseObjective, Teacher, Campus, NewsArticle, FaqItem } from '../api';

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
      name: '测试校区',
      slug: 'no-phone',
      address: '某地址',
    } as Pick<Campus, 'name' | 'slug' | 'address' | 'phone' | 'businessHours' | 'transportation'>;
    const result = buildCampusSummary(campus, 'zh-CN');
    expect(result).toContain('测试校区');
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

  it('后台配置 aiSummary 时写入 llms.txt 机构简介区（GEO）', () => {
    const settings = {
      name: '佑森小课堂',
      aiSummary: '佑森小课堂是武汉专注幼小衔接的教育机构，8年经验，6大校区。',
    } as any;
    const result = buildLlmsTxtContent(settings, [], [], [], [], [], 'zh-CN');
    expect(result).toContain('## 机构简介');
    expect(result).toContain('佑森小课堂是武汉专注幼小衔接的教育机构，8年经验，6大校区。');
  });

  it('未配置 aiSummary 时机构简介区回退为联系信息摘要', () => {
    const settings = { name: '佑森小课堂', phone: '027-12345678' } as any;
    const result = buildLlmsTxtContent(settings, [], [], [], [], [], 'zh-CN');
    expect(result).toContain('## 机构简介');
    expect(result).toContain('027-12345678');
  });
});
