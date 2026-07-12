import { MapPin, Phone, Clock, Train, Ruler } from 'lucide-react';
import type { Campus } from '../../lib/api';

interface InfoRow {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value?: string;
}

export default function CampusInfoCard({ campus }: { campus: Campus }) {
  const { address, phone, businessHours, transportation, area } = campus;

  const rows: InfoRow[] = [
    { icon: MapPin, label: '地址', value: address },
    { icon: Phone, label: '联系电话', value: phone },
    { icon: Clock, label: '营业时间', value: businessHours },
    { icon: Train, label: '交通信息', value: transportation },
    { icon: Ruler, label: '教学面积', value: area },
  ];

  const visibleRows = rows.filter((row) => row.value);

  return (
    <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
      <h2
        className="text-[#1C2B3A] mb-5"
        style={{
          fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
          fontSize: '1.5rem',
          fontWeight: 700,
        }}
      >
        校区信息
      </h2>
      <ul className="space-y-4">
        {visibleRows.map((row) => {
          const Icon = row.icon;
          return (
            <li key={row.label} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#FFF3E5] flex items-center justify-center">
                <Icon size={18} className="text-[#F5851F]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground mb-0.5">{row.label}</div>
                <div className="text-sm text-[#1C2B3A] break-words">{row.value}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
