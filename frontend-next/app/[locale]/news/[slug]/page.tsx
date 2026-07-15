import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Calendar, Eye, ArrowLeft, Home } from 'lucide-react';
import { getNews, getNewsBySlug, getNewsCategoryLabel, getImageUrl, getSiteSettings, type Locale } from '@/lib/api';
import { buildMetadata, buildJsonLd, buildNewsArticleSchema, buildBreadcrumbSchema } from '@/lib/seo';
import StrapiImage from '@/components/ui/StrapiImage';
import type { Metadata } from 'next';

export const revalidate = 300;
export const dynamicParams = false;

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatViewCount(count: number): string {
  return count.toLocaleString();
}

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  const { data: newsList } = await getNews().catch(() => ({ data: [] }));
  return newsList.flatMap((news) => [
    { locale: 'zh-CN', slug: news.slug },
    { locale: 'en-US', slug: news.slug },
  ]);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const { data: news } = await getNewsBySlugSafe(slug, locale as Locale);
  const tNews = await getTranslations('news');
  if (!news) {
    return buildMetadata(undefined, { title: tNews('title'), canonicalUrl: `/news/${slug}` }, { locale: locale as 'zh-CN' | 'en-US', path: `/news/${slug}` });
  }

  const metadata = buildMetadata(news.seo, {
    title: news.title,
    description: news.excerpt,
    canonicalUrl: `/news/${slug}`,
  }, { locale: locale as 'zh-CN' | 'en-US', path: `/news/${slug}` });

  const coverUrl = getImageUrl(news.coverImage);

  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: 'article',
      images: coverUrl ? [coverUrl] : metadata.openGraph?.images,
    },
  };
}

async function getNewsBySlugSafe(slug: string, locale: Locale) {
  try {
    const result = await getNewsBySlug(slug, locale);
    return { data: result.data };
  } catch {
    return { data: null };
  }
}

export default async function NewsDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const { data: news } = await getNewsBySlugSafe(slug, locale as Locale);

  if (!news) {
    notFound();
  }

  const { title, content, coverImage, category, publishedAt, viewCount } = news;
  const categoryLabel = category ? getNewsCategoryLabel(category) : '';

  const { data: settingsData } = await getSiteSettings(locale as Locale).catch(() => ({ data: [] as never[] }));
  const settings = Array.isArray(settingsData) ? settingsData[0] : settingsData;
  const tSeo = useTranslations('seo');
  const tNav = useTranslations('navigation');
  const tNews = useTranslations('news');
  const newsSettings = settings || { name: tSeo('siteNameZh') };

  const newsSchema = buildNewsArticleSchema(news, newsSettings, locale as Locale);
  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: tNav('home'), url: '/' },
      { name: tNav('news'), url: '/news' },
      { name: news.title, url: `/news/${news.slug}` },
    ],
    locale as Locale
  );

  return (
    <div className="pt-[120px] pb-16 min-h-screen" style={{ background: '#FAFAFA' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(newsSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(breadcrumbSchema) }}
      />
      <div className="max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* 面包屑导航 */}
        <nav className="flex items-center gap-2 py-6 text-sm text-[#9CA3AF]">
          <Link href="/" className="flex items-center gap-1 hover:text-[#F5851F] transition-colors">
            <Home size={14} /> {tNav('home')}
          </Link>
          <span>/</span>
          <Link href="/news" className="hover:text-[#F5851F] transition-colors">
            {tNav('news')}
          </Link>
          {categoryLabel && (
            <>
              <span>/</span>
              <span>{categoryLabel}</span>
            </>
          )}
        </nav>

        <article>
          {/* 1. 新闻标题 */}
          <h1
            className="text-[#1C2B3A] mb-4 leading-tight"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: 'clamp(1.5rem, 4vw, 2rem)',
              fontWeight: 800,
            }}
          >
            {title}
          </h1>

          {/* 2. 元信息区 */}
          <div className="flex flex-wrap items-center gap-4 pb-6 border-b border-[#E5E7EB] mb-8">
            {categoryLabel && (
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
                style={{ background: '#FFF3E5', color: '#F5851F' }}
              >
                {categoryLabel}
              </span>
            )}
            {publishedAt && (
              <span className="flex items-center gap-1.5 text-sm text-[#9CA3AF]">
                <Calendar size={14} />
                {formatDate(publishedAt)}
              </span>
            )}
            {viewCount !== undefined && (
              <span className="flex items-center gap-1.5 text-sm text-[#9CA3AF]">
                <Eye size={14} />
                {formatViewCount(viewCount)} {tNews('viewsCount')}
              </span>
            )}
          </div>

          {/* 3. 封面图 */}
          {coverImage?.url && (
            <div className="w-full mb-8 overflow-hidden rounded-2xl">
              <StrapiImage
                src={coverImage}
                alt={title}
                width={1200}
                height={400}
                sizes="(max-width: 800px) 100vw, 800px"
                className="w-full h-auto object-cover"
                priority
              />
            </div>
          )}

          {/* 4. 正文内容 */}
          {content && (
            <div
              className="text-[#374151] leading-relaxed prose prose-lg max-w-none"
              style={{ fontSize: '16px', lineHeight: 1.8 }}
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )}

          {/* 5. 返回列表链接 */}
          <div className="mt-12 pt-6 border-t border-[#E5E7EB] text-center">
            <Link
              href="/news"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-all hover:scale-105"
              style={{ background: '#FFF3E5', color: '#F5851F' }}
            >
              <ArrowLeft size={16} /> {tNews('backToList')}
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
