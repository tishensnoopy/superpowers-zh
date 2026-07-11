import { Award, BookOpen, ChevronRight, GraduationCap, Shield, Users } from 'lucide-react';
import type { Section } from '../../lib/api';

const iconMap: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  GraduationCap,
  Users,
  BookOpen,
  Shield,
};

export default function Advantages({ section }: { section: Section }) {
  const { title, description, advantages } = section;
  
  return (
    <section className="py-24 bg-background">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFF3E5] text-[#F5851F] text-sm font-medium mb-5">
            <Award size={14} />
            为什么选择我们
          </div>
          <h2
            className="text-[#1C2B3A] mb-4"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: '2.25rem',
              fontWeight: 800,
            }}
          >
            {title || '4大核心优势，给孩子最好的起点'}
          </h2>
          <p className="text-muted-foreground text-base max-w-[560px] mx-auto leading-relaxed">
            {description || '我们深知每位家长对孩子教育的期望与用心，以专业、安全、温暖的教育环境陪伴每一个孩子成长。'}
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {(Array.isArray(advantages) ? advantages : (advantages?.data || [])).map((adv: any) => {
            const advAttrs = adv.attributes || adv;
            const Icon = iconMap[advAttrs.icon] || Award;
            return (
              <div
                key={adv.id}
                className="col-span-12 sm:col-span-6 lg:col-span-3 group"
              >
                <div className="h-full bg-card rounded-2xl p-8 border border-border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110"
                    style={{ background: advAttrs.bgColor || '#FFF3E5' }}
                  >
                    <Icon size={26} style={{ color: advAttrs.color || '#F5851F' }} />
                  </div>
                  <h3
                    className="text-xl font-bold text-[#1C2B3A] mb-3"
                    style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
                  >
                    {advAttrs.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed flex-1">{advAttrs.description}</p>
                  <div
                    className="mt-6 flex items-center gap-1 text-sm font-medium transition-colors duration-200"
                    style={{ color: advAttrs.color || '#F5851F' }}
                  >
                    了解详情 <ChevronRight size={15} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
