import { CalendarDays, ChevronRight, Sparkles, Star } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { Section } from '@/lib/api';
import { getImageUrl } from '@/lib/api';
import { useTranslations } from 'next-intl';

export default function Hero({ section }: { section: Section }) {
  const t = useTranslations('sections.hero');
  const { title, subtitle, description, backgroundImage, buttonText, isFullWidth = true, image1, image2, badgeText, stats } = section;

  // 后台可配的统计数字；未配置时回退到 i18n 默认 4 项
  const displayStats: { value: string; label: string }[] =
    Array.isArray(stats) && stats.length > 0
      ? stats.map((s: any) => ({ value: String(s?.value ?? ''), label: String(s?.label ?? '') }))
      : [
          { value: t('stat1Num'), label: t('stat1Label') },
          { value: t('stat2Num'), label: t('stat2Label') },
          { value: t('stat3Num'), label: t('stat3Label') },
          { value: t('stat4Num'), label: t('stat4Label') },
        ];

  const image1Url = getImageUrl(image1) || 'https://images.unsplash.com/photo-1586694680938-9682c9e1f736?w=400&h=480&fit=crop&auto=format';
  const image2Url = getImageUrl(image2) || 'https://images.unsplash.com/photo-1617117206620-b01f2919ff86?w=340&h=360&fit=crop&auto=format';

  return (
    <section className="relative pt-[120px] min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0 bg-[var(--brand-dark,#1C2B3A)]">
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
            background: 'linear-gradient(105deg, rgba(var(--brand-dark-rgb,28,43,58),0.96) 0%, rgba(var(--brand-dark-rgb,28,43,58),0.80) 45%, rgba(var(--brand-primary-rgb,245,133,31),0.25) 100%)',
          }}
        />
      </div>

      <div
        className="absolute top-24 right-0 w-[520px] h-[520px] rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: 'var(--brand-primary,#F5851F)' }}
      />
      <div
        className="absolute bottom-0 left-1/3 w-[300px] h-[300px] rounded-full opacity-5 blur-2xl pointer-events-none"
        style={{ background: '#4ECDC4' }}
      />

      <div className={`relative z-10 max-w-[1400px] mx-auto px-8 w-full ${isFullWidth ? '' : 'max-w-4xl'}`}>
        <div className="grid grid-cols-12 gap-6 items-center">
          <div className="col-span-12 lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-sm mb-8">
              <Sparkles size={14} className="text-[var(--brand-primary,#F5851F)]" />
              <span>{subtitle || t('subtitleFallback')}</span>
            </div>

            <h1
              className="text-white leading-[1.2] mb-6 whitespace-pre-line"
              style={{
                fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                fontSize: 'clamp(2.4rem, 4vw, 3.6rem)',
                fontWeight: 800,
              }}
            >
              {title || t('titleFallback')}
            </h1>

            <p className="text-white/75 text-lg leading-relaxed mb-10 max-w-[520px]">
              {description || t('descriptionFallback')}
            </p>

            <div className="flex items-center gap-8 mb-10">
              {displayStats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div
                    className="text-2xl font-black text-white leading-none mb-1"
                    style={{ fontFamily: "'Nunito', sans-serif", color: 'var(--brand-primary,#F5851F)' }}
                  >
                    {stat.value}
                  </div>
                  <div className="text-white/60 text-xs">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <Link
                href="/appointment"
                className="flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold text-base shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-[1.03]"
                style={{ background: 'linear-gradient(135deg, var(--brand-primary,#F5851F), #FF6B35)' }}
              >
                <CalendarDays size={18} />
                {buttonText || t('buttonTextFallback')}
              </Link>
              <Link
                href="/courses"
                className="flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-base border border-white/30 text-white hover:bg-white/10 transition-all duration-200"
              >
                {t('secondaryButton')}
                <ChevronRight size={18} />
              </Link>
            </div>
          </div>

          <div className="hidden lg:block col-span-5">
            <div className="relative h-[520px]">
              <div className="absolute top-0 right-0 w-72 h-80 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20">
                <img
                  src={image1Url}
                  alt={t('image1Alt')}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute bottom-10 left-0 w-60 h-64 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20">
                <img
                  src={image2Url}
                  alt={t('image2Alt')}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute bottom-32 right-4 bg-white rounded-2xl p-4 shadow-xl flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                  style={{ background: 'var(--brand-primary,#F5851F)' }}
                >
                  <Star size={18} fill="white" />
                </div>
                <div>
                  <div className="font-black text-sm text-[var(--brand-dark,#1C2B3A)]">{badgeText || t('badgeTitle')}</div>
                  <div className="text-xs text-muted-foreground">{t('badgeDesc')}</div>
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
