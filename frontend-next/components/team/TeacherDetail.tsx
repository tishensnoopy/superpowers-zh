'use client';

import { X } from 'lucide-react';
import StrapiImage from '@/components/ui/StrapiImage';
import type { Teacher } from '@/lib/api';
import { useTranslations } from 'next-intl';

interface TeacherDetailProps {
  teacher: Teacher;
  onClose?: () => void;
}

export default function TeacherDetail({ teacher, onClose }: TeacherDetailProps) {
  const t = useTranslations('teachers');
  const {
    name,
    title,
    avatar,
    teachingYears,
    education,
    teachingFeatures,
    achievements,
  } = teacher;

  const initial = name ? name.charAt(0) : '';
  const achievementList = Array.isArray(achievements) ? achievements : [];

  return (
    <div
      className="relative bg-card rounded-2xl border border-[#F5851F]/30 shadow-md p-8"
      style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
    >
      <div className="flex flex-col md:flex-row gap-8">
        {/* 左侧：大头像 + 基本信息 */}
        <div className="flex-shrink-0 flex flex-col items-center md:items-start">
          <div className="relative w-40 h-40 rounded-full overflow-hidden bg-[#FFF3E5] flex items-center justify-center border-4 border-[#F5851F]/20">
            {avatar?.url ? (
              <StrapiImage
                src={avatar}
                alt={name}
                fill
                sizes="160px"
                className="object-cover"
              />
            ) : (
              <span className="text-5xl font-bold text-[#F5851F]">{initial}</span>
            )}
          </div>
          <h3 className="mt-4 text-xl font-bold text-[#1C2B3A]">{name}</h3>
          {title && <p className="text-sm text-muted-foreground mt-1">{title}</p>}
          {typeof teachingYears === 'number' && (
            <p className="text-sm text-[#F5851F] mt-1">{teachingYears} {t('teachingYearsUnit')}</p>
          )}
        </div>

        {/* 右侧：详情 */}
        <div className="flex-1 min-w-0">
          {education && (
            <div className="mb-6">
              <h4 className="text-base font-bold text-[#1C2B3A] mb-2">{t('education')}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{education}</p>
            </div>
          )}

          {teachingFeatures && (
            <div className="mb-6">
              <h4 className="text-base font-bold text-[#1C2B3A] mb-2">{t('teachingFeatures')}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{teachingFeatures}</p>
            </div>
          )}

          {achievementList.length > 0 && (
            <div>
              <h4 className="text-base font-bold text-[#1C2B3A] mb-3">{t('achievements')}</h4>
              <div className="flex flex-wrap gap-2">
                {achievementList.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-block px-3 py-1 rounded-full text-xs font-medium text-white"
                    style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
