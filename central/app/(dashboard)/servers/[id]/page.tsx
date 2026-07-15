'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function ServerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [server, setServer] = useState<any>(null);

  useEffect(() => { fetch(`/api/admin/servers/${id}`).then((r) => r.json()).then(setServer); }, [id]);

  if (!server) return <p>加载中...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{server.hostname}</h1>
      <dl className="grid grid-cols-2 gap-2 max-w-lg">
        <dt className="font-bold">显示名</dt><dd>{server.display_name ?? '-'}</dd>
        <dt className="font-bold">状态</dt><dd>{server.status}</dd>
        <dt className="font-bold">Agent 版本</dt><dd>{server.agent_version ?? '-'}</dd>
        <dt className="font-bold">最后心跳</dt><dd>{server.last_heartbeat ? new Date(server.last_heartbeat).toLocaleString() : '-'}</dd>
      </dl>
    </div>
  );
}
