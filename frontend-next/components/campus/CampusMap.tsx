import { MapPin } from 'lucide-react';

interface CampusMapProps {
  mapEmbed?: string | null;
}

export default function CampusMap({ mapEmbed }: CampusMapProps) {
  return (
    <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
      <h2
        className="text-[#1C2B3A] mb-5 flex items-center gap-2"
        style={{
          fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
          fontSize: '1.5rem',
          fontWeight: 700,
        }}
      >
        <MapPin size={22} className="text-[#F5851F]" />
        校区地图
      </h2>
      {mapEmbed ? (
        <div
          className="w-full overflow-hidden rounded-xl border border-border"
          dangerouslySetInnerHTML={{ __html: mapEmbed }}
        />
      ) : (
        <div className="w-full h-64 flex flex-col items-center justify-center bg-muted/30 rounded-xl border border-dashed border-border text-muted-foreground">
          <MapPin size={40} className="mb-3 opacity-40" />
          <p className="text-sm">暂无地图信息</p>
          <p className="text-xs mt-1 opacity-70">请查看上方地址信息或致电校区咨询</p>
        </div>
      )}
    </div>
  );
}
