'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const TABS = ['brand', 'ai', 'deployment', 'envOverrides'] as const;
type Tab = typeof TABS[number];

export default function ConfigDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [config, setConfig] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('brand');
  const [draft, setDraft] = useState<Record<string, any>>({});

  useEffect(() => {
    fetch(`/api/admin/configs/${id}`).then((r) => r.json()).then((c) => {
      setConfig(c);
      setDraft({
        brand: c.brand ?? {},
        ai: c.ai ?? {},
        deployment: c.deployment ?? {},
        envOverrides: c.env_overrides ?? {},
      });
    });
  }, [id]);

  async function save() {
    const res = await fetch(`/api/admin/configs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    if (res.ok) alert('已保存');
    else alert('保存失败: ' + (await res.json()).error);
  }

  async function publish() {
    if (!confirm('发布后不可修改，确认？')) return;
    const res = await fetch(`/api/admin/configs/${id}/publish`, { method: 'POST' });
    if (res.ok) location.reload();
    else alert('发布失败');
  }

  if (!config) return <p>加载中...</p>;
  const isPublished = !!config.published_at;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">配置 v{config.version}</h1>
        {isPublished ? (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">已发布</span>
        ) : (
          <div className="space-x-2">
            <button onClick={save} className="bg-gray-600 text-white px-3 py-1 rounded text-sm">保存草稿</button>
            <button onClick={publish} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">发布</button>
          </div>
        )}
      </div>
      <div className="flex border-b">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 ${tab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
            {t}
          </button>
        ))}
      </div>
      <textarea
        className="w-full h-96 border p-2 font-mono text-sm"
        value={JSON.stringify(draft[tab], null, 2)}
        onChange={(e) => {
          try { setDraft({ ...draft, [tab]: JSON.parse(e.target.value) }); } catch {}
        }}
        disabled={isPublished}
      />
    </div>
  );
}
