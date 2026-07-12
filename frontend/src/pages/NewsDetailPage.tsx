import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Eye, ArrowLeft, Home } from 'lucide-react';
import { getNewsBySlug, getNewsCategoryLabel, type NewsArticle } from '../lib/api';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatViewCount(count: number): string {
  return count.toLocaleString();
}

export default function NewsDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [news, setNews] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    getNewsBySlug(slug)
      .then((res) => {
        if (!cancelled) {
          setNews(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[NewsDetailPage] 加载失败:', err);
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
      <div className="pt-[120px] pb-32 min-h-screen text-center text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (error || !news) {
    return (
      <div className="pt-[120px] pb-32 min-h-screen text-center">
        <h2 className="text-2xl font-bold text-[#1C2B3A] mb-4">加载失败</h2>
        <p className="text-muted-foreground mb-6">新闻内容加载出错，请稍后重试。</p>
        <Link to="/news" className="inline-flex items-center gap-2 text-[#F5851F] font-medium">
          <ArrowLeft size={16} /> 返回新闻列表
        </Link>
      </div>
    );
  }

  const { attributes } = news;
  const categoryLabel = attributes.category ? getNewsCategoryLabel(attributes.category) : '';
  const coverUrl = attributes.coverImage?.data?.attributes?.url;
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:1337';
  const fullCoverUrl = coverUrl ? `${apiUrl}${coverUrl}` : null;

  return (
    <div className="pt-[72px] pb-16 min-h-screen" style={{ background: '#FAFAFA' }}>
      <div className="max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8">

        {/* 面包屑导航 */}
        <nav className="flex items-center gap-2 py-6 text-sm text-[#9CA3AF]">
          <Link to="/" className="flex items-center gap-1 hover:text-[#F5851F] transition-colors">
            <Home size={14} /> 首页
          </Link>
          <span>/</span>
          <Link to="/news" className="hover:text-[#F5851F] transition-colors">
            新闻动态
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
            {attributes.title}
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
            {attributes.publishedAt && (
              <span className="flex items-center gap-1.5 text-sm text-[#9CA3AF]">
                <Calendar size={14} />
                {formatDate(attributes.publishedAt)}
              </span>
            )}
            {attributes.viewCount !== undefined && (
              <span className="flex items-center gap-1.5 text-sm text-[#9CA3AF]">
                <Eye size={14} />
                {formatViewCount(attributes.viewCount)} 次阅读
              </span>
            )}
          </div>

          {/* 3. 封面图 */}
          {fullCoverUrl && (
            <div className="w-full mb-8 overflow-hidden rounded-2xl">
              <img
                src={fullCoverUrl}
                alt={attributes.title}
                className="w-full h-auto object-cover"
                style={{ maxHeight: '400px' }}
              />
            </div>
          )}

          {/* 4. 正文内容 */}
          {attributes.content && (
            <div
              className="text-[#374151] leading-relaxed prose prose-lg max-w-none"
              style={{ fontSize: '16px', lineHeight: 1.8 }}
              dangerouslySetInnerHTML={{ __html: attributes.content }}
            />
          )}

          {/* 5. 返回列表链接 */}
          <div className="mt-12 pt-6 border-t border-[#E5E7EB] text-center">
            <Link
              to="/news"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-all hover:scale-105"
              style={{ background: '#FFF3E5', color: '#F5851F' }}
            >
              <ArrowLeft size={16} /> 返回新闻列表
            </Link>
          </div>
        </article>

      </div>
    </div>
  );
}
