import { CalendarDays, ChevronRight, Sparkles, Star } from 'lucide-react';
import type { Section } from '@/lib/api';

export default function Hero({ section }: { section: Section }) {
  const { title, subtitle, description, backgroundImage, buttonText, isFullWidth = true } = section;

  return (
    <section className="relative pt-[72px] min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0 bg-[#1C2B3A]">
        {backgroundImage?.url ? (
          <img
            src={backgroundImage.url}
            alt=""
            className="w-full h-full object-cover opacity-30"
          />
        ) : (
          <div className="w-full h-full" />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(105deg, rgba(28,43,58,0.96) 0%, rgba(28,43,58,0.80) 45%, rgba(245,133,31,0.25) 100%)',
          }}
        />
      </div>

      <div
        className="absolute top-24 right-0 w-[520px] h-[520px] rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: '#F5851F' }}
      />
      <div
        className="absolute bottom-0 left-1/3 w-[300px] h-[300px] rounded-full opacity-5 blur-2xl pointer-events-none"
        style={{ background: '#4ECDC4' }}
      />

      <div className={`relative z-10 max-w-[1400px] mx-auto px-8 w-full ${isFullWidth ? '' : 'max-w-4xl'}`}>
        <div className="grid grid-cols-12 gap-6 items-center">
          <div className="col-span-12 lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-sm mb-8">
              <Sparkles size={14} className="text-[#F5851F]" />
              <span>{subtitle || '2026年秋季班正在招生 · 名额有限'}</span>
            </div>

            <h1
              className="text-white leading-[1.2] mb-6"
              style={{
                fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                fontSize: 'clamp(2.4rem, 4vw, 3.6rem)',
                fontWeight: 800,
              }}
            >
              {title || '让每个孩子\n自信迈入小学大门'}
            </h1>

            <p className="text-white/75 text-lg leading-relaxed mb-10 max-w-[520px]">
              {description || '专注幼小衔接教育8年，科学课程体系 + 专业师资团队，帮助3-6岁儿童在入学前全面准备。'}
            </p>

            <div className="flex items-center gap-8 mb-10">
              {[
                { num: '8年+', label: '专注幼教' },
                { num: '3000+', label: '毕业学员' },
                { num: '98%', label: '家长满意度' },
                { num: '6所', label: '直营校区' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div
                    className="text-2xl font-black text-white leading-none mb-1"
                    style={{ fontFamily: "'Nunito', sans-serif", color: '#F5851F' }}
                  >
                    {stat.num}
                  </div>
                  <div className="text-white/60 text-xs">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <button
                className="flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold text-base shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-[1.03]"
                style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
              >
                <CalendarDays size={18} />
                {buttonText || '立即预约试听'}
              </button>
              <button className="flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-base border border-white/30 text-white hover:bg-white/10 transition-all duration-200">
                了解课程体系
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="hidden lg:block col-span-5">
            <div className="relative h-[520px]">
              <div className="absolute top-0 right-0 w-72 h-80 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20">
                <img
                  src="https://images.unsplash.com/photo-1586694680938-9682c9e1f736?w=400&h=480&fit=crop&auto=format"
                  alt="小女孩认真学习写字"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute bottom-10 left-0 w-60 h-64 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20">
                <img
                  src="https://images.unsplash.com/photo-1617117206620-b01f2919ff86?w=340&h=360&fit=crop&auto=format"
                  alt="孩子们快乐学习"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute bottom-32 right-4 bg-white rounded-2xl p-4 shadow-xl flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                  style={{ background: '#F5851F' }}
                >
                  <Star size={18} fill="white" />
                </div>
                <div>
                  <div className="font-black text-sm text-[#1C2B3A]">口碑认证</div>
                  <div className="text-xs text-muted-foreground">连续5年优质教育机构</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 80L1440 80V40C1200 80 960 0 720 20C480 40 240 80 0 40V80Z" fill="#FFFCF8" />
        </svg>
      </div>
    </section>
  );
}
