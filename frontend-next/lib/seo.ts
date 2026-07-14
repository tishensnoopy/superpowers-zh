import type { Metadata } from 'next';
import type { Seo as SeoData } from './api';
import { getImageUrl } from './api';

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
