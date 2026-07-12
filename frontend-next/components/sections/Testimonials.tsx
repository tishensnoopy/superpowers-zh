import { Star } from 'lucide-react';
import type { Section } from '@/lib/api';

export default function Testimonials({ section }: { section: Section }) {
  const { title, testimonials } = section;

  return (
    <section className="py-24 bg-background">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFF3E5] text-[#F5851F] text-sm font-medium mb-5">
            <Star size={14} />
            客户评价
          </div>
          <h2
            className="text-[#1C2B3A] mb-4"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: '2.25rem',
              fontWeight: 800,
            }}
          >
            {title || '听听家长们怎么说'}
          </h2>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {(testimonials?.data || []).map((testimonial: any) => (
            <div key={testimonial.id} className="col-span-12 md:col-span-4">
              <div className="bg-card rounded-2xl p-8 border border-border shadow-sm hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: testimonial.rating || 5 }).map((_, i) => (
                    <Star key={i} size={14} fill="#F5851F" className="text-[#F5851F]" />
                  ))}
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">&ldquo;{testimonial.content}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-muted">
                    <img
                      src={testimonial.avatar?.url || testimonial.avatar}
                      alt={testimonial.author}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-[#1C2B3A]">{testimonial.author}</div>
                    <div className="text-xs text-muted-foreground">{testimonial.role} · {testimonial.company}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
