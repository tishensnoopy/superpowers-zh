'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  const t = useTranslations('courses');
  return (
    <div className="relative w-full">
      <Search
        size={18}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t('searchPlaceholder')}
        className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--brand-primary,#F5851F)] focus:ring-2 focus:ring-[var(--brand-primary,#F5851F)]/20 transition-all"
        style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
      />
    </div>
  );
}
