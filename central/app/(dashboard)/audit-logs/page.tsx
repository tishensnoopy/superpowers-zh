'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface AuditLog {
  id: string;
  admin_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip: string | null;
  user_agent: string | null;
  detail: Record<string, unknown>;
  ts: string;
}

const actionColor: Record<string, string> = {
  'login': 'bg-gray-100 text-gray-700',
  'customer:create': 'bg-green-100 text-green-700',
  'customer:update': 'bg-yellow-100 text-yellow-700',
  'customer:delete': 'bg-red-100 text-red-700',
  'config:publish': 'bg-blue-100 text-blue-700',
  'token:revoke': 'bg-red-100 text-red-700',
  'job:deploy': 'bg-purple-100 text-purple-700',
  'job:restart': 'bg-purple-100 text-purple-700',
  'job:status': 'bg-gray-100 text-gray-700',
  'job:logs': 'bg-gray-100 text-gray-700',
  'job:config-sync': 'bg-blue-100 text-blue-700',
  'agent:enroll': 'bg-yellow-100 text-yellow-700',
};

function AuditLogsList() {
  const params = useSearchParams();
  const [items, setItems] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [filterTargetType, setFilterTargetType] = useState(params.get('targetType') ?? '');
  const [filterAction, setFilterAction] = useState(params.get('action') ?? '');

  async function load() {
    const qs = new URLSearchParams();
    if (filterTargetType) qs.set('targetType', filterTargetType);
    if (filterAction) qs.set('action', filterAction);
    qs.set('limit', '200');
    const res = await fetch(`/api/admin/audit-logs?${qs}`);
    const data = await res.json();
    setItems(data.items ?? []);
    setTotal(data.total ?? 0);
  }

  useEffect(() => { load(); }, [filterTargetType, filterAction]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">审计日志（共 {total} 条）</h1>

      <div className="flex gap-2 mb-4">
        <select value={filterTargetType} onChange={(e) => setFilterTargetType(e.target.value)} className="border rounded px-2 py-1">
          <option value="">全部类型</option>
          <option value="customer">客户</option>
          <option value="config">配置</option>
          <option value="server">服务器</option>
          <option value="token">Token</option>
          <option value="job">任务</option>
          <option value="enrollment">Enrollment</option>
        </select>
        <input
          type="text"
          placeholder="action 过滤（如 login, customer:create）"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="border rounded px-2 py-1 flex-1"
        />
        <button onClick={load} className="bg-blue-600 text-white px-3 py-1 rounded">刷新</button>
      </div>

      <table className="w-full bg-white rounded shadow text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">时间</th>
            <th className="p-2 text-left">Action</th>
            <th className="p-2 text-left">管理员</th>
            <th className="p-2 text-left">目标</th>
            <th className="p-2 text-left">IP</th>
            <th className="p-2 text-left">详情</th>
          </tr>
        </thead>
        <tbody>
          {items.map((l) => (
            <tr key={l.id} className="border-t hover:bg-gray-50">
              <td className="p-2 whitespace-nowrap">{new Date(l.ts).toLocaleString()}</td>
              <td className="p-2">
                <span className={`text-xs px-2 py-0.5 rounded ${actionColor[l.action] ?? 'bg-gray-100'}`}>
                  {l.action}
                </span>
              </td>
              <td className="p-2 font-mono text-xs">{l.admin_id?.slice(0, 8) ?? '-'}</td>
              <td className="p-2 text-xs">{l.target_type ? `${l.target_type}/${l.target_id?.slice(0, 8)}` : '-'}</td>
              <td className="p-2 font-mono text-xs">{l.ip ?? '-'}</td>
              <td className="p-2 text-xs">
                {Object.keys(l.detail).length > 0
                  ? <pre className="text-xs overflow-x-auto max-w-xs">{JSON.stringify(l.detail)}</pre>
                  : '-'}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={6} className="p-4 text-center text-gray-500">无记录</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function AuditLogsPage() {
  return (
    <Suspense fallback={<p>加载中...</p>}>
      <AuditLogsList />
    </Suspense>
  );
}
