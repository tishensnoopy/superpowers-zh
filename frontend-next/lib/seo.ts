import type { Metadata } from 'next';
import type { Seo as SeoData } from './api';
import { getImageUrl } from './api';

export function buildMetadata(
  seo: SeoData | undefined,
  fallback: { title: string; description?: string }
): Metadata {
  const title = seo?.metaTitle ?? fallback.title;
  const description = seo?.metaDescription ?? fallback.description;
  const ogImage = getImageUrl(seo?.ogImage);

  return {
    title,
    description,
    keywords: seo?.metaKeywords,
    alternates: {
      canonical: seo?.canonicalUrl,
    },
    openGraph: {
      title: seo?.ogTitle ?? title,
      description: seo?.ogDescription ?? description,
      images: ogImage ? [{ url: ogImage }] : undefined,
      type: (seo?.ogType as any) ?? 'website',
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
