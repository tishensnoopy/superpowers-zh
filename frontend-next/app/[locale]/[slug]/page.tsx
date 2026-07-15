import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getPages, getPageBySlug, type Locale } from '@/lib/api';
import { buildMetadata, buildJsonLd, buildBreadcrumbSchema } from '@/lib/seo';
import SectionRenderer from '@/components/SectionRenderer';
import type { Metadata } from 'next';

export const revalidate = 300;
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  const { data: pages } = await getPages().catch(() => ({ data: [] }));
  const staticSlugs = ['refund-policy', 'privacy-policy', 'user-agreement', 'contact'];
  return pages
    .filter((page) => !page.isHomepage && !staticSlugs.includes(page.slug))
    .flatMap((page) => [
      { locale: 'zh-CN', slug: page.slug },
      { locale: 'en-US', slug: page.slug },
    ]);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const { data: page } = await getPageBySlug(slug, locale as Locale).catch(() => ({
    data: null,
  }));
  if (!page) {
    return buildMetadata(undefined, { title: '页面', canonicalUrl: `/${slug}` }, { locale: locale as 'zh-CN' | 'en-US', path: `/${slug}` });
  }
  return buildMetadata(page.seo, { title: page.title, canonicalUrl: `/${slug}` }, { locale: locale as 'zh-CN' | 'en-US', path: `/${slug}` });
}

export default async function DynamicPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const { data: page } = await getPageBySlug(slug, locale as Locale).catch(() => ({
    data: null,
  }));

  if (!page) {
    notFound();
  }

  const sections = page.sections || [];

  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: locale === 'en-US' ? 'Home' : '首页', url: '/' },
      { name: page.title, url: `/${page.slug}` },
    ],
    locale as Locale
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(breadcrumbSchema) }}
      />
      {sections.map((section, index) => (
        <SectionRenderer
          key={`${section.__component}-${section.id}-${index}`}
          section={section}
        />
      ))}
    </>
  );
}
