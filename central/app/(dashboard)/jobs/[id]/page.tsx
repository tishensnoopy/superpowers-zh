'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';

interface JobLog {
  ts: string;
  stream: string;
  line: string;
}

interface Job {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled';
  server_id: string;
  started_at: string | null;
  finished_at: string | null;
  exit_code: number | null;
  error_message: string | null;
  logs?: JobLog[];
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [progress, setProgress] = useState<{ stage: string; message: string } | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // 1. 初始加载 job 快照
  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/jobs/${id}`).then((r) => r.json()).then((j: Job) => {
      setJob(j);
      if (j.logs) setLogs(j.logs);
    });
  }, [id]);

  // 2. SSE 订阅实时更新
  useEffect(() => {
    if (!id) return;
    // 只对未完成的 job 订阅
    if (job && ['success', 'failed', 'cancelled'].includes(job.status)) return;

    const es = new EventSource(`/api/admin/jobs/${id}/stream`);
    es.onopen = () => setStreamConnected(true);
    es.onerror = () => setStreamConnected(false);

    es.addEventListener('job:snapshot', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setJob((prev) => prev ? { ...prev, ...data } : data);
    });

    es.addEventListener('job:log', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setLogs((prev) => [...prev, data]);
    });

    es.addEventListener('job:progress', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setProgress(data);
    });

    es.addEventListener('job:update', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setJob((prev) => prev ? { ...prev, ...data } : data);
      if (['success', 'failed', 'cancelled'].includes(data.status)) {
        es.close();
        setStreamConnected(false);
      }
    });

    return () => es.close();
  }, [id, job?.status]);

  // 3. 自动滚动到底
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 4. 取消任务
  async function cancelJob() {
    if (!job?.server_id) {
      alert('job 数据未加载，无法取消');
      return;
    }
    if (!confirm('确认取消此任务？')) return;
    try {
      const res = await fetch(`/api/admin/servers/${job.server_id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'cancel', commandId: id }),
      });
      if (res.ok) alert('取消指令已下发');
      else alert('取消失败：' + (await res.json()).error);
    } catch (e) {
      alert(`网络错误: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (!job) return <p>加载中...</p>;

  const statusColor: Record<string, string> = {
    queued: 'bg-gray-100 text-gray-700',
    running: 'bg-yellow-100 text-yellow-700 animate-pulse',
    success: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  };

  // deploy 与 provision 的阶段合集（未知阶段 indexOf=-1 仅不点亮进度条，不影响日志流）
  const stageOrder = ['env', 'config-written', 'bundle-sync', 'bundle-synced', 'bundle', 'build', 'healthcheck', 'kb-sync'];
  const currentStageIdx = progress ? stageOrder.indexOf(progress.stage) : -1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">任务 {job.type}</h1>
        <div className="flex items-center gap-2">
          {streamConnected && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">● 实时</span>
          )}
          {job.status === 'running' && (
            <button onClick={cancelJob} className="bg-red-600 text-white px-3 py-1 rounded text-sm">
              取消任务
            </button>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 max-w-lg">
        <dt className="font-bold">状态</dt>
        <dd>
          <span className={`text-xs px-2 py-0.5 rounded ${statusColor[job.status] ?? ''}`}>
            {job.status}
          </span>
        </dd>
        <dt className="font-bold">开始</dt><dd>{job.started_at ? new Date(job.started_at).toLocaleString() : '-'}</dd>
        <dt className="font-bold">结束</dt><dd>{job.finished_at ? new Date(job.finished_at).toLocaleString() : '-'}</dd>
        <dt className="font-bold">Exit Code</dt><dd>{job.exit_code ?? '-'}</dd>
        {job.error_message && (<><dt className="font-bold">错误</dt><dd className="text-red-600">{job.error_message}</dd></>)}
      </dl>

      {progress && (
        <section>
          <h2 className="text-lg font-bold mb-2">进度</h2>
          <div className="flex items-center gap-2">
            {stageOrder.map((stage, idx) => (
              <div key={stage} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    idx < currentStageIdx ? 'bg-green-500 text-white' :
                    idx === currentStageIdx ? 'bg-yellow-500 text-white animate-pulse' :
                    'bg-gray-200 text-gray-500'
                  }`}
                >
                  {idx < currentStageIdx ? '✓' : idx + 1}
                </div>
                <span className="text-sm">{stage}</span>
                {idx < stageOrder.length - 1 && <span className="text-gray-400">→</span>}
              </div>
            ))}
          </div>
          {progress.message && <p className="text-sm text-gray-600 mt-1">{progress.message}</p>}
        </section>
      )}

      <section>
        <h2 className="text-lg font-bold mb-2">日志</h2>
        <pre className="bg-black text-gray-100 p-4 rounded text-xs overflow-x-auto max-h-[600px] overflow-y-auto">
          {logs.map((l, i) => (
            <div key={`${l.ts}-${i}`} className={l.stream === 'stderr' ? 'text-red-400' : 'text-gray-100'}>
              [{new Date(l.ts).toLocaleTimeString()}] {l.line}
            </div>
          ))}
          {logs.length === 0 && <div className="text-gray-500">无日志</div>}
          <div ref={logEndRef} />
        </pre>
      </section>
    </div>
  );
}
