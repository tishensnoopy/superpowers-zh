'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ServersPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/admin/servers').then((r) => r.json()).then((d) => setItems(d.items ?? []));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">服务器</h1>
      <table className="w-full bg-white rounded shadow">
        <thead className="bg-gray-100">
          <tr><th className="p-3 text-left">主机名</th><th className="p-3 text-left">显示名</th><th className="p-3 text-left">状态</th><th className="p-3 text-left">最后心跳</th></tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id} className="border-t hover:bg-gray-50">
              <td className="p-3"><Link href={`/servers/${s.id}`} className="text-blue-600">{s.hostname}</Link></td>
              <td className="p-3">{s.display_name ?? '-'}</td>
              <td className="p-3">
                <span className={`text-xs px-2 py-0.5 rounded ${s.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
                  {s.status}
                </span>
              </td>
              <td className="p-3 text-sm text-gray-500">{s.last_heartbeat ? new Date(s.last_heartbeat).toLocaleString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
