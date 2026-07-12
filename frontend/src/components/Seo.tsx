import { Helmet } from 'react-helmet-async';
import type { Seo as SeoData } from '../lib/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337';
const DEFAULT_SITE_NAME = '幼小衔接教育';

export interface SeoProps {
  seo?: SeoData;
  title?: string;
  description?: string;
  image?: string;
  type?: string;
  structuredData?: Record<string, unknown>;
  siteName?: string;
}

function resolveImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default function Seo({
  seo,
  title,
  description,
  image,
  type,
  structuredData,
  siteName = DEFAULT_SITE_NAME,
}: SeoProps) {
  const resolvedTitle = seo?.metaTitle ?? title;
  const resolvedDescription = seo?.metaDescription ?? description;
  const resolvedKeywords = seo?.metaKeywords;
  const resolvedCanonical = seo?.canonicalUrl;

  const ogTitle = seo?.ogTitle ?? resolvedTitle;
  const ogDescription = seo?.ogDescription ?? resolvedDescription;
  const ogImage = resolveImageUrl(seo?.ogImage?.data?.attributes?.url) ?? image;
  const ogType = type ?? seo?.ogType ?? 'website';

  const fullTitle = resolvedTitle ? `${resolvedTitle} | ${siteName}` : siteName;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {resolvedDescription && (
        <meta name="description" content={resolvedDescription} />
      )}
      {resolvedKeywords && (
        <meta name="keywords" content={resolvedKeywords} />
      )}
      {resolvedCanonical && (
        <link rel="canonical" href={resolvedCanonical} />
      )}
      {ogTitle && <meta property="og:title" content={ogTitle} />}
      {ogDescription && (
        <meta property="og:description" content={ogDescription} />
      )}
      <meta property="og:type" content={ogType} />
      {ogImage && <meta property="og:image" content={ogImage} />}
      <meta name="twitter:card" content="summary_large_image" />
      {ogTitle && <meta name="twitter:title" content={ogTitle} />}
      {ogDescription && (
        <meta name="twitter:description" content={ogDescription} />
      )}
      {ogImage && <meta name="twitter:image" content={ogImage} />}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
}
