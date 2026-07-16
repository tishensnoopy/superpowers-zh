import { getCampuses, type Locale } from '@/lib/api';
import { buildMetadata, buildJsonLd, buildBreadcrumbSchema } from '@/lib/seo';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import CampusHeader from '@/components/campus/CampusHeader';
import CampusGrid from '@/components/campus/CampusGrid';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('campuses');
  return buildMetadata(undefined, {
    title: t('pageTitle'),
    description: t('pageDescription'),
    canonicalUrl: '/campuses',
  }, { locale: locale as 'zh-CN' | 'en-US', path: '/campuses' });
}

export default async function CampusOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tSeo = await getTranslations('seo');
  const { data: campuses } = await getCampuses(locale as Locale).catch(() => ({ data: [] as never[] }));

  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: tSeo('home'), url: '/' },
      { name: tSeo('campuses'), url: '/campuses' },
    ],
    locale as Locale
  );

  return (
    <div
      className="pt-[120px] pb-16 min-h-screen"
      style={{ background: 'linear-gradient(to bottom, #FFF3E5, #ffffff)' }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(breadcrumbSchema) }}
      />
      <div className="max-w-[1400px] mx-auto px-8">
        <CampusHeader />
        <CampusGrid campuses={campuses} />
      </div>
    </div>
  );
}
