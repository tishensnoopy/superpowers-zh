'use client';

import StrapiImage from '@/components/ui/StrapiImage';
import type { Teacher } from '@/lib/api';
import { useTranslations } from 'next-intl';

interface TeacherCardProps {
  teacher: Teacher;
  isSelected?: boolean;
  onSelect?: (id: number) => void;
}

export default function TeacherCard({ teacher, isSelected, onSelect }: TeacherCardProps) {
  const t = useTranslations('teachers');
  const subjectLabels: Record<string, string> = {
    pinyin: t('pinyin'),
    math: t('math'),
    english: t('english'),
    comprehensive: t('comprehensive'),
  };
  const { name, title, avatar, campus, subject, teachingYears } = teacher;

  const campusName = campus?.name;
  const subjectLabel = subject ? subjectLabels[subject] : null;
  const initial = name ? name.charAt(0) : '';

  const handleClick = () => {
    if (onSelect) {
      onSelect(teacher.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      className={[
        'group cursor-pointer bg-card rounded-2xl p-6 border border-border shadow-sm',
        'transition-all duration-200 hover:-translate-y-1 hover:border-[var(--brand-primary,#F5851F)] hover:shadow-md',
        isSelected ? 'ring-2 ring-[var(--brand-primary,#F5851F)] border-[var(--brand-primary,#F5851F)]' : '',
      ].join(' ')}
      style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative w-24 h-24 rounded-full overflow-hidden bg-[#FFF3E5] flex items-center justify-center mb-4 border-2 border-[var(--brand-primary,#F5851F)]/20">
          {avatar?.url ? (
            <StrapiImage
              src={avatar}
              alt={name}
              fill
              sizes="96px"
              className="object-cover"
            />
          ) : (
            <span className="text-3xl font-bold text-[var(--brand-primary,#F5851F)]">{initial}</span>
          )}
        </div>

        <h3 className="text-lg font-bold text-[var(--brand-dark,#1C2B3A)] mb-1">{name}</h3>
        {title && <p className="text-sm text-muted-foreground mb-2">{title}</p>}

        {subjectLabel && (
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-[#FFF3E5] text-[var(--brand-primary,#F5851F)] mb-2">
            {subjectLabel}
          </span>
        )}

        {campusName && (
          <p className="text-xs text-muted-foreground mb-1">{campusName}</p>
        )}

        {typeof teachingYears === 'number' && (
          <p className="text-xs text-muted-foreground">{teachingYears} {t('teachingYearsUnit')}</p>
        )}
      </div>
    </div>
  );
}
