import { useTranslations } from 'next-intl';

export default function Loading() {
  const t = useTranslations('loading');
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-600">{t('loading')}</p>
      </div>
    </div>
  );
}
