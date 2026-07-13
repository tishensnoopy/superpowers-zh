import { notFound } from 'next/navigation';
import { getCampuses, getCampusBySlug } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import CampusDetailHeader from '@/components/campus/CampusDetailHeader';
import CampusGallery from '@/components/campus/CampusGallery';
import CampusInfoCard from '@/components/campus/CampusInfoCard';
import CampusTeachers from '@/components/campus/CampusTeachers';
import CampusMap from '@/components/campus/CampusMap';
import type { Metadata } from 'next';

export const revalidate = 300;
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const { data: campuses } = await getCampuses().catch(() => ({ data: [] }));
  return campuses.map((campus) => ({ slug: campus.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await getCampusBySlug(slug).catch(() => ({ data: [] }));
  const campus = Array.isArray(data) ? data[0] : data;
  if (!campus) {
    return buildMetadata(undefined, { title: '校区详情', canonicalUrl: `/campuses/${slug}` });
  }
  return buildMetadata(campus.seo, {
    title: campus.name,
    description: campus.address,
    canonicalUrl: `/campuses/${slug}`,
  });
}

export default async function CampusDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const { data } = await getCampusBySlug(slug).catch(() => ({ data: [] }));
  const campus = Array.isArray(data) ? data[0] : data;

  if (!campus) {
    notFound();
  }

  return (
    <div className="pt-[120px] pb-16">
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

        <div className="mt-12">
          <CampusMap mapEmbed={campus.mapEmbed} />
        </div>
      </div>
    </div>
  );
}
