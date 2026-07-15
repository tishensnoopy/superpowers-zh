import { useEffect, useState } from 'react';
import { getTeachers, type Teacher } from '../../lib/api';
import Seo from '../Seo';
import TeamHeader from './TeamHeader';
import TeamFilter from './TeamFilter';
import TeamGrid from './TeamGrid';

export default function TeamPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [campusSlug, setCampusSlug] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // 筛选条件变化时重新加载
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getTeachers({
      campusSlug: campusSlug || undefined,
      subject: subject || undefined,
    })
      .then((res) => {
        if (!cancelled) {
          setTeachers(res.data || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[TeamPage] 加载失败:', err);
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [campusSlug, subject]);

  const handleCampusChange = (slug: string | null) => {
    setCampusSlug(slug);
    setSelectedId(null);
  };

  const handleSubjectChange = (s: string | null) => {
    setSubject(s);
    setSelectedId(null);
  };

  // 手风琴切换：点击同一卡片收起，点击不同卡片切换
  const handleSelect = (id: number) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const handleClose = () => {
    setSelectedId(null);
  };

  return (
    <div style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}>
      <Seo title="师资团队" description="认识我们的资深教师团队，所有教师均持有教师资格证，拥有丰富的幼小衔接教学经验。" />
      <TeamHeader />

      <section className="py-12 bg-background">
        <div className="max-w-[1400px] mx-auto px-8">
          {/* 筛选器 */}
          <div className="mb-8">
            <TeamFilter
              campusSlug={campusSlug}
              subject={subject}
              onCampusChange={handleCampusChange}
              onSubjectChange={handleSubjectChange}
            />
          </div>

          {/* 内容区 */}
          {loading ? (
            <div className="py-32 text-center text-muted-foreground">加载中...</div>
          ) : error ? (
            <div className="py-32 text-center">
              <h2 className="text-2xl font-bold text-[#1C2B3A] mb-4">加载失败</h2>
              <p className="text-muted-foreground">请稍后重试。</p>
            </div>
          ) : (
            <TeamGrid
              teachers={teachers}
              selectedId={selectedId}
              onSelect={handleSelect}
              onClose={handleClose}
            />
          )}
        </div>
      </section>
    </div>
  );
}
