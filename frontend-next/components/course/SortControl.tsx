'use client';

import { ChevronDown } from 'lucide-react';

interface SortControlProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

const options = [
  { label: '默认排序', value: null },
  { label: '名称 A-Z', value: 'name:asc' },
  { label: '价格从低到高', value: 'price:asc' },
  { label: '价格从高到低', value: 'price:desc' },
];

export default function SortControl({ value, onChange }: SortControlProps) {
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
