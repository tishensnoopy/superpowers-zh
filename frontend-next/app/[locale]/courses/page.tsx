import CourseSearchPanel from '@/components/course/CourseSearchPanel';
import { setRequestLocale } from 'next-intl/server';
import { buildMetadata, buildJsonLd, buildBreadcrumbSchema } from '@/lib/seo';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata(undefined, {
    title: '课程体系',
  }, { locale: locale as 'zh-CN' | 'en-US', path: '/courses' });
}

export default async function CoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: locale === 'en-US' ? 'Home' : '首页', url: '/' },
      { name: locale === 'en-US' ? 'Courses' : '课程', url: '/courses' },
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
