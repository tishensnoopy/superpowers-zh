import { getCampuses, type Locale } from '@/lib/api';
import { buildMetadata, buildJsonLd, buildBreadcrumbSchema } from '@/lib/seo';
import { setRequestLocale } from 'next-intl/server';
import CampusHeader from '@/components/campus/CampusHeader';
import CampusGrid from '@/components/campus/CampusGrid';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata(undefined, {
    title: '校区分布',
    description: '查看我们的各校区地址和联系方式，欢迎就近选择。',
    canonicalUrl: '/campuses',
  }, { locale: locale as 'zh-CN' | 'en-US', path: '/campuses' });
}

export default async function CampusOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { data: campuses } = await getCampuses(locale as Locale).catch(() => ({ data: [] as never[] }));

  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: locale === 'en-US' ? 'Home' : '首页', url: '/' },
      { name: locale === 'en-US' ? 'Campuses' : '校区分布', url: '/campuses' },
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
