import { MessageSquare } from 'lucide-react';
import type { CourseTestimonial } from '@/lib/api';
import { useTranslations } from 'next-intl';

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} 星评分`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={star <= rating ? 'text-[var(--brand-primary,#F5851F)]' : 'text-muted-foreground/30'}
          style={{ fontSize: '1rem' }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export default function CourseTestimonials({ testimonials }: { testimonials?: CourseTestimonial[] }) {
  const t = useTranslations('courses');
  const hasData = testimonials && testimonials.length > 0;

  return (
    <section className="py-16 bg-background">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] flex items-center justify-center">
            <MessageSquare size={20} className="text-[#059669]" />
          </div>
          <h2
            className="text-[var(--brand-dark,#1C2B3A)]"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: '1.75rem',
              fontWeight: 700,
            }}
          >
            {t('parentReviews')}
          </h2>
        </div>
        {hasData ? (
          <div className="grid grid-cols-12 gap-6">
            {testimonials!.map((t) => (
              <div key={t.id} className="col-span-12 sm:col-span-6 lg:col-span-4">
                <div className="h-full bg-card rounded-2xl p-6 border border-border shadow-sm">
                  <StarRating rating={t.rating || 5} />
                  <p className="text-sm text-muted-foreground leading-relaxed my-4">{t.content}</p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#FFF3E5] flex items-center justify-center text-[var(--brand-primary,#F5851F)] font-bold text-sm">
                      {t.parentName.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-[var(--brand-dark,#1C2B3A)]">{t.parentName}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border">
            <MessageSquare size={32} className="mx-auto mb-3 opacity-40" />
            <p>{t('testimonialsUpdating')}</p>
          </div>
        )}
      </div>
    </section>
  );
}
