import { Link } from '@/i18n/navigation';
import { Calendar } from 'lucide-react';
import StrapiImage from '@/components/ui/StrapiImage';
import { getNewsCategoryLabel, type NewsArticle } from '@/lib/api';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

interface NewsCardProps {
  news: NewsArticle;
}

export default function NewsCard({ news }: NewsCardProps) {
  const { category, coverImage, slug, title, excerpt, publishedAt } = news;
  const categoryLabel = category ? getNewsCategoryLabel(category) : '';

  return (
    <Link
      href={`/news/${slug}`}
      className="group block bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E5E7EB] transition-all hover:shadow-lg hover:-translate-y-1"
    >
      {/* 封面图 */}
      {coverImage?.url && (
        <div className="relative w-full aspect-[16/9] overflow-hidden bg-gray-100">
          <StrapiImage
            src={coverImage}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform group-hover:scale-105"
          />
        </div>
      )}

      <div className="p-5">
        {/* 分类标签 + 日期 */}
        <div className="flex items-center gap-3 mb-3">
          {categoryLabel && (
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: '#FFF3E5', color: 'var(--brand-primary,#F5851F)' }}
            >
              {categoryLabel}
            </span>
          )}
          {publishedAt && (
            <span className="flex items-center gap-1 text-xs text-[#9CA3AF]">
              <Calendar size={12} />
              {formatDate(publishedAt)}
            </span>
          )}
        </div>

        {/* 标题 */}
        <h3
          className="text-[var(--brand-dark,#1C2B3A)] font-bold mb-2 line-clamp-2 transition-colors group-hover:text-[var(--brand-primary,#F5851F)]"
          style={{ fontSize: '18px', lineHeight: 1.5 }}
        >
          {title}
        </h3>

        {/* 摘要 */}
        {excerpt && (
          <p className="text-[#6B7280] text-sm line-clamp-2" style={{ lineHeight: 1.6 }}>
            {excerpt}
          </p>
        )}
      </div>
    </Link>
  );
}
