import CourseSearchPanel from '@/components/course/CourseSearchPanel';
import { setRequestLocale } from 'next-intl/server';

export default async function CoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CourseSearchPanel />;
}
