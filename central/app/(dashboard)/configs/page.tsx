'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ConfigsContent() {
  const params = useSearchParams();
  const customerId = params.get('customerId');
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!customerId) return;
    fetch(`/api/admin/configs?customerId=${customerId}`).then((r) => r.json()).then((d) => setItems(d.items ?? []));
  }, [customerId]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">配置版本 {customerId ? `· 客户 ${customerId.slice(0,8)}` : ''}</h1>
      {!customerId && <p className="text-gray-500">请通过客户详情页进入。</p>}
      <ul>
        {items.map((c) => (
          <li key={c.id} className="border-b py-2">
            <Link href={`/configs/${c.id}`} className="text-blue-600">v{c.version}</Link>
            {c.published_at && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">已发布</span>}
            <span className="ml-2 text-sm text-gray-500">{new Date(c.created_at).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ConfigsPage() {
  return (
    <Suspense fallback={<div className="text-gray-500">加载中...</div>}>
      <ConfigsContent />
    </Suspense>
  );
}
