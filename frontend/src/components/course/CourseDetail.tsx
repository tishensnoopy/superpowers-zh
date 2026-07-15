import { useEffect, useState } from 'react';
import { getProductBySlug, type Product } from '../../lib/api';
import Seo from '../Seo';
import CourseHeader from './CourseHeader';
import CourseObjectives from './CourseObjectives';
import CourseOutline from './CourseOutline';
import CourseTestimonials from './CourseTestimonials';
import CourseCTA from './CourseCTA';

export default function CourseDetail({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getProductBySlug(slug)
      .then((res) => {
        if (!cancelled) {
          setProduct(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[CourseDetail] 加载失败:', err);
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="py-32 text-center text-muted-foreground">加载中...</div>
    );
  }

  if (error || !product) {
    return (
      <div className="py-32 text-center">
        <h1 className="text-2xl font-bold text-[#1C2B3A] mb-4">课程不存在</h1>
        <p className="text-muted-foreground">您访问的课程可能已下架或链接有误。</p>
      </div>
    );
  }

  const courseStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: product.name,
    description: product.description || product.shortDescription || '',
  };

  return (
    <>
      <Seo
        seo={product.seo}
        title={product.name}
        description={product.shortDescription || product.description}
        type="product"
        structuredData={courseStructuredData}
      />
      <CourseHeader product={product} />

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
