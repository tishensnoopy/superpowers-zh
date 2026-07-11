import { Sparkles } from 'lucide-react';
import type { Section } from '../../lib/api';

export default function Features({ section }: { section: Section }) {
  const { title, description, features } = section;
  
  return (
    <section className="py-24 bg-background">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EFF6FF] text-[#2563EB] text-sm font-medium mb-5">
            <Sparkles size={14} />
            核心功能
          </div>
          <h2
            className="text-[#1C2B3A] mb-4"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: '2.25rem',
              fontWeight: 800,
            }}
          >
            {title || '全方位课程体系'}
          </h2>
          <p className="text-muted-foreground text-base max-w-[560px] mx-auto leading-relaxed">
            {description || '科学规划，全面发展'}
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {(features?.data || []).map((feature: any) => (
            <div key={feature.id} className="col-span-12 sm:col-span-6 lg:col-span-3">
              <div className={`h-full bg-card rounded-2xl p-8 border border-border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col ${feature.isHighlighted ? 'ring-2 ring-[#F5851F]' : ''}`}>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: '#EFF6FF' }}
                >
                  <Sparkles size={24} style={{ color: '#2563EB' }} />
                </div>
                <h3
                  className="text-lg font-bold text-[#1C2B3A] mb-3"
                  style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
                >
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed flex-1">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
