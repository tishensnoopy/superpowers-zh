import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getCampuses, getCampusBySlug, type Locale } from '@/lib/api';
import { buildMetadata, buildJsonLd, buildLocalBusinessSchema, buildBreadcrumbSchema } from '@/lib/seo';
import CampusDetailHeader from '@/components/campus/CampusDetailHeader';
import CampusGallery from '@/components/campus/CampusGallery';
import CampusInfoCard from '@/components/campus/CampusInfoCard';
import CampusTeachers from '@/components/campus/CampusTeachers';
import CampusMap from '@/components/campus/CampusMap';
import type { Metadata } from 'next';

export const revalidate = 300;
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  const { data: campuses } = await getCampuses().catch(() => ({ data: [] }));
  return campuses.flatMap((campus) => [
    { locale: 'zh-CN', slug: campus.slug },
    { locale: 'en-US', slug: campus.slug },
  ]);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const { data } = await getCampusBySlug(slug, locale as Locale).catch(() => ({ data: [] }));
  const campus = Array.isArray(data) ? data[0] : data;
  if (!campus) {
    return buildMetadata(undefined, { title: '校区详情', canonicalUrl: `/campuses/${slug}` }, { locale: locale as 'zh-CN' | 'en-US', path: `/campuses/${slug}` });
  }
  return buildMetadata(campus.seo, {
    title: campus.name,
    description: campus.address,
    canonicalUrl: `/campuses/${slug}`,
  }, { locale: locale as 'zh-CN' | 'en-US', path: `/campuses/${slug}` });
}

export default async function CampusDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const { data } = await getCampusBySlug(slug, locale as Locale).catch(() => ({ data: [] }));
  const campus = Array.isArray(data) ? data[0] : data;

  if (!campus) {
    notFound();
  }

  const localBusinessSchema = buildLocalBusinessSchema(campus, locale as Locale);
  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: locale === 'en-US' ? 'Home' : '首页', url: '/' },
      { name: locale === 'en-US' ? 'Campuses' : '校区分布', url: '/campuses' },
      { name: campus.name, url: `/campuses/${campus.slug}` },
    ],
    locale as Locale
  );

  return (
    <div className="pt-[120px] pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(localBusinessSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(breadcrumbSchema) }}
      />
      <div className="max-w-[1400px] mx-auto px-8">
        <CampusDetailHeader campus={campus} />

        {/* 两列布局：图集 + 信息卡片 */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          <div className="lg:col-span-2">
            <CampusGallery campus={campus} />
          </div>
          <div className="lg:col-span-1">
            <CampusInfoCard campus={campus} />
          </div>
        </section>

        <CampusTeachers teachers={campus.teachers} />

        <div className="mt-12">
          <CampusMap mapEmbed={campus.mapEmbed} />
        </div>
      </div>
    </div>
  );
}
