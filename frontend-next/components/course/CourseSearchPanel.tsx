'use client';

import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useProductSearch } from '@/hooks/useProductSearch';
import { getProductCategories } from '@/lib/api';
import type { ProductCategory } from '@/lib/api';
import Seo from '@/components/Seo';
import SearchBar from './SearchBar';
import CategoryFilter from './CategoryFilter';
import SortControl from './SortControl';
import SearchResultsGrid from './SearchResultsGrid';
import Pagination from './Pagination';

interface CourseSearchPanelProps {
  title?: string;
  description?: string;
}

export default function CourseSearchPanel({
  title = '课程体系',
  description = '由资深教研团队研发，严格对标小学课程标准，让孩子学得快乐、学得扎实。',
}: CourseSearchPanelProps) {
  const search = useProductSearch(12);
  const [categories, setCategories] = useState<ProductCategory[]>([]);

  useEffect(() => {
    getProductCategories()
      .then((res) => setCategories(res.data || []))
      .catch((err) => console.error('Failed to load categories:', err));
  }, []);

  return (
    <div className="pt-[120px]">
      <Seo title={title} description={description} />

      <section className="py-24" style={{ background: 'linear-gradient(180deg, #F8F9FF 0%, #FFFCF8 100%)' }}>
        <div className="max-w-[1400px] mx-auto px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EFF6FF] text-[#2563EB] text-sm font-medium mb-5">
              <BookOpen size={14} />
              课程体系
            </div>
            <h2
              className="text-[#1C2B3A] mb-4"
              style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif", fontSize: '2.25rem', fontWeight: 800 }}
            >
              {title}
            </h2>
            <p className="text-muted-foreground text-base max-w-[560px] mx-auto leading-relaxed">
              {description}
            </p>
          </div>

          <div className="mb-6 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
            <div className="flex-1">
              <SearchBar value={search.query} onChange={search.setQuery} />
            </div>
            <SortControl value={search.sort} onChange={search.setSort} />
          </div>

          {categories.length > 0 && (
            <div className="mb-8">
              <CategoryFilter
                categories={categories}
                selected={search.category}
                onChange={search.setCategory}
              />
            </div>
          )}

          <SearchResultsGrid
            results={search.results}
            loading={search.loading}
            error={search.error}
            onRetry={search.reset}
          />

          <div className="mt-8 flex justify-center">
            <Pagination
              page={search.page}
              pageCount={search.pageCount}
              onChange={search.setPage}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
