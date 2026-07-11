import { CheckCircle } from 'lucide-react';
import type { Section } from '../../lib/api';

export default function ContactForm({ section }: { section: Section }) {
  const { title, description, fields, submitText = '提交', successMessage } = section;
  
  return (
    <section className="py-24 relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(135deg, #1C2B3A 0%, #2D4A6B 100%)' }}
      />
      <div
        className="absolute -top-20 -right-20 w-96 h-96 rounded-full opacity-20 blur-3xl"
        style={{ background: '#F5851F' }}
      />
      <div
        className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full opacity-10 blur-3xl"
        style={{ background: '#4ECDC4' }}
      />

      <div className="relative z-10 max-w-[1400px] mx-auto px-8">
        <div className="grid grid-cols-12 gap-8 items-center">
          <div className="col-span-12 lg:col-span-7">
            <h2
              className="text-white mb-4"
              style={{
                fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                fontSize: '2.5rem',
                fontWeight: 800,
                lineHeight: 1.25,
              }}
            >
              {title || '立即预约，免费体验一节精品课'}
            </h2>
            <p className="text-white/70 text-base leading-relaxed mb-8 max-w-[540px]">
              {description || '无需任何费用，带孩子来亲身感受我们的课堂氛围。'}
            </p>
            <div className="flex flex-wrap gap-4">
              {['免费测评', '专属方案', '试听无压力', '当天即可安排'].map((tag) => (
                <div key={tag} className="flex items-center gap-2 text-white/80 text-sm">
                  <CheckCircle size={15} className="text-[#F5851F]" />
                  {tag}
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-5">
            <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-2xl">
              <h3
                className="text-[#1C2B3A] font-bold text-xl mb-6"
                style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
              >
                {title || '预约免费试听课'}
              </h3>
              <div className="space-y-4">
                {(fields?.data || []).map((field: any) => (
                  field.type === 'textarea' ? (
                    <textarea
                      key={field.id}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-[#F8F9FF] text-sm focus:outline-none focus:border-[#F5851F] transition-colors"
                      rows={4}
                    />
                  ) : field.type === 'select' ? (
                    <select className="w-full px-4 py-3 rounded-xl border border-border bg-[#F8F9FF] text-sm text-muted-foreground focus:outline-none focus:border-[#F5851F] transition-colors appearance-none">
                      <option value="">{field.placeholder}</option>
                      {field.options?.split(',').map((opt: string) => (
                        <option key={opt.trim()}>{opt.trim()}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      key={field.id}
                      type={field.type || 'text'}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-[#F8F9FF] text-sm focus:outline-none focus:border-[#F5851F] transition-colors"
                      required={field.required}
                    />
                  )
                ))}
                <button
                  className="w-full py-4 rounded-xl text-white font-bold text-base shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
                  style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
                >
                  {submitText} →
                </button>
                {successMessage && (
                  <p className="text-center text-xs text-muted-foreground">{successMessage}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
