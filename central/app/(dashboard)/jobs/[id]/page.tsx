'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/jobs/${id}`)
      .then((r) => r.json())
      .then(setJob)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [id]);

  if (err) return <p className="text-red-600">加载失败: {err}</p>;
  if (!job) return <p>加载中...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">任务 {job.type}</h1>
      <dl className="grid grid-cols-2 gap-2 max-w-lg">
        <dt className="font-bold">状态</dt><dd>{job.status}</dd>
        <dt className="font-bold">开始</dt><dd>{job.started_at ? new Date(job.started_at).toLocaleString() : '-'}</dd>
        <dt className="font-bold">结束</dt><dd>{job.finished_at ? new Date(job.finished_at).toLocaleString() : '-'}</dd>
        <dt className="font-bold">Exit Code</dt><dd>{job.exit_code ?? '-'}</dd>
        {job.error_message && (<><dt className="font-bold">错误</dt><dd className="text-red-600">{job.error_message}</dd></>)}
      </dl>
      <section>
        <h2 className="text-lg font-bold mb-2">日志</h2>
        <pre className="bg-black text-gray-100 p-4 rounded text-xs overflow-x-auto max-h-[600px] overflow-y-auto">
          {(job.logs ?? []).map((l: any, i: number) => (
            <div key={i} className={l.stream === 'stderr' ? 'text-red-400' : 'text-gray-100'}>
              [{new Date(l.ts).toLocaleTimeString()}] {l.line}
            </div>
          ))}
          {(job.logs ?? []).length === 0 && <div className="text-gray-500">无日志</div>}
        </pre>
      </section>
    </div>
  );
}
