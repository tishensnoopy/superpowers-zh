import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildMetadata,
  buildWebSiteSchema,
  buildOrganizationSchema,
  buildBreadcrumbSchema,
  buildFaqPageSchema,
  buildLocalBusinessSchema,
  buildPersonSchema,
  buildCourseSchema,
  buildNewsArticleSchema,
} from '../seo';

describe('buildMetadata hreflang injection', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it('injects alternates.languages with zh-CN + en-US URLs', () => {
    const metadata = buildMetadata(undefined, {
      title: 'Courses',
      canonicalUrl: 'https://example.com/courses',
    }, { locale: 'zh-CN', path: '/courses' });

    expect(metadata.alternates?.languages).toEqual({
      'zh-CN': 'https://example.com/courses',
      'en-US': 'https://example.com/en-US/courses',
    });
  });

  it('injects alternates.languages for en-US locale', () => {
    const metadata = buildMetadata(undefined, {
      title: 'Courses',
      canonicalUrl: 'https://example.com/en-US/courses',
    }, { locale: 'en-US', path: '/courses' });

    expect(metadata.alternates?.languages).toEqual({
      'zh-CN': 'https://example.com/courses',
      'en-US': 'https://example.com/en-US/courses',
    });
  });

  it('does not inject alternates.languages when i18n missing', () => {
    const metadata = buildMetadata(undefined, { title: 'Home' });
    expect(metadata.alternates?.languages).toBeUndefined();
  });
});

describe('buildWebSiteSchema', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
  });
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it('returns WebSite schema with name and url', () => {
    const settings = { name: '佑森小课堂' } as any;
    const schema = buildWebSiteSchema(settings, 'zh-CN');
    expect(schema['@type']).toBe('WebSite');
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['name']).toBe('佑森小课堂');
    expect(schema['url']).toBe('https://example.com');
  });

  it('does not include potentialAction (no global search)', () => {
    const settings = { name: 'Test' } as any;
    const schema = buildWebSiteSchema(settings, 'zh-CN');
    expect(schema['potentialAction']).toBeUndefined();
  });

  it('uses en-US url prefix for en-US locale', () => {
    const settings = { name: 'Test' } as any;
    const schema = buildWebSiteSchema(settings, 'en-US');
    expect(schema['url']).toBe('https://example.com/en-US');
  });
});

describe('buildOrganizationSchema', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
    process.env.NEXT_PUBLIC_STRAPI_API_URL = 'https://example.com';
  });
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_STRAPI_API_URL;
  });

  it('returns EducationalOrganization schema with core fields', () => {
    const settings = {
      name: '佑森小课堂',
      phone: '027-12345678',
      email: 'test@example.com',
      address: '武汉市武昌区',
      logo: { url: '/logo.png', alternativeText: 'logo' },
    } as any;
    const schema = buildOrganizationSchema(settings, [], 'zh-CN');
    expect(schema['@type']).toBe('EducationalOrganization');
    expect(schema['name']).toBe('佑森小课堂');
    expect(schema['url']).toBe('https://example.com');
    expect(schema['telephone']).toBe('027-12345678');
    expect(schema['email']).toBe('test@example.com');
    expect(schema['logo']).toBe('https://example.com/logo.png');
  });

  it('extracts sameAs from socialLinks filtering only http URLs', () => {
    const settings = { name: 'Test' } as any;
    const socialLinks = [
      { platform: 'wechat', url: 'wechat_id_123', label: 'WeChat' },
      { platform: 'weibo', url: 'https://weibo.com/yousen', label: 'Weibo' },
      { platform: 'douyin', url: 'https://douyin.com/yousen', label: 'Douyin' },
    ] as any;
    const schema = buildOrganizationSchema(settings, socialLinks, 'zh-CN');
    expect(schema['sameAs']).toEqual([
      'https://weibo.com/yousen',
      'https://douyin.com/yousen',
    ]);
  });

  it('handles empty socialLinks gracefully', () => {
    const settings = { name: 'Test' } as any;
    const schema = buildOrganizationSchema(settings, [], 'zh-CN');
    expect(schema['sameAs']).toBeUndefined();
  });

  it('builds PostalAddress structure from address string', () => {
    const settings = {
      name: 'Test',
      address: '武汉市武昌区和平大道100号',
    } as any;
    const schema = buildOrganizationSchema(settings, [], 'zh-CN');
    expect(schema['address']).toEqual({
      '@type': 'PostalAddress',
      streetAddress: '武汉市武昌区和平大道100号',
    });
  });

  it('omits telephone/email/logo when not provided', () => {
    const settings = { name: 'Test' } as any;
    const schema = buildOrganizationSchema(settings, [], 'zh-CN');
    expect(schema['telephone']).toBeUndefined();
    expect(schema['email']).toBeUndefined();
    expect(schema['logo']).toBeUndefined();
  });
});

