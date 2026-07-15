import TeacherCard from './TeacherCard';
import TeacherDetail from './TeacherDetail';
import type { Teacher } from '@/lib/api';

interface TeamGridProps {
  teachers?: Teacher[];
  selectedId?: number | null;
  onSelect?: (id: number) => void;
  onClose?: () => void;
}

export default function TeamGrid({ teachers, selectedId, onSelect, onClose }: TeamGridProps) {
  const list = Array.isArray(teachers) ? teachers : [];

  // 空状态
  if (list.length === 0) {
    return (
      <div
        className="py-20 text-center text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border"
        style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
      >
        暂无教师数据
      </div>
    );
  }

  // 查找选中教师
  const selectedTeacher = selectedId
    ? list.find((t) => t.id === selectedId) || null
    : null;

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
      style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
    >
      {list.map((teacher) => (
        <div key={teacher.id} className="contents">
          <TeacherCard
            teacher={teacher}
            isSelected={selectedId === teacher.id}
            onSelect={onSelect}
          />
          {selectedTeacher && selectedTeacher.id === teacher.id && (
            <div className="col-span-full">
              <TeacherDetail teacher={selectedTeacher} onClose={onClose} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
