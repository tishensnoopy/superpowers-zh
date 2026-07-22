import { Link } from '@/i18n/navigation';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getTeachers, getTeacherBySlug, getTeacherPrimaryCampus, type Locale } from '@/lib/api';
import { buildMetadata, buildJsonLd, buildPersonSchema, buildBreadcrumbSchema } from '@/lib/seo';
import StrapiImage from '@/components/ui/StrapiImage';
import type { Metadata } from 'next';

export const revalidate = 300;
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  const { data: teachers } = await getTeachers().catch(() => ({ data: [] }));
  return teachers.flatMap((teacher) => [
    { locale: 'zh-CN', slug: teacher.slug },
    { locale: 'en-US', slug: teacher.slug },
  ]);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const teacher = await getTeacherBySlug(slug, locale as Locale).catch(() => null);
  const tSeo = await getTranslations('seo');
  if (!teacher) {
    return buildMetadata(undefined, {
      title: tSeo('teacherDetail'),
      canonicalUrl: `/teachers/${slug}`,
    }, { locale: locale as 'zh-CN' | 'en-US', path: `/teachers/${slug}` });
  }
  return buildMetadata(undefined, {
    title: `${teacher.name} - ${teacher.title}`,
    description: teacher.teachingFeatures || `${teacher.name}，${teacher.title}`,
    canonicalUrl: `/teachers/${slug}`,
  }, { locale: locale as 'zh-CN' | 'en-US', path: `/teachers/${slug}` });
}

const SUBJECT_LABELS: Record<string, string> = {
  pinyin: 'pinyin',
  math: 'math',
  english: 'english',
  comprehensive: 'comprehensive',
};

export default async function TeacherDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const teacher = await getTeacherBySlug(slug, locale as Locale).catch(() => null);

  if (!teacher) {
    notFound();
  }

  const achievementList = Array.isArray(teacher.achievements)
    ? teacher.achievements
    : [];

  const tSeo = await getTranslations('seo');
  const tTeachers = await getTranslations('teachers');

  const personSchema = buildPersonSchema(teacher, locale as Locale);
  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: tSeo('home'), url: '/' },
      { name: tSeo('teachers'), url: '/teachers' },
      { name: teacher.name, url: `/teachers/${teacher.slug}` },
    ],
    locale as Locale
  );

  return (
    <div className="pt-[120px] pb-24 min-h-screen" style={{ background: '#FAFAFA' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(personSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(breadcrumbSchema) }}
      />
      <div className="max-w-[1200px] mx-auto px-8">
        {/* 面包屑 */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link href="/" className="hover:text-[var(--brand-primary,#F5851F)] transition-colors">
            {tSeo('home')}
          </Link>
          <span>/</span>
          <Link href="/teachers" className="hover:text-[var(--brand-primary,#F5851F)] transition-colors">
            {tSeo('teachers')}
          </Link>
          <span>/</span>
          <span className="text-[var(--brand-dark,#1C2B3A)] font-medium">{teacher.name}</span>
        </nav>

        {/* Hero 区 */}
        <div
          className="bg-card rounded-2xl border border-border shadow-sm p-8 mb-8"
          style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
        >
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
            {/* 大头像 */}
            <div className="flex-shrink-0">
              <div className="relative w-48 h-48 rounded-full overflow-hidden bg-[#FFF3E5] flex items-center justify-center border-4 border-[var(--brand-primary,#F5851F)]/20">
                {teacher.avatar?.url ? (
                  <StrapiImage
                    src={teacher.avatar}
                    alt={teacher.name}
                    fill
                    sizes="192px"
                    className="object-cover"
                  />
                ) : (
                  <span className="text-6xl font-bold text-[var(--brand-primary,#F5851F)]">
                    {teacher.name.charAt(0)}
                  </span>
                )}
              </div>
            </div>

            {/* 基本信息 */}
            <div className="flex-1 text-center md:text-left">
              <h1
                className="text-3xl font-bold text-[var(--brand-dark,#1C2B3A)] mb-2"
                style={{ fontSize: '2rem', fontWeight: 800 }}
              >
                {teacher.name}
              </h1>
              {teacher.title && (
                <p className="text-lg text-muted-foreground mb-4">
                  {teacher.title}
                </p>
              )}
              <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
                {teacher.subject && (
                  <span
                    className="inline-block px-3 py-1 rounded-full text-xs font-medium text-white"
                    style={{ background: 'linear-gradient(135deg, var(--brand-primary,#F5851F), #FF6B35)' }}
                  >
                    {SUBJECT_LABELS[teacher.subject] ? tTeachers(SUBJECT_LABELS[teacher.subject]) : teacher.subject}
                  </span>
                )}
                {typeof teacher.teachingYears === 'number' && (
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-[#FFF3E5] text-[var(--brand-primary,#F5851F)]">
                    {teacher.teachingYears}{tTeachers('teachingYearsUnit')}
                  </span>
                )}
                {teacher.education && (
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                    {teacher.education}{tTeachers('educationDegree')}
                  </span>
                )}
              </div>

              {/* 所属校区 */}
              {(() => {
                const primaryCampus = getTeacherPrimaryCampus(teacher);
                return primaryCampus ? (
                  <div className="mb-4">
                    <Link
                      href={`/campuses/${primaryCampus.slug}`}
                      className="inline-flex items-center gap-1 text-sm text-[var(--brand-primary,#F5851F)] hover:underline"
                    >
                      📍 {primaryCampus.name}
                    </Link>
                  </div>
                ) : null;
              })()}

              {/* CTA */}
              <Link
                href="/contact"
                className="inline-block px-6 py-2.5 rounded-xl text-white font-medium text-sm transition-transform hover:scale-105"
                style={{ background: 'linear-gradient(135deg, var(--brand-primary,#F5851F), #FF6B35)' }}
              >
                {tTeachers('bookTrial')}
              </Link>
            </div>
          </div>
        </div>

        {/* 详情区 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 教育背景 */}
          {teacher.education && (
            <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
              <h2
                className="text-lg font-bold text-[var(--brand-dark,#1C2B3A)] mb-3"
                style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
              >
                {tTeachers('education')}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {teacher.education}
              </p>
            </div>
          )}

          {/* 教学特色 */}
          {teacher.teachingFeatures && (
            <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
              <h2
                className="text-lg font-bold text-[var(--brand-dark,#1C2B3A)] mb-3"
                style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
              >
                {tTeachers('teachingFeatures')}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {teacher.teachingFeatures}
              </p>
            </div>
          )}
        </div>

        {/* 荣誉成就 */}
        {achievementList.length > 0 && (
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6 mt-6">
            <h2
              className="text-lg font-bold text-[var(--brand-dark,#1C2B3A)] mb-4"
              style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
            >
              {tTeachers('achievements')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {achievementList.map((item, idx) => (
                <span
                  key={idx}
                  className="inline-block px-3 py-1 rounded-full text-xs font-medium text-white"
                  style={{ background: 'linear-gradient(135deg, var(--brand-primary,#F5851F), #FF6B35)' }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
