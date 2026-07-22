import { Clock, Users, Calendar, GraduationCap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Product } from '@/lib/api';
import { getImageUrl } from '@/lib/api';
import { useTranslations } from 'next-intl';

const specIconConfig: Record<string, LucideIcon> = {
  course_hours: Clock,
  class_size: Users,
  age_range: GraduationCap,
  duration: Calendar,
};

export default function CourseHeader({ product }: { product: Product }) {
  const t = useTranslations('courses');
  const { name, shortDescription, specValues, price, originalPrice, images, thumbnail } = product;

  const specConfig: Record<string, { label: string; icon: LucideIcon }> = {
    course_hours: { label: t('specCourseHours'), icon: specIconConfig.course_hours },
    class_size: { label: t('specClassSize'), icon: specIconConfig.class_size },
    age_range: { label: t('specAge'), icon: specIconConfig.age_range },
    duration: { label: t('specPeriod'), icon: specIconConfig.duration },
  };

  // 主图优先级：thumbnail > images[0]
  const primaryImage = getImageUrl(thumbnail) || (images && images.length > 0 ? getImageUrl(images[0]) : null);
  const galleryImages = (images || []).map(img => getImageUrl(img)).filter(Boolean) as string[];

  return (
    <section className="pt-[120px] pb-16 bg-gradient-to-b from-[#FFF3E5] to-background">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="grid grid-cols-12 gap-8 items-start">
          {/* 左侧：文字信息 */}
          <div className="col-span-12 lg:col-span-7">
            <h1
              className="text-[var(--brand-dark,#1C2B3A)] mb-4"
              style={{
                fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                fontSize: '2.5rem',
                fontWeight: 800,
              }}
            >
              {name}
            </h1>
            {shortDescription && (
              <p className="text-muted-foreground text-lg mb-8 max-w-[640px]">
                {shortDescription}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-6">
              {specValues && Object.keys(specValues).length > 0 && (
                <div className="flex flex-wrap gap-4">
                  {Object.entries(specValues).map(([key, value]) => {
                    const config = specConfig[key];
                    if (!config) return null;
                    const Icon = config.icon;
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border shadow-sm"
                      >
                        <Icon size={16} />
                        <span className="text-sm font-medium text-[var(--brand-dark,#1C2B3A)]">{value}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {price !== undefined && price > 0 && (
                <div className="flex items-baseline gap-2">
                  {originalPrice && originalPrice > price && (
                    <span className="text-sm text-muted-foreground line-through">¥{originalPrice}</span>
                  )}
                  <span className="text-2xl font-bold text-[var(--brand-primary,#F5851F)]">¥{price}</span>
                </div>
              )}
            </div>
          </div>
          {/* 右侧：主图 */}
          <div className="col-span-12 lg:col-span-5">
            {primaryImage && (
              <div className="rounded-2xl overflow-hidden shadow-xl border border-border">
                <img src={primaryImage} alt={name} className="w-full h-[360px] object-cover" />
              </div>
            )}
            {galleryImages.length > 1 && (
              <div className="grid grid-cols-4 gap-2 mt-3">
                {galleryImages.map((url, i) => (
                  <div key={i} className="rounded-lg overflow-hidden border border-border aspect-square">
                    <img src={url} alt={`${name} ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
