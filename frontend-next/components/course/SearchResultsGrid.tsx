'use client';

import Link from 'next/link';
import { AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import type { Product } from '@/lib/api';
import { useTranslations } from 'next-intl';

interface SearchResultsGridProps {
  results: Product[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}

function SkeletonCard() {
  return (
    <div className="col-span-12 sm:col-span-6 lg:col-span-3">
      <div className="h-full bg-card rounded-2xl overflow-hidden border border-border shadow-sm flex flex-col">
        <div className="p-6 border-b border-border animate-pulse" style={{ background: '#EFF6FF' }}>
          <div className="text-4xl mb-4 opacity-30">📚</div>
          <div className="h-6 bg-gray-200 rounded animate-pulse w-3/4" />
        </div>
        <div className="p-6 flex-1 flex flex-col">
          <div className="h-4 bg-gray-200 rounded animate-pulse mb-3 w-full" />
          <div className="h-4 bg-gray-200 rounded animate-pulse mb-5 w-2/3" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
          </div>
          <div className="mt-6 h-4 bg-gray-200 rounded animate-pulse w-1/4" />
        </div>
      </div>
    </div>
  );
}

export default function SearchResultsGrid({ results, loading, error, onRetry }: SearchResultsGridProps) {
  const t = useTranslations('courses');
  const specLabels: Record<string, string> = {
    course_hours: t('specCourseHours'),
    class_size: t('specClassSize'),
    age_range: t('specAgeRange'),
    duration: t('specDuration'),
  };

  if (loading) {
    return (
      <div className="grid grid-cols-12 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 text-center"
        style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
      >
        <AlertCircle size={48} className="text-[#FF6B35] mb-4" />
        <p className="text-[#1C2B3A] text-lg font-medium mb-2">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all hover:shadow-lg"
          style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
        >
          <RefreshCw size={14} />
          {t('retry')}
        </button>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 text-center"
        style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
      >
        <div className="text-5xl mb-4 opacity-40">🔍</div>
        <p className="text-[#1C2B3A] text-lg font-medium mb-2">{t('noResults')}</p>
        <p className="text-muted-foreground text-sm">{t('noResultsHint')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      {results.map((product) => {
        const specValues = product.specValues || {};
        return (
          <div key={product.id} className="col-span-12 sm:col-span-6 lg:col-span-3">
            <div className="h-full bg-card rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col">
              <div className="p-6 border-b border-border" style={{ background: '#EFF6FF' }}>
                <div className="text-4xl mb-4">📚</div>
                <h3
                  className="text-xl font-bold text-[#1C2B3A]"
                  style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
                >
                  {product.name}
                </h3>
              </div>

              <div className="p-6 flex-1 flex flex-col">
                <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                  {product.shortDescription || product.description}
                </p>
                {specValues && Object.keys(specValues).length > 0 && (
                  <ul className="space-y-2 flex-1">
                    {Object.entries(specValues).map(([key, value]) => (
                      <li key={key} className="flex items-center gap-2 text-sm text-[#4A5568]">
                        <CheckCircle size={14} style={{ color: '#2563EB' }} className="shrink-0" />
                        {specLabels[key] || key}: {String(value)}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-6 flex items-center justify-between">
                  <Link
                    href={`/courses/${product.slug}`}
                    className="text-xs text-muted-foreground hover:text-[#2563EB] flex items-center gap-1 transition-colors"
                  >
                    <Clock size={12} /> {t('viewDetails')}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
