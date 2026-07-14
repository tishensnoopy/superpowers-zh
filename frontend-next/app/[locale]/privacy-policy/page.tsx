import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getPageBySlug, type Locale } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import SectionRenderer from '@/components/SectionRenderer';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { data: page } = await getPageBySlug('privacy-policy', locale as Locale).catch(() => ({
    data: null,
  }));
  if (!page) {
    return buildMetadata(undefined, { title: '隐私政策' }, { locale: locale as 'zh-CN' | 'en-US', path: '/privacy-policy' });
  }
  return buildMetadata(page.seo, { title: page.title }, { locale: locale as 'zh-CN' | 'en-US', path: '/privacy-policy' });
}

export default async function PrivacyPolicyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { data: page } = await getPageBySlug('privacy-policy', locale as Locale).catch(() => ({
    data: null,
  }));

  if (!page) {
    notFound();
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
