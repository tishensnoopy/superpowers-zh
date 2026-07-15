import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { getJob } from '@/lib/job-manager';
import { query } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const job = await getJob(params.id);
  if (!job) return errorResponse('Job not found', 404);

  // 附带日志（最近 500 行）
  const logs = await query(
    `SELECT ts, stream, line FROM job_logs WHERE job_id=$1 ORDER BY ts ASC LIMIT 500`,
    [params.id]
  );

  return json({ ...job, logs: logs.rows });
}
