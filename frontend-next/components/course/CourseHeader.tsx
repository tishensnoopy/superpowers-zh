import { Clock, Users, Calendar, GraduationCap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Product } from '@/lib/api';

const specConfig: Record<string, { label: string; icon: LucideIcon }> = {
  course_hours: { label: '课时', icon: Clock },
  class_size: { label: '班额', icon: Users },
  age_range: { label: '年龄', icon: GraduationCap },
  duration: { label: '周期', icon: Calendar },
};

export default function CourseHeader({ product }: { product: Product }) {
  const { name, shortDescription, specValues, price, originalPrice } = product;

  return (
    <section className="pt-[120px] pb-16 bg-gradient-to-b from-[#FFF3E5] to-background">
      <div className="max-w-[1400px] mx-auto px-8">
        <h1
          className="text-[#1C2B3A] mb-4"
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
                    <span className="text-sm font-medium text-[#1C2B3A]">{value}</span>
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
              <span className="text-2xl font-bold text-[#F5851F]">¥{price}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
