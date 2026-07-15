import { Clock, Users, Calendar, GraduationCap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Product } from '@/lib/api';
import { useTranslations } from 'next-intl';

const specIconConfig: Record<string, LucideIcon> = {
  course_hours: Clock,
  class_size: Users,
  age_range: GraduationCap,
  duration: Calendar,
};

function formatPrice(value: number): string {
  return `¥${value.toLocaleString('zh-CN')}`;
}

export default function CourseSpecs({ product }: { product: Product }) {
  const t = useTranslations('courses');
  const { specValues, price, originalPrice } = product;

  const specConfig: Record<string, { label: string; icon: LucideIcon }> = {
    course_hours: { label: t('specCourseHours'), icon: specIconConfig.course_hours },
    class_size: { label: t('specClassSize'), icon: specIconConfig.class_size },
    age_range: { label: t('specAge'), icon: specIconConfig.age_range },
    duration: { label: t('specPeriod'), icon: specIconConfig.duration },
  };

  const hasSpecs = specValues && Object.keys(specValues).length > 0;
  const hasPrice = price !== undefined && price > 0;
  const hasDiscount = originalPrice !== undefined && originalPrice > (price || 0);

  if (!hasSpecs && !hasPrice) return null;

  return (
    <section className="py-12 bg-muted/30 border-y border-border">
      <div className="max-w-[1400px] mx-auto px-8 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
        {hasSpecs && (
          <div className="lg:col-span-2">
            <h2
              className="text-[#1C2B3A] mb-6"
              style={{
                fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                fontSize: '1.5rem',
                fontWeight: 700,
              }}
            >
              {t('courseSpecs')}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(specValues).map(([key, value]) => {
                const config = specConfig[key];
                if (!config) return null;
                const Icon = config.icon;
                return (
                  <div
                    key={key}
                    className="bg-card rounded-xl p-4 border border-border text-center"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#FFF3E5] flex items-center justify-center mx-auto mb-2">
                      <Icon size={18} className="text-[#F5851F]" />
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">{config.label}</div>
                    <div className="text-sm font-bold text-[#1C2B3A]">{value}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {hasPrice && (
          <div className="bg-gradient-to-br from-[#F5851F] to-[#FF6B35] rounded-2xl p-6 text-white text-center shadow-lg">
            <div className="text-xs opacity-80 mb-2">{t('coursePrice')}</div>
            <div className="flex items-baseline justify-center gap-2 mb-2">
              {hasDiscount && (
                <span className="text-sm opacity-70 line-through">{formatPrice(originalPrice!)}</span>
              )}
              <span className="text-3xl font-bold">{formatPrice(price!)}</span>
            </div>
            {hasDiscount && (
              <div className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-semibold">
                {t('save')} {formatPrice(originalPrice! - price!)}
              </div>
            )}
            <div className="text-xs opacity-80 mt-3">{t('priceIncludes')}</div>
          </div>
        )}
      </div>
    </section>
  );
}
