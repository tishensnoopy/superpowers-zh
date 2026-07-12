import { getCampuses } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import CampusHeader from '@/components/campus/CampusHeader';
import CampusGrid from '@/components/campus/CampusGrid';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata(undefined, {
    title: '校区分布',
    description: '查看我们的各校区地址和联系方式，欢迎就近选择。',
  });
}

export default async function CampusOverviewPage() {
  const { data: campuses } = await getCampuses();

  return (
    <div
      className="pt-[120px] pb-16 min-h-screen"
      style={{ background: 'linear-gradient(to bottom, #FFF3E5, #ffffff)' }}
    >
      <div className="max-w-[1400px] mx-auto px-8">
        <CampusHeader />
        <CampusGrid campuses={campuses} />
      </div>
    </div>
  );
}
