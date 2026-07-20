import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  const t = useTranslations('errors');
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, var(--brand-primary,#F5851F), #FF6B35)' }}
    >
      <div className="text-center px-8">
        <div
          className="text-[120px] font-black text-white leading-none opacity-90"
          style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
        >
          {t('code404')}
        </div>
        <h1
          className="text-3xl font-bold text-white mt-4 mb-3"
          style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
        >
          {t('notFoundTitle')}
        </h1>
        <p className="text-white/80 mb-8 max-w-md mx-auto">
          {t('notFoundMessage')}
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[var(--brand-primary,#F5851F)] rounded-xl font-semibold hover:bg-white/90 transition-colors shadow-lg"
          >
            <Home size={18} /> {t('backToHome')}
          </Link>
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 px-6 py-3 border-2 border-white/70 text-white rounded-xl font-semibold hover:bg-white/10 transition-colors"
          >
            <Search size={18} /> {t('browseCourses')}
          </Link>
        </div>
      </div>
    </div>
  );
}
