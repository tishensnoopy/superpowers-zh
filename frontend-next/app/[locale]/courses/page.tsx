import CourseSearchPanel from '@/components/course/CourseSearchPanel';
import { setRequestLocale } from 'next-intl/server';
import { buildMetadata } from '@/lib/seo';
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
  return <CourseSearchPanel />;
}
