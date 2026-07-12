'use client';

// 师资团队筛选器：校区 + 科目

interface TeamFilterProps {
  campusSlug?: string | null;
  subject?: string | null;
  onCampusChange: (slug: string | null) => void;
  onSubjectChange: (subject: string | null) => void;
}

const campusOptions = [
  { label: '朝阳', slug: 'chaoyang' },
  { label: '海淀', slug: 'haidian' },
  { label: '西城', slug: 'xicheng' },
  { label: '丰台', slug: 'fengtai' },
  { label: '东城', slug: 'dongcheng' },
  { label: '石景山', slug: 'shijingshan' },
  { label: '通州', slug: 'tongzhou' },
  { label: '昌平', slug: 'changping' },
];

const subjectOptions = [
  { label: '拼音', value: 'pinyin' },
  { label: '数学', value: 'math' },
  { label: '英语', value: 'english' },
  { label: '综合素养', value: 'comprehensive' },
];

export default function TeamFilter({
  campusSlug,
  subject,
  onCampusChange,
  onSubjectChange,
}: TeamFilterProps) {
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
        <span className="text-sm font-bold text-[#1C2B3A] sm:mr-2 shrink-0">校区</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={chipClass(isCampusAll)}
            onClick={() => onCampusChange(null)}
          >
            全部
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
        <span className="text-sm font-bold text-[#1C2B3A] sm:mr-2 shrink-0">科目</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={chipClass(isSubjectAll)}
            onClick={() => onSubjectChange(null)}
          >
            全部
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
