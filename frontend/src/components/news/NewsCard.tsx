import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { getNewsCategoryLabel, type NewsArticle } from '../../lib/api';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

interface NewsCardProps {
  news: NewsArticle;
}

export default function NewsCard({ news }: NewsCardProps) {
  const { attributes } = news;
  const categoryLabel = attributes.category ? getNewsCategoryLabel(attributes.category) : '';
  const coverUrl = attributes.coverImage?.data?.attributes?.url;
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:1337';
  const fullCoverUrl = coverUrl ? `${apiUrl}${coverUrl}` : null;

  return (
    <Link
      to={`/news/${attributes.slug}`}
      className="group block bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E5E7EB] transition-all hover:shadow-lg hover:-translate-y-1"
    >
      {/* 封面图 */}
      {fullCoverUrl && (
        <div className="w-full aspect-[16/9] overflow-hidden bg-gray-100">
          <img
            src={fullCoverUrl}
            alt={attributes.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        </div>
      )}

      <div className="p-5">
        {/* 分类标签 + 日期 */}
        <div className="flex items-center gap-3 mb-3">
          {categoryLabel && (
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: '#FFF3E5', color: '#F5851F' }}
            >
              {categoryLabel}
            </span>
          )}
          {attributes.publishedAt && (
            <span className="flex items-center gap-1 text-xs text-[#9CA3AF]">
              <Calendar size={12} />
              {formatDate(attributes.publishedAt)}
            </span>
          )}
        </div>

        {/* 标题 */}
        <h3
          className="text-[#1C2B3A] font-bold mb-2 line-clamp-2 transition-colors group-hover:text-[#F5851F]"
          style={{ fontSize: '18px', lineHeight: 1.5 }}
        >
          {attributes.title}
        </h3>

        {/* 摘要 */}
        {attributes.excerpt && (
          <p className="text-[#6B7280] text-sm line-clamp-2" style={{ lineHeight: 1.6 }}>
            {attributes.excerpt}
          </p>
        )}
      </div>
    </Link>
  );
}
