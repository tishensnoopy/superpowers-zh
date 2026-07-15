import { Target } from 'lucide-react';
import type { CourseObjective } from '@/lib/api';

export default function CourseObjectives({ objectives }: { objectives?: CourseObjective[] }) {
  const hasData = objectives && objectives.length > 0;

  return (
    <section className="py-16 bg-background">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-[#FFF3E5] flex items-center justify-center">
            <Target size={20} className="text-[#F5851F]" />
          </div>
          <h2
            className="text-[#1C2B3A]"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: '1.75rem',
              fontWeight: 700,
            }}
          >
            学习目标
          </h2>
        </div>
        {hasData ? (
          <div className="grid grid-cols-12 gap-6">
            {objectives!.map((obj, index) => (
              <div key={obj.id} className="col-span-12 sm:col-span-6 lg:col-span-4">
                <div className="h-full bg-card rounded-2xl p-6 border border-border shadow-sm flex gap-4">
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-full bg-[#F5851F] text-white flex items-center justify-center font-bold"
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-[#1C2B3A] mb-2">{obj.title}</h3>
                    {obj.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed">{obj.description}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border">
            <Target size={32} className="mx-auto mb-3 opacity-40" />
            <p>学习目标内容更新中，敬请期待</p>
          </div>
        )}
      </div>
    </section>
  );
}
