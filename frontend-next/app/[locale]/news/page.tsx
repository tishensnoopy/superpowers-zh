import Link from 'next/link';
import { getNews, type Locale } from '@/lib/api';
import { buildMetadata, buildJsonLd, buildBreadcrumbSchema } from '@/lib/seo';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import NewsCard from '@/components/news/NewsCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';

export const revalidate = 300;

const CATEGORIES = [
  { value: '', label: 'all' },
  { value: 'company_news', label: 'companyNews' },
  { value: 'industry_news', label: 'industryNews' },
  { value: 'event_notice', label: 'eventNotice' },
];

const PAGE_SIZE = 9;

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; page?: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('news');
  return buildMetadata(undefined, {
    title: t('title'),
    description: t('description'),
    canonicalUrl: '/news',
  }, { locale: locale as 'zh-CN' | 'en-US', path: '/news' });
}

export default async function NewsListPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = useTranslations('news');
  const tNav = useTranslations('navigation');
  const { category, page } = await searchParams;
  const activeCategory = category || '';
  const currentPage = Math.max(1, parseInt(page || '1', 10) || 1);
  const { data: news } = await getNews(locale as Locale, activeCategory || undefined).catch(() => ({ data: [] as never[] }));

  const totalItems = news.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const pageNews = news.slice(startIndex, endIndex);

  const buildPageHref = (pageNum: number) => {
    const params = new URLSearchParams();
    if (activeCategory) params.set('category', activeCategory);
    if (pageNum > 1) params.set('page', String(pageNum));
    const qs = params.toString();
    return qs ? `/news?${qs}` : '/news';
  };

  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: tNav('home'), url: '/' },
      { name: tNav('news'), url: '/news' },
    ],
    locale as Locale
  );

  return (
    <div className="pt-[120px] pb-16 min-h-screen" style={{ background: '#FAFAFA' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(breadcrumbSchema) }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-12 text-center">
          <h1
            className="text-[#1C2B3A] mb-4"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 800,
            }}
          >
            {t('title')}
          </h1>
          <p className="text-[#6B7280] text-base sm:text-lg">
            {t('subtitle')}
          </p>
        </div>

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
                {t(cat.label)}
              </Link>
            );
          })}
        </div>

        {pageNews.length === 0 ? (
          <div className="text-center py-20 text-[#9CA3AF]">
            <p className="text-lg">{t('empty')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {pageNews.map((item) => (
                <NewsCard key={item.id} news={item} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                {safeCurrentPage > 1 && (
                  <Link
                    href={buildPageHref(safeCurrentPage - 1)}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-white border border-[#E5E7EB] text-sm text-[#6B7280] hover:border-[#F5851F] hover:text-[#F5851F] transition-colors"
                  >
                    <ChevronLeft size={16} /> {t('prevPage')}
                  </Link>
                )}

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <Link
                    key={pageNum}
                    href={buildPageHref(pageNum)}
                    className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-sm font-semibold transition-all ${
                      pageNum === safeCurrentPage
                        ? 'text-white shadow-md'
                        : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#F5851F] hover:text-[#F5851F]'
                    }`}
                    style={pageNum === safeCurrentPage ? { background: '#F5851F' } : {}}
                  >
                    {pageNum}
                  </Link>
                ))}

                {safeCurrentPage < totalPages && (
                  <Link
                    href={buildPageHref(safeCurrentPage + 1)}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-white border border-[#E5E7EB] text-sm text-[#6B7280] hover:border-[#F5851F] hover:text-[#F5851F] transition-colors"
                  >
                    {t('nextPage')} <ChevronRight size={16} />
                  </Link>
                )}
              </div>
            )}

            <div className="text-center text-sm text-[#9CA3AF] mt-6">
              {t('paginationInfo', { current: safeCurrentPage, total: totalPages, count: totalItems })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
