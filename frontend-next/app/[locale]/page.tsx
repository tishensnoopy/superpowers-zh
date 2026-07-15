import { getHomepage, type Locale } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import { setRequestLocale } from 'next-intl/server';
import SectionRenderer from '@/components/SectionRenderer';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { data: page } = await getHomepage(locale as Locale).catch(() => ({ data: null as null }));
  if (!page) return buildMetadata(undefined, { title: '首页', description: '佑森小课堂专注于幼小衔接教育8年，提供全日制托班、课后托管、幼小衔接全能班等课程，六大校区遍布武汉三镇。' }, { locale: locale as 'zh-CN' | 'en-US', path: '/' });
  return buildMetadata(page.seo, {
    title: page.title,
    description: '佑森小课堂专注于幼小衔接教育8年，提供全日制托班、课后托管、幼小衔接全能班等课程，六大校区遍布武汉三镇。',
  }, { locale: locale as 'zh-CN' | 'en-US', path: '/' });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { data: page } = await getHomepage(locale as Locale).catch(() => ({ data: null as null }));
  if (!page) {
    return (
      <div className="pt-[120px] min-h-screen flex items-center justify-center">
        <p className="text-gray-500">暂无内容，请先在 Strapi 后台配置首页数据。</p>
      </div>
    );
  }
  const sections = page.sections || [];

  return (
    <>
      {sections.map((section, index) => (
        <SectionRenderer
          key={`${section.__component}-${section.id}-${index}`}
          section={section}
        />
      ))}
    </>
  );
}
