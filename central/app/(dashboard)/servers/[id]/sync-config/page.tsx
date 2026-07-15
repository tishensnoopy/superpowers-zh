'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function SyncConfigPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [envText, setEnvText] = useState('');
  const [restart, setRestart] = useState(true);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    let envVars: Record<string, string> = {};
    try {
      for (const line of envText.split('\n')) {
        const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
        if (m) envVars[m[1]] = m[2];
      }
    } catch {
      alert('env 格式错误');
      setBusy(false);
      return;
    }

    const res = await fetch(`/api/admin/servers/${id}/command`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'config-sync', envVars, restart }),
    });
    const body = await res.json();
    setBusy(false);
    if (res.ok) router.push(`/jobs/${body.jobId}`);
    else alert(`失败: ${body.error}`);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">同步配置到服务器</h1>
      <p className="text-sm text-gray-500">逐行输入 KEY=VALUE，会覆盖服务器上的 .env</p>
      <textarea
        className="w-full h-80 border p-2 font-mono text-sm"
        placeholder={'NEXT_PUBLIC_SITE_URL=https://...\nDATABASE_PASSWORD=...\nDASHSCOPE_API_KEY=...'}
        value={envText}
        onChange={(e) => setEnvText(e.target.value)}
      />
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={restart} onChange={(e) => setRestart(e.target.checked)} />
        <span>同步后自动重启 backend + frontend</span>
      </label>
      <button onClick={submit} disabled={busy} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
        {busy ? '下发中...' : '下发同步'}
      </button>
    </div>
  );
}
