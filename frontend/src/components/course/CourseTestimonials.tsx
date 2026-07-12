import { MessageSquare } from 'lucide-react';
import type { CourseTestimonial } from '../../lib/api';

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} 星评分`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={star <= rating ? 'text-[#F5851F]' : 'text-muted-foreground/30'}
          style={{ fontSize: '1rem' }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export default function CourseTestimonials({ testimonials }: { testimonials?: CourseTestimonial[] }) {
  if (!testimonials || testimonials.length === 0) return null;

  return (
    <section className="py-16 bg-background">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] flex items-center justify-center">
            <MessageSquare size={20} className="text-[#059669]" />
          </div>
          <h2
            className="text-[#1C2B3A]"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: '1.75rem',
              fontWeight: 700,
            }}
          >
            家长评价
          </h2>
        </div>
        <div className="grid grid-cols-12 gap-6">
          {testimonials.map((t) => (
            <div key={t.id} className="col-span-12 sm:col-span-6 lg:col-span-4">
              <div className="h-full bg-card rounded-2xl p-6 border border-border shadow-sm">
                <StarRating rating={t.rating || 5} />
                <p className="text-sm text-muted-foreground leading-relaxed my-4">{t.content}</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#FFF3E5] flex items-center justify-center text-[#F5851F] font-bold text-sm">
                    {t.parentName.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-[#1C2B3A]">{t.parentName}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
