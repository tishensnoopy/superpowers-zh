import type { Metadata } from 'next';
import type { Seo as SeoData } from './api';
import { getImageUrl } from './api';
import type {
  SiteSettings,
  SocialLink,
  FaqItem,
  Locale,
  Campus,
  Teacher,
  Product,
  NewsArticle,
} from './api';

// Next.js Metadata API 仅接受以下 OpenGraph 类型
// 详见 https://nextjs.org/docs/app/api-reference/functions/generate-metadata#opengraph
const VALID_OG_TYPES = [
  'website',
  'article',
  'book',
  'profile',
  'music.song',
  'music.album',
  'music.playlist',
  'music.radio_station',
  'video.movie',
  'video.episode',
  'video.tv_show',
  'video.other',
] as const;

function resolveOgType(ogType: string | undefined): (typeof VALID_OG_TYPES)[number] {
  if (ogType && (VALID_OG_TYPES as readonly string[]).includes(ogType)) {
    return ogType as (typeof VALID_OG_TYPES)[number];
  }
  return 'website';
}

export function buildMetadata(
  seo: SeoData | undefined,
  fallback: { title: string; description?: string; canonicalUrl?: string },
  i18n?: { locale: 'zh-CN' | 'en-US'; path: string }
): Metadata {
  const title = seo?.metaTitle ?? fallback.title;
  const description = seo?.metaDescription ?? fallback.description;
  const ogImage = getImageUrl(seo?.ogImage);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const languages = i18n
    ? {
        'zh-CN': `${baseUrl}${i18n.path}`,
        'en-US': `${baseUrl}/en-US${i18n.path}`,
      }
    : undefined;

  return {
    title,
    description,
    keywords: seo?.metaKeywords,
    alternates: {
      canonical: seo?.canonicalUrl || fallback.canonicalUrl,
      languages,
    },
    openGraph: {
      title: seo?.ogTitle ?? title,
      description: seo?.ogDescription ?? description,
      images: ogImage ? [{ url: ogImage }] : undefined,
      type: resolveOgType(seo?.ogType),
    },
    twitter: {
      card: 'summary_large_image',
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export function buildJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * 构建 WebSite schema（全站根网站实体）
 */
export function buildWebSiteSchema(
  settings: Pick<SiteSettings, 'name'>,
  locale: Locale
): Record<string, unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const url = locale === 'en-US' ? `${baseUrl}/en-US` : baseUrl;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: settings.name,
    url,
  };
}

/**
 * 构建 Organization schema（教育机构实体）
 * sameAs 仅包含以 http 开头的社交链接 URL（过滤微信号等非 URL 值）
 */
export function buildOrganizationSchema(
  settings: Pick<SiteSettings, 'name' | 'phone' | 'email' | 'address' | 'logo'>,
  socialLinks: SocialLink[],
  locale: Locale
): Record<string, unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const url = locale === 'en-US' ? `${baseUrl}/en-US` : baseUrl;
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: settings.name,
    url,
  };

  if (settings.phone) schema.telephone = settings.phone;
  if (settings.email) schema.email = settings.email;
  if (settings.address) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: settings.address,
    };
  }
  if (settings.logo?.url) {
    schema.logo = getImageUrl(settings.logo);
  }

  const sameAs = socialLinks
    .map((s) => s.url)
    .filter((url) => url && url.startsWith('http'));
  if (sameAs.length > 0) {
    schema.sameAs = sameAs;
  }

  return schema;
}

/**
 * 构建 BreadcrumbList schema（面包屑导航）
 * 调用方传入的 url 为相对路径（如 '/courses'），生成器根据 locale 自动加 /en-US 前缀并拼接 baseUrl
 */
export function buildBreadcrumbSchema(
  items: { name: string; url: string }[],
  locale: Locale
): Record<string, unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const prefix = locale === 'en-US' ? '/en-US' : '';
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${prefix}${item.url}`,
    })),
  };
}

/**
 * 构建 FAQPage schema（常见问题页）
 */
export function buildFaqPageSchema(
  faqItems: FaqItem[]
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  };
}

/**
 * 构建 LocalBusiness schema（校区本地商业实体）
 * 使用双类型 ['LocalBusiness', 'EducationalOrganization'] 兼顾本地 SEO 和教育权威
 */
export function buildLocalBusinessSchema(
  campus: Pick<Campus, 'name' | 'slug' | 'address' | 'phone' | 'businessHours' | 'coverImage'>,
  locale: Locale
): Record<string, unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const prefix = locale === 'en-US' ? '/en-US' : '';
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'EducationalOrganization'],
    name: campus.name,
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

/**
 * 构建 Person schema（教师实体）
 */
export function buildPersonSchema(
  teacher: Pick<Teacher, 'name' | 'title' | 'slug' | 'avatar' | 'achievements'>,
  locale: Locale
): Record<string, unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const prefix = locale === 'en-US' ? '/en-US' : '';
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: teacher.name,
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

/**
 * 构建 Course schema（课程实体，增强版）
 * provider 为 EducationalOrganization，offers 含 price + priceCurrency
 */
export function buildCourseSchema(
  product: Pick<Product, 'name' | 'slug' | 'description' | 'shortDescription' | 'price'>,
  settings: Pick<SiteSettings, 'name'>,
  locale: Locale
): Record<string, unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const prefix = locale === 'en-US' ? '/en-US' : '';
  const description = product.description || product.shortDescription || '';
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

/**
 * 构建 NewsArticle schema（新闻文章实体，增强版）
 * author 和 publisher 均为 Organization 类型
 */
export function buildNewsArticleSchema(
  news: Pick<NewsArticle, 'title' | 'slug' | 'excerpt' | 'publishedAt' | 'coverImage'>,
  settings: Pick<SiteSettings, 'name'>,
  locale: Locale
): Record<string, unknown> {
  void locale; // 保持与其他生成器 API 一致；NewsArticle schema 不含 url 字段
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: news.title,
    datePublished: news.publishedAt,
    dateModified: news.publishedAt,
    author: {
      '@type': 'Organization',
      name: settings.name,
    },
    publisher: {
      '@type': 'Organization',
      name: settings.name,
    },
  };

  if (news.excerpt) schema.description = news.excerpt;
  if (news.coverImage?.url) {
    schema.image = getImageUrl(news.coverImage);
  }

  return schema;
}
