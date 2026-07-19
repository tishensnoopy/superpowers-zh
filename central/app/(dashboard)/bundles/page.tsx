'use client';
import { useEffect, useState } from 'react';

interface Bundle {
  id: string;
  ref: string;
  size_bytes: number | null;
  status: 'building' | 'ready' | 'failed';
  error: string | null;
  created_at: string;
}

export default function BundlesPage() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [ref, setRef] = useState('main');
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const res = await fetch('/api/admin/bundles');
    if (res.ok) setBundles((await res.json()).bundles);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // building 状态轮询
    return () => clearInterval(t);
  }, []);

  async function build() {
    setBuilding(true);
    setError('');
    try {
      const res = await fetch('/api/admin/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref }),
      });
      if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? 'build failed');
      await load();
    } catch (e) {
      setError(`网络错误: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">发布包</h1>
      <div className="mb-4 space-x-2">
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="分支/tag/commit，如 main"
          className="border rounded px-3 py-1 text-sm w-64"
        />
        <button
          onClick={build}
          disabled={building}
          className="bg-blue-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
        >
          {building ? '构建中…' : '构建发布包'}
        </button>
        {error && <span role="alert" className="text-red-600 text-sm">{error}</span>}
      </div>
      <table className="w-full bg-white rounded shadow">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-3 text-left">Ref</th>
            <th className="p-3 text-left">大小</th>
            <th className="p-3 text-left">状态</th>
            <th className="p-3 text-left">错误</th>
            <th className="p-3 text-left">构建时间</th>
          </tr>
        </thead>
        <tbody>
          {bundles.map((b) => (
            <tr key={b.id} className="border-t hover:bg-gray-50">
              <td className="p-3">{b.ref}</td>
              <td className="p-3">{b.size_bytes ? `${(b.size_bytes / 1024 / 1024).toFixed(1)} MB` : '—'}</td>
              <td className="p-3">
                <span className={`text-xs px-2 py-0.5 rounded ${
                  b.status === 'ready' ? 'bg-green-100 text-green-700'
                  : b.status === 'failed' ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {b.status}
                </span>
              </td>
              <td className="p-3 text-sm text-gray-500">{b.error ?? '—'}</td>
              <td className="p-3 text-sm text-gray-500">{new Date(b.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
