import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { createJob, updateJobStatus } from '@/lib/job-manager';
import { sendToServer, isOnline } from '@/lib/connections';
import { writeAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const body = await req.json().catch(() => ({}));
  const { configId, bundleId: bodyBundleId, mode = 'nginx', envVars } = body;
  if (mode !== 'nginx' && mode !== 'direct') {
    return errorResponse('mode must be nginx or direct', 400);
  }

  // 验证 server
  const srv = await query(`SELECT id, customer_id FROM customer_servers WHERE id=$1`, [params.id]);
  if (srv.rows.length === 0) return errorResponse('Server not found', 404);

  // 验证 config（可选；未传则取最新 published）
  let resolvedConfigId = configId;
  if (!resolvedConfigId) {
    const latest = await query(
      `SELECT id FROM customer_configs WHERE customer_id=$1 AND published_at IS NOT NULL ORDER BY version DESC LIMIT 1`,
      [srv.rows[0].customer_id]
    );
    if (latest.rows.length === 0) {
      return errorResponse('No published config for this customer. Publish a config first.', 400);
    }
    resolvedConfigId = latest.rows[0].id;
  } else {
    const cfg = await query(`SELECT id FROM customer_configs WHERE id=$1 AND customer_id=$2`, [resolvedConfigId, srv.rows[0].customer_id]);
    if (cfg.rows.length === 0) return errorResponse('Config not found or does not belong to this customer', 404);
  }

  // 解析发布包（部署管道统一走 bundle；无 ready bundle 拒绝部署）
  let bundleId: string = bodyBundleId;
  if (!bundleId) {
    const latest = await query(
      `SELECT id FROM bundles WHERE status='ready' ORDER BY created_at DESC LIMIT 1`
    );
    if (latest.rows.length === 0) {
      return errorResponse('No ready bundle. Build a bundle first (POST /api/admin/bundles).', 400);
    }
    bundleId = (latest.rows[0] as { id: string }).id;
  } else {
    const b = await query(`SELECT id FROM bundles WHERE id=$1 AND status='ready'`, [bundleId]);
    if (b.rows.length === 0) return errorResponse('Bundle not found or not ready', 404);
  }

  // 检查 agent 在线
  if (!isOnline(params.id)) {
    return errorResponse('Agent is offline. Cannot deploy.', 409);
  }

  // per-server 并发防护：同 server 已有 queued/running 的 deploy job 则拒绝（防双击/重复下发）
  const inflight = await query(
    `SELECT id FROM deploy_jobs WHERE server_id=$1 AND type='deploy' AND status IN ('queued','running') LIMIT 1`,
    [params.id]
  );
  if (inflight.rows.length > 0) {
    return errorResponse('A deploy job is already in flight for this server.', 409);
  }

  // 创建 job
  const job = await createJob({
    serverId: params.id,
    type: 'deploy',
    triggeredBy: admin.sub,
    configId: resolvedConfigId,
  });

  // 组装 envVars（从 config 的 env_overrides 中提取）
  let deployEnvVars = envVars;
  if (!deployEnvVars) {
    const cfg = await query(`SELECT env_overrides FROM customer_configs WHERE id=$1`, [resolvedConfigId]);
    deployEnvVars = cfg.rows[0]?.env_overrides ?? {};
  }

  // 下发 command:deploy
  const command = {
    commandId: job.id,
    type: 'command:deploy',
    jobId: job.id,
    imageTag: 'unused',  // 保留字段，本期忽略
    bundleId,
    bundleUrl: `/api/agent/bundles/${bundleId}/download`,
    centralApiUrl: process.env.CENTRAL_PUBLIC_URL ?? req.nextUrl.origin,
    envVars: deployEnvVars,
    mode,
  };

  const sent = await sendToServer(params.id, command);
  if (!sent) {
    // 通过状态机原子更新，避免 TOCTOU 并发风险。
    // 选项 C：先尝试 'failed'（running → failed 合法，语义准确），
    // 若 job 仍为 queued（agent 未 ack）则降级 'cancelled'（queued → cancelled 合法，确保清理）。
    // 否则 queued → failed 会抛 invalid transition 留下僵尸 job（markStaleJobsFailed 不回收 queued）。
    try {
      await updateJobStatus(job.id, 'failed', { errorMessage: 'agent disconnected' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/job not found/.test(msg)) throw err;
      if (/invalid transition/.test(msg)) {
        // job 仍为 queued（agent 未 ack），降级为 cancelled 确保清理
        try {
          await updateJobStatus(job.id, 'cancelled', { errorMessage: 'send failed: agent disconnected' });
        } catch (e2: unknown) {
          const m2 = e2 instanceof Error ? e2.message : String(e2);
          if (!/invalid transition|job not found/.test(m2)) throw e2;
          console.warn(`[deploy] send-failure cleanup conflict for ${job.id}:`, m2);
        }
      } else throw err;
    }
    return errorResponse('Failed to send deploy command (agent disconnected)', 503);
  }

  await writeAuditLog({
    adminId: admin.sub,
    action: 'job:deploy',
    targetType: 'server',
    targetId: params.id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: req.headers.get('user-agent') ?? undefined,
    detail: { jobId: job.id, configId: resolvedConfigId, bundleId, mode },
  });

  return json({ jobId: job.id, status: 'queued', streamUrl: `/api/admin/jobs/${job.id}/stream` }, 202);
}
