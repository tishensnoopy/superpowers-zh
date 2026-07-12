import type { Teacher } from '../../lib/api';

export const subjectLabels: Record<string, string> = {
  pinyin: '拼音',
  math: '数学',
  english: '英语',
  comprehensive: '综合素养',
};

interface TeacherCardProps {
  teacher: Teacher;
  isSelected?: boolean;
  onSelect?: (id: number) => void;
}

export default function TeacherCard({ teacher, isSelected, onSelect }: TeacherCardProps) {
  const { name, title, avatar, campus, subject, teachingYears } = teacher.attributes;

  const avatarUrl = avatar?.data?.attributes?.url;
  const campusName = campus?.data?.attributes?.name;
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
        'transition-all duration-200 hover:-translate-y-1 hover:border-[#F5851F] hover:shadow-md',
        isSelected ? 'ring-2 ring-[#F5851F] border-[#F5851F]' : '',
      ].join(' ')}
      style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
    >
      <div className="flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-[#FFF3E5] flex items-center justify-center mb-4 border-2 border-[#F5851F]/20">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl font-bold text-[#F5851F]">{initial}</span>
          )}
        </div>

        <h3 className="text-lg font-bold text-[#1C2B3A] mb-1">{name}</h3>
        {title && <p className="text-sm text-muted-foreground mb-2">{title}</p>}

        {subjectLabel && (
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-[#FFF3E5] text-[#F5851F] mb-2">
            {subjectLabel}
          </span>
        )}

        {campusName && (
          <p className="text-xs text-muted-foreground mb-1">{campusName}</p>
        )}

        {typeof teachingYears === 'number' && (
          <p className="text-xs text-muted-foreground">{teachingYears}年教龄</p>
        )}
      </div>
    </div>
  );
}