describe('buildBreadcrumbSchema', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
  });
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it('returns BreadcrumbList with correct itemListElement', () => {
    const items = [
      { name: '首页', url: '/' },
      { name: '课程', url: '/courses' },
      { name: '拼音班', url: '/courses/pinyin' },
    ];
    const schema = buildBreadcrumbSchema(items, 'zh-CN') as any;
    expect(schema['@type']).toBe('BreadcrumbList');
    expect(schema['itemListElement']).toHaveLength(3);
    expect(schema['itemListElement'][0]).toEqual({
      '@type': 'ListItem',
      position: 1,
      name: '首页',
      item: 'https://example.com/',
    });
    expect(schema['itemListElement'][1]).toEqual({
      '@type': 'ListItem',
      position: 2,
      name: '课程',
      item: 'https://example.com/courses',
    });
    expect(schema['itemListElement'][2]).toEqual({
      '@type': 'ListItem',
      position: 3,
      name: '拼音班',
      item: 'https://example.com/courses/pinyin',
    });
  });

  it('adds /en-US prefix for en-US locale', () => {
    const items = [{ name: 'Home', url: '/' }];
    const schema = buildBreadcrumbSchema(items, 'en-US') as any;
    expect(schema['itemListElement'][0]['item']).toBe('https://example.com/en-US/');
  });

  it('handles empty items array', () => {
    const schema = buildBreadcrumbSchema([], 'zh-CN');
    expect(schema['itemListElement']).toEqual([]);
  });
});

describe('buildFaqPageSchema', () => {
  it('returns FAQPage with Question entities', () => {
    const faqItems = [
      { question: '什么是幼小衔接？', answer: '幼小衔接是幼儿园到小学的过渡期教育。' },
      { question: '课程如何安排？', answer: '每周3次课，每次2小时。' },
    ] as any;
    const schema = buildFaqPageSchema(faqItems) as any;
    expect(schema['@type']).toBe('FAQPage');
    expect(schema['mainEntity']).toHaveLength(2);
    expect(schema['mainEntity'][0]).toEqual({
      '@type': 'Question',
      name: '什么是幼小衔接？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '幼小衔接是幼儿园到小学的过渡期教育。',
      },
    });
  });

  it('handles empty faqItems array', () => {
    const schema = buildFaqPageSchema([]);
    expect(schema['mainEntity']).toEqual([]);
  });
});

describe('buildLocalBusinessSchema', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
    process.env.NEXT_PUBLIC_STRAPI_API_URL = 'https://example.com';
  });
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_STRAPI_API_URL;
  });

  it('returns LocalBusiness + EducationalOrganization dual type', () => {
    const campus = {
      name: '百步亭校区',
      slug: 'baibuting',
      address: '武汉市江岸区百步亭花园路',
      phone: '027-82345678',
      businessHours: '周一至周五 8:00-18:00',
      transportation: '地铁3号线百步亭站',
      coverImage: { url: '/campus.jpg', alternativeText: 'campus' },
    } as any;
    const schema = buildLocalBusinessSchema(campus, 'zh-CN');
    expect(schema['@type']).toEqual(['LocalBusiness', 'EducationalOrganization']);
    expect(schema['name']).toBe('百步亭校区');
    expect(schema['address']).toEqual({
      '@type': 'PostalAddress',
      streetAddress: '武汉市江岸区百步亭花园路',
    });
    expect(schema['telephone']).toBe('027-82345678');
    expect(schema['openingHours']).toBe('周一至周五 8:00-18:00');
    expect(schema['url']).toBe('https://example.com/campuses/baibuting');
  });

  it('adds /en-US prefix to url for en-US locale', () => {
    const campus = { name: 'Test', slug: 'test', address: 'addr' } as any;
    const schema = buildLocalBusinessSchema(campus, 'en-US');
    expect(schema['url']).toBe('https://example.com/en-US/campuses/test');
  });

  it('omits telephone/openingHours/image when not provided', () => {
    const campus = { name: 'Test', slug: 'test', address: 'addr' } as any;
    const schema = buildLocalBusinessSchema(campus, 'zh-CN');
    expect(schema['telephone']).toBeUndefined();
    expect(schema['openingHours']).toBeUndefined();
    expect(schema['image']).toBeUndefined();
  });

  it('includes image from coverImage when available', () => {
    const campus = {
      name: 'Test',
      slug: 'test',
      address: 'addr',
      coverImage: { url: '/img.jpg' },
    } as any;
    const schema = buildLocalBusinessSchema(campus, 'zh-CN');
    expect(schema['image']).toBe('https://example.com/img.jpg');
  });
});

