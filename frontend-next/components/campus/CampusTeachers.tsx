import Link from 'next/link';
import { Users } from 'lucide-react';
import StrapiImage from '@/components/ui/StrapiImage';
import type { Teacher } from '@/lib/api';
import { useTranslations } from 'next-intl';

interface CampusTeachersProps {
  teachers?: Teacher[];
}

// 校区详情页教师列表：4 列迷你卡片
export default function CampusTeachers({ teachers }: CampusTeachersProps) {
  const t = useTranslations('campuses');
  const list = teachers ?? [];

  return (
    <section className="py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[#FFF3E5] flex items-center justify-center">
          <Users size={20} className="text-[#F5851F]" />
        </div>
        <h2
          className="text-[#1C2B3A]"
          style={{
            fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
            fontSize: '1.75rem',
            fontWeight: 700,
          }}
        >
          {t('teachersTitle')}
        </h2>
      </div>

      {list.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {list.map((teacher: Teacher) => {
            const { avatar, slug, name, title } = teacher;
            return (
              <Link
                key={teacher.id}
                href={`/teachers/${slug}`}
                className="bg-card rounded-2xl p-5 border border-border shadow-sm text-center hover:-translate-y-1 hover:border-[#F5851F] hover:shadow-md transition-all duration-300"
              >
                <div className="relative w-20 h-20 mx-auto mb-3 rounded-full overflow-hidden bg-muted">
                  {avatar?.url ? (
                    <StrapiImage
                      src={avatar}
                      alt={name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-white text-2xl font-bold"
                      style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
                    >
                      {name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="font-bold text-[#1C2B3A] mb-1">{name}</div>
                {title && (
                  <div className="text-sm text-muted-foreground">{title}</div>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border">
          <Users size={32} className="mx-auto mb-3 opacity-40" />
          <p>{t('teachersUpdating')}</p>
        </div>
      )}
    </section>
  );
}
