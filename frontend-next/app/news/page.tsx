import Link from 'next/link';
import { getNews } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import NewsCard from '@/components/news/NewsCard';
import type { Metadata } from 'next';

export const revalidate = 300;

const CATEGORIES = [
  { value: '', label: '全部' },
  { value: 'company_news', label: '公司动态' },
  { value: 'industry_news', label: '行业资讯' },
  { value: 'event_notice', label: '活动通知' },
];

interface PageProps {
  searchParams: Promise<{ category?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata(undefined, {
    title: '新闻动态',
    description: '了解我们的最新动态、行业资讯和活动通知。',
    canonicalUrl: '/news',
  });
}

export default async function NewsListPage({ searchParams }: PageProps) {
  const { category } = await searchParams;
  const activeCategory = category || '';
  const { data: news } = await getNews(activeCategory || undefined).catch(() => ({ data: [] as never[] }));

  return (
    <div className="pt-[72px] pb-16 min-h-screen" style={{ background: '#FAFAFA' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 页面标题 */}
        <div className="py-12 text-center">
          <h1
            className="text-[#1C2B3A] mb-4"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 800,
            }}
          >
            新闻动态
          </h1>
          <p className="text-[#6B7280] text-base sm:text-lg">
            了解最新教育资讯与校区活动
          </p>
        </div>

        {/* 分类筛选 */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.value;
            const href = cat.value ? `/news?category=${cat.value}` : '/news';
            return (
              <Link
                key={cat.value}
                href={href}
                data-active={isActive ? 'true' : 'false'}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                  isActive
                    ? 'text-white shadow-md'
                    : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#F5851F] hover:text-[#F5851F]'
                }`}
                style={isActive ? { background: '#F5851F' } : {}}
              >
                {cat.label}
              </Link>
            );
          })}
        </div>

        {/* 新闻卡片网格 */}
        {news.length === 0 ? (
          <div className="text-center py-20 text-[#9CA3AF]">
            <p className="text-lg">暂无新闻内容</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.map((item) => (
              <NewsCard key={item.id} news={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