describe('buildPersonSchema', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
    process.env.NEXT_PUBLIC_STRAPI_API_URL = 'https://example.com';
  });
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_STRAPI_API_URL;
  });

  it('returns Person schema with core fields', () => {
    const teacher = {
      name: '张老师',
      title: '高级教师',
      slug: 'zhang-laoshi',
      avatar: { url: '/avatar.jpg', alternativeText: 'avatar' },
      subject: 'pinyin',
      teachingYears: 10,
      education: '本科',
      teachingFeatures: '趣味拼音教学',
      achievements: ['市级优秀教师', '教学比赛一等奖'],
    } as any;
    const schema = buildPersonSchema(teacher, 'zh-CN');
    expect(schema['@type']).toBe('Person');
    expect(schema['name']).toBe('张老师');
    expect(schema['jobTitle']).toBe('高级教师');
    expect(schema['image']).toBe('https://example.com/avatar.jpg');
    expect(schema['url']).toBe('https://example.com/teachers/zhang-laoshi');
    expect(schema['worksFor']).toEqual({
      '@type': 'EducationalOrganization',
      name: '佑森小课堂',
    });
    expect(schema['knowsAbout']).toEqual(['市级优秀教师', '教学比赛一等奖']);
  });

  it('omits jobTitle/image/knowsAbout when not provided', () => {
    const teacher = { name: 'Test', slug: 'test' } as any;
    const schema = buildPersonSchema(teacher, 'zh-CN');
    expect(schema['jobTitle']).toBeUndefined();
    expect(schema['image']).toBeUndefined();
    expect(schema['knowsAbout']).toBeUndefined();
  });

  it('omits knowsAbout when achievements is empty array', () => {
    const teacher = { name: 'Test', slug: 'test', achievements: [] } as any;
    const schema = buildPersonSchema(teacher, 'zh-CN');
    expect(schema['knowsAbout']).toBeUndefined();
  });
});

describe('buildCourseSchema', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
  });
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it('returns Course schema with provider and offers', () => {
    const product = {
      name: '拼音全能班',
      slug: 'pinyin',
      description: '系统学习汉语拼音',
      objectives: [{ id: 1, title: '掌握声母' }],
      teachingMethod: '小班教学',
      price: 2980,
    } as any;
    const settings = { name: '佑森小课堂' } as any;
    const schema = buildCourseSchema(product, settings, 'zh-CN');
    expect(schema['@type']).toBe('Course');
    expect(schema['name']).toBe('拼音全能班');
    expect(schema['description']).toContain('系统学习汉语拼音');
    expect(schema['provider']).toEqual({
      '@type': 'EducationalOrganization',
      name: '佑森小课堂',
    });
    expect(schema['offers']).toEqual({
      '@type': 'Offer',
      price: 2980,
      priceCurrency: 'CNY',
    });
  });

  it('omits offers when price is missing', () => {
    const product = { name: 'Test', slug: 'test', description: 'desc' } as any;
    const settings = { name: 'Test' } as any;
    const schema = buildCourseSchema(product, settings, 'zh-CN');
    expect(schema['offers']).toBeUndefined();
  });

  it('falls back to shortDescription when description missing', () => {
    const product = {
      name: 'Test',
      slug: 'test',
      shortDescription: 'short desc',
    } as any;
    const settings = { name: 'Test' } as any;
    const schema = buildCourseSchema(product, settings, 'zh-CN');
    expect(schema['description']).toContain('short desc');
  });
});

describe('buildNewsArticleSchema', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
    process.env.NEXT_PUBLIC_STRAPI_API_URL = 'https://example.com';
  });
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_STRAPI_API_URL;
  });

  it('returns NewsArticle schema with author and publisher', () => {
    const news = {
      title: '佑森小课堂开学通知',
      slug: 'opening-notice',
      excerpt: '2026年春季班开始报名',
      content: '<p>详细内容</p>',
      publishedAt: '2026-01-15T10:00:00Z',
      coverImage: { url: '/cover.jpg' },
    } as any;
    const settings = { name: '佑森小课堂' } as any;
    const schema = buildNewsArticleSchema(news, settings, 'zh-CN');
    expect(schema['@type']).toBe('NewsArticle');
    expect(schema['headline']).toBe('佑森小课堂开学通知');
    expect(schema['datePublished']).toBe('2026-01-15T10:00:00Z');
    expect(schema['dateModified']).toBe('2026-01-15T10:00:00Z');
    expect(schema['author']).toEqual({
      '@type': 'Organization',
      name: '佑森小课堂',
    });
    expect(schema['publisher']).toEqual({
      '@type': 'Organization',
      name: '佑森小课堂',
    });
    expect(schema['image']).toBe('https://example.com/cover.jpg');
  });

  it('uses excerpt as description when available', () => {
    const news = {
      title: 'Test',
      slug: 'test',
      excerpt: 'excerpt text',
      publishedAt: '2026-01-15T10:00:00Z',
    } as any;
    const settings = { name: 'Test' } as any;
    const schema = buildNewsArticleSchema(news, settings, 'zh-CN');
    expect(schema['description']).toBe('excerpt text');
  });

  it('omits image when coverImage missing', () => {
    const news = {
      title: 'Test',
      slug: 'test',
      publishedAt: '2026-01-15T10:00:00Z',
    } as any;
    const settings = { name: 'Test' } as any;
    const schema = buildNewsArticleSchema(news, settings, 'zh-CN');
    expect(schema['image']).toBeUndefined();
  });
});
