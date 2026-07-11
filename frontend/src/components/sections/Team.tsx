import { Heart, User } from 'lucide-react';
import type { Section } from '../../lib/api';

export default function Team({ section }: { section: Section }) {
  const { title, description, members } = section;

  return (
    <section className="py-24 bg-background">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#ECFDF5] text-[#059669] text-sm font-medium mb-5">
            <Heart size={14} />
            师资团队
          </div>
          <h2
            className="text-[#1C2B3A] mb-4"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: '2.25rem',
              fontWeight: 800,
            }}
          >
            {title || '资深教师团队'}
          </h2>
          <p className="text-muted-foreground text-base max-w-[480px] mx-auto">
            {description || '8年沉淀，打造出一支专业、有爱、懂孩子的教师队伍。'}
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {(members?.data || []).map((member: any) => {
            const m = member.attributes || member;
            return (
              <div key={member.id} className="col-span-12 sm:col-span-6 lg:col-span-3">
                <div className="h-full bg-card rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <div className="aspect-square bg-[#F5F3FF] flex items-center justify-center">
                    {m.avatar ? (
                      <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center">
                        <User size={48} className="text-[#7C3AED]" />
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <h3
                      className="text-xl font-bold text-[#1C2B3A] mb-1"
                      style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
                    >
                      {m.name}
                    </h3>
                    <p className="text-[#7C3AED] text-sm font-medium mb-3">{m.position}</p>
                    <p className="text-muted-foreground text-sm leading-relaxed">{m.bio}</p>
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
