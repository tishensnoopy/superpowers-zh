'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface SortControlProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export default function SortControl({ value, onChange }: SortControlProps) {
  const t = useTranslations('courses');
  const options = [
    { label: t('sortDefault'), value: null },
    { label: t('sortNameAsc'), value: 'name:asc' },
    { label: t('sortPriceAsc'), value: 'price:asc' },
    { label: t('sortPriceDesc'), value: 'price:desc' },
  ];

  return (
    <div className="relative inline-block">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        className="appearance-none pl-4 pr-10 py-2 rounded-xl border border-border bg-card text-[#4A5568] text-sm cursor-pointer focus:outline-none focus:border-[#F5851F] focus:ring-2 focus:ring-[#F5851F]/20 transition-all"
        style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
      >
        {options.map((opt) => (
          <option key={opt.label} value={opt.value ?? ''}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
      />
    </div>
  );
}
