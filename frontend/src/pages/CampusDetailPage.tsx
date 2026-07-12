import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCampusBySlug, type Campus } from '../lib/api';
import Seo from '../components/Seo';
import CampusDetailHeader from '../components/campus/CampusDetailHeader';
import CampusGallery from '../components/campus/CampusGallery';
import CampusInfoCard from '../components/campus/CampusInfoCard';
import CampusTeachers from '../components/campus/CampusTeachers';

export default function CampusDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [campus, setCampus] = useState<Campus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getCampusBySlug(slug || '')
      .then((res) => {
        if (!cancelled) {
          const campusData = Array.isArray(res.data) ? res.data[0] : res.data;
          setCampus(campusData || null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[CampusDetailPage] 加载失败:', err);
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="pt-[120px] py-32 text-center text-muted-foreground">加载中...</div>
    );
  }

  if (error || !campus) {
    return (
      <div className="pt-[120px] py-32 text-center">
        <h1 className="text-2xl font-bold text-[#1C2B3A] mb-4">校区不存在</h1>
        <p className="text-muted-foreground mb-6">您访问的校区可能已关闭或链接有误。</p>
        <Link
          to="/campuses"
          className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-[#F5851F] text-white font-medium hover:bg-[#FF6B35] transition-colors"
        >
          返回校区总览
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-[120px] pb-16">
      <Seo seo={campus.seo} title={campus.name} description={campus.address} />
      <div className="max-w-[1400px] mx-auto px-8">
        <CampusDetailHeader campus={campus} />

        {/* 两列布局：图集 + 信息卡片 */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          <div className="lg:col-span-2">
            <CampusGallery campus={campus} />
          </div>
          <div className="lg:col-span-1">
            <CampusInfoCard campus={campus} />
          </div>
        </section>

        <CampusTeachers teachers={campus.teachers} />
      </div>
    </div>
  );
}
