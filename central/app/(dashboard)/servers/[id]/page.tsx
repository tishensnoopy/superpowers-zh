'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function ServerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [server, setServer] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/servers/${id}`).then((r) => r.json()).then(setServer);
  }, [id]);

  async function sendCommand(type: string, extra: any = {}) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/servers/${id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...extra }),
      });
      const body = await res.json();
      if (res.ok) {
        alert(`任务已下发，jobId: ${body.jobId}`);
        // 跳转到任务详情
        window.open(`/jobs/${body.jobId}`, '_blank');
      } else {
        alert(`失败: ${body.error}`);
      }
    } catch (e) {
      alert(`网络错误: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function viewLogs() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/servers/${id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'logs', service: 'backend', tail: 200 }),
      });
      const body = await res.json();
      if (res.ok) {
        // 跳转到任务详情查看日志
        window.open(`/jobs/${body.jobId}`, '_blank');
      } else {
        alert(`失败: ${body.error}`);
      }
    } catch (e) {
      alert(`网络错误: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  if (!server) return <p>加载中...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{server.hostname}</h1>
      <dl className="grid grid-cols-2 gap-2 max-w-lg">
        <dt className="font-bold">显示名</dt><dd>{server.display_name ?? '-'}</dd>
        <dt className="font-bold">状态</dt>
        <dd>
          <span className={`text-xs px-2 py-0.5 rounded ${server.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
            {server.status}
          </span>
        </dd>
        <dt className="font-bold">Agent 版本</dt><dd>{server.agent_version ?? '-'}</dd>
        <dt className="font-bold">最后心跳</dt><dd>{server.last_heartbeat ? new Date(server.last_heartbeat).toLocaleString() : '-'}</dd>
      </dl>

      <section>
        <h2 className="text-lg font-bold mb-2">操作</h2>
        <div className="space-x-2">
          <button disabled={busy} onClick={() => sendCommand('status')}
            className="bg-gray-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50">
            查看状态
          </button>
          <button disabled={busy} onClick={viewLogs}
            className="bg-gray-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50">
            查看日志
          </button>
          <button disabled={busy} onClick={() => {
            const services = prompt('重启哪些服务？（逗号分隔）', 'backend');
            if (services === null) return;  // 用户点取消
            sendCommand('restart', { services: services.split(',').map((s) => s.trim()) });
          }} className="bg-yellow-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50">
            重启服务
          </button>
          <button
            disabled={busy || server?.status !== 'online'}
            onClick={async () => {
              if (!confirm('确认触发部署？这将执行 git pull + docker compose up --build，预计需要 3-5 分钟。')) return;
              const mode = confirm('使用 Nginx 模式？取消则用直连模式。') ? 'nginx' : 'direct';
              setBusy(true);
              try {
                const res = await fetch(`/api/admin/servers/${id}/deploy`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ mode }),
                });
                const body = await res.json();
                if (res.ok) {
                  window.open(`/jobs/${body.jobId}`, '_blank');
                } else {
                  alert(`部署失败: ${body.error}`);
                }
              } catch (e) {
                alert(`网络错误: ${e instanceof Error ? e.message : String(e)}`);
              } finally {
                setBusy(false);
              }
            }}
            className="bg-green-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
          >
            部署
          </button>
          <Link href={`/servers/${id}/sync-config`}
            className="inline-block bg-blue-600 text-white px-3 py-1 rounded text-sm">
            同步配置
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2"><Link href={`/jobs?serverId=${id}`} className="text-blue-600">任务历史 →</Link></h2>
      </section>
    </div>
  );
}
