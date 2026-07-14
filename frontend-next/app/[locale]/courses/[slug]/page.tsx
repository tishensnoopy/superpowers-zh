import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getProducts, getProductBySlug, type Locale } from '@/lib/api';
import { buildMetadata, buildJsonLd } from '@/lib/seo';
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
  if (!product) {
    return buildMetadata(undefined, { title: '课程详情', canonicalUrl: `/courses/${slug}` }, { locale: locale as 'zh-CN' | 'en-US', path: `/courses/${slug}` });
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

  const courseJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: product.name,
    description: product.description || product.shortDescription || '',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(courseJsonLd) }}
      />
      <CourseHeader product={product} />
      <CourseSpecs product={product} />

      {product.description && (
        <section className="py-16 bg-background">
          <div className="max-w-[1400px] mx-auto px-8">
            <h2
              className="text-[#1C2B3A] mb-6"
              style={{
                fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                fontSize: '1.75rem',
                fontWeight: 700,
              }}
            >
              课程介绍
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
              className="text-[#1C2B3A] mb-6"
              style={{
                fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                fontSize: '1.75rem',
                fontWeight: 700,
              }}
            >
              教学方法
            </h2>
            <div className="prose prose-lg max-w-none text-muted-foreground leading-relaxed">
              {product.teachingMethod}
            </div>
          </div>
        </section>
      )}

      <CourseTestimonials testimonials={product.testimonials} />
      <CourseCTA courseName={product.name} />
    </>
  );
}
