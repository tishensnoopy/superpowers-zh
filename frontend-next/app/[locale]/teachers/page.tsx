import TeamPage from '@/components/team/TeamPage';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/lib/api';
import { buildJsonLd, buildBreadcrumbSchema } from '@/lib/seo';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('teachers');
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function TeachersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tSeo = await getTranslations('seo');
  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: tSeo('home'), url: '/' },
      { name: tSeo('teachers'), url: '/teachers' },
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
