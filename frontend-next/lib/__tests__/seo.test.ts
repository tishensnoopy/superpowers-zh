import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildMetadata, buildWebSiteSchema, buildOrganizationSchema, buildBreadcrumbSchema, buildFaqPageSchema } from '../seo';

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
