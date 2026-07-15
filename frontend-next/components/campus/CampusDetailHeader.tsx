import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Campus } from '@/lib/api';
import { useTranslations } from 'next-intl';

// 校区详情页头部：面包屑 + 校区名 + 简介
export default function CampusDetailHeader({ campus }: { campus: Campus }) {
  const tNav = useTranslations('navigation');
  const tCampuses = useTranslations('campuses');
  const { name, description } = campus;

  return (
    <>
      {/* 面包屑 */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-[#F5851F] transition-colors">
          {tNav('home')}
        </Link>
        <ChevronRight size={14} />
        <Link href="/campuses" className="hover:text-[#F5851F] transition-colors">
          {tCampuses('campusOverview')}
        </Link>
        <ChevronRight size={14} />
        <span className="text-[#1C2B3A]">{name}</span>
      </nav>

      {/* Hero 区 */}
      <section className="mb-10">
        <h1
          className="text-[#1C2B3A] mb-4"
          style={{
            fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
            fontSize: '2.5rem',
            fontWeight: 800,
          }}
        >
          {name}
        </h1>
        {description && (
          <p className="text-muted-foreground text-lg max-w-[800px] leading-relaxed">
            {description}
          </p>
        )}
      </section>
    </>
  );
}
