import { getHomepage, getSiteSettings } from '@/lib/api';
import { buildMetadata, buildJsonLd } from '@/lib/seo';
import { setRequestLocale } from 'next-intl/server';
import SectionRenderer from '@/components/SectionRenderer';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const { data: page } = await getHomepage().catch(() => ({ data: null as null }));
  if (!page) return buildMetadata(undefined, { title: '首页', description: '佑森小课堂专注于幼小衔接教育8年，提供全日制托班、课后托管、幼小衔接全能班等课程，六大校区遍布武汉三镇。' });
  return buildMetadata(page.seo, {
    title: page.title,
    description: '佑森小课堂专注于幼小衔接教育8年，提供全日制托班、课后托管、幼小衔接全能班等课程，六大校区遍布武汉三镇。',
  });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [homepageRes, settingsRes] = await Promise.all([
    getHomepage().catch(() => ({ data: null as null })),
    getSiteSettings().catch(() => ({ data: null as null })),
  ]);
  const page = homepageRes.data;
  if (!page) {
    return (
      <div className="pt-[120px] min-h-screen flex items-center justify-center">
        <p className="text-gray-500">暂无内容，请先在 Strapi 后台配置首页数据。</p>
      </div>
    );
  }
  const sections = page.sections || [];

  const settings = Array.isArray(settingsRes.data)
    ? settingsRes.data[0]
    : settingsRes.data;
  const siteName = settings?.name || '佑森小课堂';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  // 首页注入 WebSite 类型 JSON-LD，有助于搜索引擎识别站点实体。
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: siteUrl,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(websiteJsonLd) }}
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
