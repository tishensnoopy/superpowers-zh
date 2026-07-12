import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { Campus } from '../../lib/api';

// 校区详情页头部：面包屑 + 校区名 + 简介
export default function CampusDetailHeader({ campus }: { campus: Campus }) {
  const { name, description } = campus.attributes;

  return (
    <>
      {/* 面包屑 */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:text-[#F5851F] transition-colors">
          首页
        </Link>
        <ChevronRight size={14} />
        <Link to="/campuses" className="hover:text-[#F5851F] transition-colors">
          校区总览
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
