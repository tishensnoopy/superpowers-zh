'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function JobsPage() {
  const params = useSearchParams();
  const serverId = params.get('serverId');
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    const url = '/api/admin/jobs' + (serverId ? `?serverId=${serverId}` : '');
    fetch(url).then((r) => r.json()).then((d) => setItems(d.items ?? []));
  }, [serverId]);

  const statusColor: Record<string, string> = {
    queued: 'bg-gray-100 text-gray-700',
    running: 'bg-yellow-100 text-yellow-700',
    success: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">任务历史</h1>
      <table className="w-full bg-white rounded shadow">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-3 text-left">类型</th>
            <th className="p-3 text-left">状态</th>
            <th className="p-3 text-left">开始时间</th>
            <th className="p-3 text-left">耗时</th>
          </tr>
        </thead>
        <tbody>
          {items.map((j) => (
            <tr key={j.id} className="border-t hover:bg-gray-50">
              <td className="p-3"><Link href={`/jobs/${j.id}`} className="text-blue-600">{j.type}</Link></td>
              <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded ${statusColor[j.status] ?? ''}`}>{j.status}</span></td>
              <td className="p-3 text-sm">{j.started_at ? new Date(j.started_at).toLocaleString() : '-'}</td>
              <td className="p-3 text-sm">
                {j.started_at && j.finished_at
                  ? `${Math.round((new Date(j.finished_at).getTime() - new Date(j.started_at).getTime()) / 1000)}s`
                  : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
