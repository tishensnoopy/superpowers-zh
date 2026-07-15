import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { getPageBySlug, type Locale } from '@/lib/api';
import { buildMetadata, buildJsonLd, buildBreadcrumbSchema } from '@/lib/seo';
import SectionRenderer from '@/components/SectionRenderer';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { data: page } = await getPageBySlug('refund-policy', locale as Locale).catch(() => ({
    data: null,
  }));
  const tPolicies = await getTranslations('policies');
  if (!page) {
    return buildMetadata(undefined, { title: tPolicies('refundPolicy') }, { locale: locale as 'zh-CN' | 'en-US', path: '/refund-policy' });
  }
  return buildMetadata(page.seo, { title: page.title }, { locale: locale as 'zh-CN' | 'en-US', path: '/refund-policy' });
}

export default async function RefundPolicyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { data: page } = await getPageBySlug('refund-policy', locale as Locale).catch(() => ({
    data: null,
  }));

  if (!page) {
    notFound();
  }

  const sections = page.sections || [];

  const tSeo = useTranslations('seo');
  const tPolicies = useTranslations('policies');
  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: tSeo('home'), url: '/' },
      { name: tPolicies('refundPolicy'), url: '/refund-policy' },
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
