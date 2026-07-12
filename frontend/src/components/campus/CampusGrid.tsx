import { MapPin } from 'lucide-react';
import type { Campus } from '../../lib/api';
import CampusCard from './CampusCard';

// 校区卡片网格：4 列（桌面）/ 3 列（平板）/ 2 列（小平板）/ 1 列（手机）
export default function CampusGrid({ campuses }: { campuses: Campus[] }) {
  if (campuses.length === 0) {
    return (
      <div className="py-32 text-center">
        <MapPin size={40} className="mx-auto mb-4 text-muted-foreground opacity-40" />
        <p className="text-muted-foreground">校区信息更新中，敬请期待</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {campuses.map((campus) => (
        <CampusCard key={campus.id} campus={campus} />
      ))}
    </div>
  );
}
