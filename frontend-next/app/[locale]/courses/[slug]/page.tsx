import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getProducts, getProductBySlug, getSiteSettings, type Locale } from '@/lib/api';
import { buildMetadata, buildJsonLd, buildCourseSchema, buildBreadcrumbSchema } from '@/lib/seo';
import CourseHeader from '@/components/course/CourseHeader';
import CourseSpecs from '@/components/course/CourseSpecs';
import CourseObjectives from '@/components/course/CourseObjectives';
import CourseOutline from '@/components/course/CourseOutline';
import CourseTestimonials from '@/components/course/CourseTestimonials';
import CourseCTA from '@/components/course/CourseCTA';
import type { Metadata } from 'next';

export const revalidate = 300;
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  const { data: products } = await getProducts().catch(() => ({ data: [] }));
  return products.flatMap((product) => [
    { locale: 'zh-CN', slug: product.slug },
    { locale: 'en-US', slug: product.slug },
  ]);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const { data: product } = await getProductBySlug(slug, locale as Locale).catch(() => ({
    data: null,
  }));
  const tSeo = await getTranslations('seo');
  if (!product) {
    return buildMetadata(undefined, { title: tSeo('courseDetail'), canonicalUrl: `/courses/${slug}` }, { locale: locale as 'zh-CN' | 'en-US', path: `/courses/${slug}` });
  }
  return buildMetadata(product.seo, {
    title: product.name,
    description: product.shortDescription || product.description,
    canonicalUrl: `/courses/${slug}`,
  }, { locale: locale as 'zh-CN' | 'en-US', path: `/courses/${slug}` });
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const { data: product } = await getProductBySlug(slug, locale as Locale).catch(() => ({
    data: null,
  }));

  if (!product) {
    notFound();
  }

  const tSeo = await getTranslations('seo');
  const tNav = await getTranslations('navigation');
  const tCourses = await getTranslations('courses');

  const { data: settingsData } = await getSiteSettings(locale as Locale).catch(() => ({ data: [] as never[] }));
  const settings = Array.isArray(settingsData) ? settingsData[0] : settingsData;

  const courseSchema = buildCourseSchema(product, settings || { name: tSeo('siteNameZh') }, locale as Locale);
  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: tNav('home'), url: '/' },
      { name: tNav('courses'), url: '/courses' },
      { name: product.name, url: `/courses/${product.slug}` },
    ],
    locale as Locale
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(courseSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(breadcrumbSchema) }}
      />
      <CourseHeader product={product} />
      <CourseSpecs product={product} />

      {product.description && (
        <section className="py-16 bg-background">
          <div className="max-w-[1400px] mx-auto px-8">
            <h2
              className="text-[var(--brand-dark,#1C2B3A)] mb-6"
              style={{
                fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                fontSize: '1.75rem',
                fontWeight: 700,
              }}
            >
              {tCourses('courseIntro')}
            </h2>
            <div className="prose prose-lg max-w-none text-muted-foreground leading-relaxed">
              {product.description}
            </div>
          </div>
        </section>
      )}

      <CourseObjectives objectives={product.objectives} />
      <CourseOutline outline={product.outline} />

      {product.teachingMethod && (
        <section className="py-16 bg-muted/30">
          <div className="max-w-[1400px] mx-auto px-8">
            <h2
              className="text-[var(--brand-dark,#1C2B3A)] mb-6"
              style={{
                fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                fontSize: '1.75rem',
                fontWeight: 700,
              }}
            >
              {tCourses('teachingMethod')}
            </h2>
            <div
              className="prose prose-lg max-w-none text-muted-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ __html: product.teachingMethod }}
            />
          </div>
        </section>
      )}

      <CourseTestimonials testimonials={product.testimonials} />
      <CourseCTA courseName={product.name} />
    </>
  );
}
