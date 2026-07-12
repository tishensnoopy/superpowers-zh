import { BookOpen } from 'lucide-react';
import type { CourseModule } from '../../lib/api';

export default function CourseOutline({ outline }: { outline?: CourseModule[] }) {
  const hasData = outline && outline.length > 0;

  return (
    <section className="py-16 bg-muted/30">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center">
            <BookOpen size={20} className="text-[#2563EB]" />
          </div>
          <h2
            className="text-[#1C2B3A]"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: '1.75rem',
              fontWeight: 700,
            }}
          >
            课程大纲
          </h2>
        </div>
        {hasData ? (
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
            <div className="space-y-6">
              {outline!.map((module, index) => (
                <div key={module.id} className="relative flex gap-6">
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-full bg-card border-2 border-[#2563EB] flex items-center justify-center font-bold text-[#2563EB] z-10"
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 bg-card rounded-2xl p-6 border border-border shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-[#1C2B3A]">{module.title}</h3>
                      {module.lessonCount && module.lessonCount > 0 && (
                        <span className="text-sm text-[#2563EB] font-medium bg-[#EFF6FF] px-3 py-1 rounded-full">
                          {module.lessonCount} 课时
                        </span>
                      )}
                    </div>
                    {module.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed">{module.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border">
            <BookOpen size={32} className="mx-auto mb-3 opacity-40" />
            <p>课程大纲内容更新中，敬请期待</p>
          </div>
        )}
      </div>
    </section>
  );
}
