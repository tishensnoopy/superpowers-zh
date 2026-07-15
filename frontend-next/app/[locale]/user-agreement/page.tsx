import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getPageBySlug, type Locale } from '@/lib/api';
import { buildMetadata, buildJsonLd, buildBreadcrumbSchema } from '@/lib/seo';
import SectionRenderer from '@/components/SectionRenderer';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { data: page } = await getPageBySlug('user-agreement', locale as Locale).catch(() => ({
    data: null,
  }));
  if (!page) {
    return buildMetadata(undefined, { title: '用户协议' }, { locale: locale as 'zh-CN' | 'en-US', path: '/user-agreement' });
  }
  return buildMetadata(page.seo, { title: page.title }, { locale: locale as 'zh-CN' | 'en-US', path: '/user-agreement' });
}

export default async function UserAgreementPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { data: page } = await getPageBySlug('user-agreement', locale as Locale).catch(() => ({
    data: null,
  }));

  if (!page) {
    notFound();
  }

  const sections = page.sections || [];

  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: locale === 'en-US' ? 'Home' : '首页', url: '/' },
      { name: locale === 'en-US' ? 'User Agreement' : '用户协议', url: '/user-agreement' },
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
