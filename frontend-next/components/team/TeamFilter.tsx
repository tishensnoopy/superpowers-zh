'use client';

import { useTranslations } from 'next-intl';

// 师资团队筛选器：校区 + 科目

interface TeamFilterProps {
  campusSlug?: string | null;
  subject?: string | null;
  onCampusChange: (slug: string | null) => void;
  onSubjectChange: (subject: string | null) => void;
}

export default function TeamFilter({
  campusSlug,
  subject,
  onCampusChange,
  onSubjectChange,
}: TeamFilterProps) {
  const t = useTranslations('teachers');
  const campusOptions = [
    { label: t('campusBaibuting'), slug: 'yousen-baibuting' },
    { label: t('campusSanyanglu'), slug: 'yousen-sanyanglu' },
    { label: t('campusDongwuyuan'), slug: 'yousen-dongwuyuan' },
    { label: t('campusZhongjiacun'), slug: 'yousen-zhongjiacun' },
    { label: t('campusSixin'), slug: 'yousen-sixin' },
    { label: t('campusZhuankou'), slug: 'yousen-zhuankou' },
  ];

  const subjectOptions = [
    { label: t('pinyin'), value: 'pinyin' },
    { label: t('math'), value: 'math' },
    { label: t('english'), value: 'english' },
    { label: t('comprehensive'), value: 'comprehensive' },
  ];

  const isCampusAll = !campusSlug;
  const isSubjectAll = !subject;

  const chipClass = (active: boolean) =>
    [
      'inline-flex items-center justify-center px-4 py-2 text-sm font-medium cursor-pointer',
      'rounded-[20px] border transition-all whitespace-nowrap',
      active
        ? 'bg-[#F5851F] text-white border-[#F5851F]'
        : 'bg-card text-muted-foreground border-border hover:border-[#F5851F] hover:text-[#F5851F]',
    ].join(' ');

  return (
    <div
      className="flex flex-col gap-4"
      style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
    >
      {/* 校区筛选 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="text-sm font-bold text-[#1C2B3A] sm:mr-2 shrink-0">{t('campusLabel')}</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={chipClass(isCampusAll)}
            onClick={() => onCampusChange(null)}
          >
            {t('all')}
          </button>
          {campusOptions.map((opt) => (
            <button
              key={opt.slug}
              type="button"
              className={chipClass(campusSlug === opt.slug)}
              onClick={() => onCampusChange(opt.slug)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 科目筛选 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="text-sm font-bold text-[#1C2B3A] sm:mr-2 shrink-0">{t('subjectLabel')}</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={chipClass(isSubjectAll)}
            onClick={() => onSubjectChange(null)}
          >
            {t('all')}
          </button>
          {subjectOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={chipClass(subject === opt.value)}
              onClick={() => onSubjectChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
