import TeamPage from '@/components/team/TeamPage';
import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/lib/api';
import { buildJsonLd, buildBreadcrumbSchema } from '@/lib/seo';
import type { Metadata } from 'next';

export const revalidate = 300;

export const metadata: Metadata = {
  title: '师资团队',
  description:
    '认识我们的资深教师团队，所有教师均持有教师资格证，拥有丰富的幼小衔接教学经验。',
};

export default async function TeachersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: locale === 'en-US' ? 'Home' : '首页', url: '/' },
      { name: locale === 'en-US' ? 'Teachers' : '师资团队', url: '/teachers' },
    ],
    locale as Locale
  );
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(breadcrumbSchema) }}
      />
      <TeamPage locale={locale as Locale} />
    </>
  );
}
