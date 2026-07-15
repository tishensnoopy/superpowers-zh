import type { Metadata } from 'next';
import type { Seo as SeoData } from './api';
import { getImageUrl } from './api';
import type {
  SiteSettings,
  SocialLink,
  FaqItem,
  Locale,
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
