import CourseSearchPanel from '@/components/course/CourseSearchPanel';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { buildMetadata, buildJsonLd, buildBreadcrumbSchema } from '@/lib/seo';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('courses');
  return buildMetadata(undefined, {
    title: t('title'),
  }, { locale: locale as 'zh-CN' | 'en-US', path: '/courses' });
}

export default async function CoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tNav = await getTranslations('navigation');
  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: tNav('home'), url: '/' },
      { name: tNav('courses'), url: '/courses' },
    ],
    locale as 'zh-CN' | 'en-US'
  );
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(breadcrumbSchema) }}
      />
      <CourseSearchPanel />
    </>
  );
}
