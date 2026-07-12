import { useEffect, useState } from 'react';
import { getCampuses, type Campus } from '../lib/api';
import CampusHeader from '../components/campus/CampusHeader';
import CampusGrid from '../components/campus/CampusGrid';

export default function CampusOverviewPage() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getCampuses()
      .then((res) => {
        if (!cancelled) {
          setCampuses(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[CampusOverviewPage] 加载失败:', err);
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="pt-[120px] pb-16 min-h-screen"
      style={{ background: 'linear-gradient(to bottom, #FFF3E5, #ffffff)' }}
    >
      <div className="max-w-[1400px] mx-auto px-8">
        <CampusHeader />

        {loading && (
          <div className="py-32 text-center text-muted-foreground">加载中...</div>
        )}

        {error && (
          <div className="py-32 text-center">
            <h2 className="text-2xl font-bold text-[#1C2B3A] mb-4">加载失败</h2>
            <p className="text-muted-foreground">校区信息加载出错，请稍后重试。</p>
          </div>
        )}

        {!loading && !error && <CampusGrid campuses={campuses} />}
      </div>
    </div>
  );
}
