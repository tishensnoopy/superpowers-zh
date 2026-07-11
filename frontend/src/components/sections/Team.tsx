import { GraduationCap, Star } from 'lucide-react';
import type { Section } from '../../lib/api';

export default function Team({ section }: { section: Section }) {
  const { title, description, members } = section;
  
  return (
    <section className="py-24" style={{ background: '#F8F9FF' }}>
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F5F3FF] text-[#7C3AED] text-sm font-medium mb-5">
            <GraduationCap size={14} />
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
            {title || '专业教师团队，用心陪伴每个孩子'}
          </h2>
          <p className="text-muted-foreground text-base max-w-[560px] mx-auto">
            {description || '所有老师均持证上岗，平均教龄9年，热爱儿童教育事业，耐心温暖是我们的共同特质。'}
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {(members?.data || []).map((member: any) => (
            <div key={member.id} className="col-span-12 sm:col-span-6 lg:col-span-3">
              <div className="bg-card rounded-2xl p-8 border border-border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-center flex flex-col items-center">
                <div className="relative mb-5">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-muted border-4 border-white shadow-lg">
                    <img
                      src={member.avatar?.data?.attributes?.url || member.avatar}
                      alt={member.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {member.badge && (
                    <div
                      className="absolute -bottom-1 -right-1 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow"
                      style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
                    >
                      {member.badge}
                    </div>
                  )}
                </div>

                <h3
                  className="text-xl font-bold text-[#1C2B3A] mb-1"
                  style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
                >
                  {member.name}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">{member.role}</p>

                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} size={13} fill="#F5851F" className="text-[#F5851F]" />
                  ))}
                </div>

                {member.years && (
                  <div className="w-full bg-[#FFF3E5] rounded-xl p-3 flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground">教龄</span>
                    <span className="text-sm font-bold text-[#F5851F]">{member.years}年</span>
                  </div>
                )}
                {member.specialty && (
                  <div className="w-full bg-muted rounded-xl p-3">
                    <p className="text-xs text-muted-foreground text-center">{member.specialty}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
