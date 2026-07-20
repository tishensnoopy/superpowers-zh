import { Calendar } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

export default function CourseCTA({ courseName }: { courseName: string }) {
  const t = useTranslations('courses');
  return (
    <section className="py-16" style={{ background: 'linear-gradient(135deg, var(--brand-primary,#F5851F), #FF6B35)' }}>
      <div className="max-w-[1400px] mx-auto px-8 text-center">
        <h2
          className="text-white mb-4"
          style={{
            fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
            fontSize: '2rem',
            fontWeight: 800,
          }}
        >
          {t('bookTrialTitle')}{courseName ? <> — <span>{courseName}</span></> : ''}
        </h2>
        <p className="text-white/90 text-base mb-8 max-w-[480px] mx-auto">
          {t('bookTrialPrompt')}
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-white text-[var(--brand-primary,#F5851F)] font-bold text-base hover:bg-white/90 transition-colors duration-200 shadow-lg"
        >
          <Calendar size={20} />
          {t('bookNow')}
        </Link>
      </div>
    </section>
  );
}
