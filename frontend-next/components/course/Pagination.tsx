'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}

type PageItem = number | '...';

function getPageNumbers(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  if (page <= 4) {
    return [1, 2, 3, 4, 5, '...', pageCount];
  }

  if (page >= pageCount - 3) {
    return [1, '...', pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
  }

  return [1, '...', page - 1, page, page + 1, '...', pageCount];
}

export default function Pagination({ page, pageCount, onChange }: PaginationProps) {
  if (pageCount <= 1) {
    return null;
  }

  const pageNumbers = getPageNumbers(page, pageCount);
  const prevDisabled = page <= 1;
  const nextDisabled = page >= pageCount;

  const navButtonClass = (disabled: boolean) =>
    [
      'inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-all',
      disabled
        ? 'border-border text-muted-foreground/40 cursor-not-allowed bg-muted/30'
        : 'border-border text-[#4A5568] hover:border-[#F5851F] hover:text-[#F5851F] bg-card cursor-pointer',
    ].join(' ');

  const pageButtonClass = (active: boolean) =>
    [
      'inline-flex items-center justify-center min-w-9 h-9 px-2 rounded-lg text-sm font-medium transition-all',
      active
        ? 'text-white border border-transparent shadow-md'
        : 'text-[#4A5568] border border-border bg-card hover:border-[#F5851F] hover:text-[#F5851F] cursor-pointer',
    ].join(' ');

  const activeStyle = (active: boolean): React.CSSProperties =>
    active ? { background: 'linear-gradient(135deg, #F5851F, #FF6B35)' } : {};

  return (
    <div
      className="flex items-center gap-1.5"
      style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
    >
      <button
        type="button"
        aria-label="上一页"
        disabled={prevDisabled}
        className={navButtonClass(prevDisabled)}
        onClick={() => !prevDisabled && onChange(page - 1)}
      >
        <ChevronLeft size={16} />
      </button>

      {pageNumbers.map((item, idx) => {
        if (item === '...') {
          return (
            <span
              key={`ellipsis-${idx}`}
              className="inline-flex items-center justify-center w-9 h-9 text-muted-foreground text-sm"
            >
              ...
            </span>
          );
        }
        const isActive = item === page;
        return (
          <button
            key={item}
            type="button"
            className={pageButtonClass(isActive)}
            style={activeStyle(isActive)}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        );
      })}

      <button
        type="button"
        aria-label="下一页"
        disabled={nextDisabled}
        className={navButtonClass(nextDisabled)}
        onClick={() => !nextDisabled && onChange(page + 1)}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
