import { query } from './db';

export type JobType = 'deploy' | 'config-sync' | 'restart' | 'status' | 'logs';
export type JobStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  queued: ['running', 'cancelled'],
  running: ['success', 'failed', 'cancelled'],
  success: [],
  failed: [],
  cancelled: [],
};

export interface CreateJobParams {
  serverId: string;
  type: JobType;
  triggeredBy: string;
  configId?: string;
}

export async function createJob(params: CreateJobParams) {
  const result = await query<any>(
    `INSERT INTO deploy_jobs (server_id, type, triggered_by, config_id, status)
     VALUES ($1, $2, $3, $4, 'queued') RETURNING *`,
    [params.serverId, params.type, params.triggeredBy, params.configId ?? null]
  );
  return result.rows[0];
}

export async function updateJobStatus(
  jobId: string,
  newStatus: JobStatus,
  extras?: { exitCode?: number; errorMessage?: string }
): Promise<void> {
  const current = await query<{ status: JobStatus }>(`SELECT status FROM deploy_jobs WHERE id=$1`, [jobId]);
  if (current.rows.length === 0) throw new Error('job not found');
  const currentStatus = current.rows[0].status;
  if (!VALID_TRANSITIONS[currentStatus].includes(newStatus)) {
    throw new Error(`invalid transition: ${currentStatus} → ${newStatus}`);
  }

  const sets: string[] = [`status = $2`];
  const params: any[] = [jobId, newStatus];
  let paramIdx = 3;
  if (newStatus === 'running') sets.push(`started_at = now()`);
  if (newStatus === 'success' || newStatus === 'failed' || newStatus === 'cancelled') {
    sets.push(`finished_at = now()`);
  }
  if (extras?.exitCode !== undefined) { sets.push(`exit_code = $${paramIdx++}`); params.push(extras.exitCode); }
  if (extras?.errorMessage !== undefined) { sets.push(`error_message = $${paramIdx++}`); params.push(extras.errorMessage); }

  await query(`UPDATE deploy_jobs SET ${sets.join(', ')} WHERE id=$1`, params);
}

export async function getJob(jobId: string) {
  const result = await query<any>(`SELECT * FROM deploy_jobs WHERE id=$1`, [jobId]);
  return result.rows[0];
}

export async function listJobs(filter: { serverId?: string; limit?: number; offset?: number }) {
  const conditions: string[] = [];
  const params: any[] = [];
  if (filter.serverId) {
    params.push(filter.serverId);
    conditions.push(`server_id = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(filter.limit ?? 50);
  params.push(filter.offset ?? 0);
  const result = await query<any>(
    `SELECT * FROM deploy_jobs ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows;
}

export async function markStaleJobsFailed(timeoutMs: number): Promise<number> {
  const result = await query(
    `UPDATE deploy_jobs
     SET status = 'failed', error_message = 'timeout: no result within ${timeoutMs}ms',
         finished_at = now()
     WHERE status = 'running'
       AND started_at < now() - ($1 || ' milliseconds')::interval
     RETURNING id`,
    [String(timeoutMs)]
  );
  return result.rowCount ?? 0;
}

export function startJobTimeoutMonitor(timeoutMs = 5 * 60 * 1000, intervalMs = 60000): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      const count = await markStaleJobsFailed(timeoutMs);
      if (count > 0) console.log(`[job-manager] marked ${count} stale jobs failed`);
    } catch (err) {
      console.error('[job-manager] timeout check failed:', err);
    }
  }, intervalMs);
}
