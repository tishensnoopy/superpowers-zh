'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Customer { id: string; name: string; contact_name: string | null; contact_phone: string | null; }

export default function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/customers').then((r) => r.json()).then((d) => {
      setItems(d.items ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">客户</h1>
        <Link href="/customers/new" className="bg-blue-600 text-white px-4 py-2 rounded">新建客户</Link>
      </div>
      {loading ? <p>加载中...</p> : (
        <table className="w-full bg-white rounded shadow">
          <thead className="bg-gray-100">
            <tr><th className="p-3 text-left">名称</th><th className="p-3 text-left">联系人</th><th className="p-3 text-left">电话</th></tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t hover:bg-gray-50">
                <td className="p-3"><Link href={`/customers/${c.id}`} className="text-blue-600">{c.name}</Link></td>
                <td className="p-3">{c.contact_name ?? '-'}</td>
                <td className="p-3">{c.contact_phone ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
