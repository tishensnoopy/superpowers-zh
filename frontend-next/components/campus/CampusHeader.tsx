import { MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';

// 校区总览页 Hero 区：固定标题与副标题
export default function CampusHeader() {
  const t = useTranslations('campuses');
  return (
    <div className="text-center mb-12">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-sm mb-5">
        <MapPin size={28} className="text-[#F5851F]" />
      </div>
      <h1
        className="text-[#1C2B3A] mb-4"
        style={{
          fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
          fontSize: '2.5rem',
          fontWeight: 800,
        }}
      >
        {t('title')}
      </h1>
      <p className="text-muted-foreground text-lg max-w-[640px] mx-auto">
        {t('subtitle')}
      </p>
    </div>
  );
}
