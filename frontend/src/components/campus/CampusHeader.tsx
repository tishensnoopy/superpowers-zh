import { MapPin } from 'lucide-react';

// 校区总览页 Hero 区：固定标题与副标题
export default function CampusHeader() {
  return (
    <div className="text-center mb-12">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-sm mb-5">
        <MapPin size={28} className="text-[#F5851F]" />
      </div>
      <h1
        className="text-[#1C2B3A] mb-4"
        style={{
          fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
          fontSize: '2.5rem',
          fontWeight: 800,
        }}
      >
        八大校区 任您选择
      </h1>
      <p className="text-muted-foreground text-lg max-w-[640px] mx-auto">
        遍布北京城八区，就近选择优质教学
      </p>
    </div>
  );
}
