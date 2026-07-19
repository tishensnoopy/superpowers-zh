import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { createJob, updateJobStatus } from '@/lib/job-manager';
import { sendToServer, isOnline } from '@/lib/connections';
import { writeAuditLog } from '@/lib/audit';

// provision 时自动生成的密钥键名（值不经过人手，central 生成直送 agent）
const GENERATED_SECRET_KEYS = ['JWT_SECRET', 'ADMIN_JWT_SECRET', 'API_TOKEN_SALT', 'TRANSFER_TOKEN_SALT', 'ENCRYPTION_KEY', 'DATABASE_PASSWORD', 'REDIS_PASSWORD', 'MEILI_MASTER_KEY'];

function randomSecret(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const body = await req.json().catch(() => ({}));
  const { configId, bundleId: bodyBundleId, mode = 'nginx' } = body;
  if (mode !== 'nginx' && mode !== 'direct') {
    return errorResponse('mode must be nginx or direct', 400);
  }

  const srv = await query(`SELECT id, customer_id FROM customer_servers WHERE id=$1`, [params.id]);
  if (srv.rows.length === 0) return errorResponse('Server not found', 404);
  const customerId = (srv.rows[0] as { customer_id: string }).customer_id;

  // 配置（env_overrides 为实例差异唯一来源）
  let resolvedConfigId = configId;
  if (!resolvedConfigId) {
    const latest = await query(
      `SELECT id FROM customer_configs WHERE customer_id=$1 AND published_at IS NOT NULL ORDER BY version DESC LIMIT 1`,
      [customerId]
    );
    if (latest.rows.length === 0) return errorResponse('No published config for this customer.', 400);
    resolvedConfigId = (latest.rows[0] as { id: string }).id;
  } else {
    const owned = await query(`SELECT id FROM customer_configs WHERE id=$1 AND customer_id=$2`, [resolvedConfigId, customerId]);
    if (owned.rows.length === 0) return errorResponse('Config not found for this customer', 404);
  }
  const cfg = await query(`SELECT env_overrides FROM customer_configs WHERE id=$1`, [resolvedConfigId]);
  const envOverrides = (cfg.rows[0] as { env_overrides: Record<string, string> } | undefined)?.env_overrides ?? {};

  // 发布包
  let bundleId: string = bodyBundleId;
  if (!bundleId) {
    const latest = await query(`SELECT id FROM bundles WHERE status='ready' ORDER BY created_at DESC LIMIT 1`);
    if (latest.rows.length === 0) return errorResponse('No ready bundle. Build a bundle first.', 400);
    bundleId = (latest.rows[0] as { id: string }).id;
  } else {
    const b = await query(`SELECT id FROM bundles WHERE id=$1 AND status='ready'`, [bundleId]);
    if (b.rows.length === 0) return errorResponse('Bundle not found or not ready', 404);
  }

  if (!isOnline(params.id)) return errorResponse('Agent is offline.', 409);

  // per-server 并发防护：同 server 已有 queued/running 的 provision job 则拒绝（防双击/重复下发）
  const inflight = await query(
    `SELECT id FROM deploy_jobs WHERE server_id=$1 AND type='provision' AND status IN ('queued','running') LIMIT 1`,
    [params.id]
  );
  if (inflight.rows.length > 0) {
    return errorResponse('A provision job is already in flight for this server.', 409);
  }

  // 组装完整 envVars：config 差异 + 自动密钥（APP_KEYS 特殊：4 段逗号拼接）
  const envVars: Record<string, string> = { ...envOverrides };
  envVars.APP_KEYS = envVars.APP_KEYS ?? [randomSecret(), randomSecret(), randomSecret(), randomSecret()].join(',');
  for (const key of GENERATED_SECRET_KEYS) {
    envVars[key] = envVars[key] ?? randomSecret();
  }

  const job = await createJob({ serverId: params.id, type: 'provision', triggeredBy: admin.sub, configId: resolvedConfigId });

  const command = {
    commandId: job.id,
    type: 'command:provision',
    jobId: job.id,
    bundleId,
    bundleUrl: `/api/agent/bundles/${bundleId}/download`,
    centralApiUrl: process.env.CENTRAL_PUBLIC_URL ?? req.nextUrl.origin,
    envVars,
    mode,
  };

  const sent = await sendToServer(params.id, command);
  if (!sent) {
    // 与 deploy 路由相同的原子清理策略
    try {
      await updateJobStatus(job.id, 'failed', { errorMessage: 'agent disconnected' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/job not found/.test(msg)) throw err;
      if (/invalid transition/.test(msg)) {
        try {
          await updateJobStatus(job.id, 'cancelled', { errorMessage: 'send failed' });
        } catch (fallbackErr: unknown) {
          const m2 = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
          if (!/invalid transition|job not found/.test(m2)) throw fallbackErr;
          console.warn('[provision] concurrent job update during send-failure cleanup:', fallbackErr);
        }
      } else throw err;
    }
    return errorResponse('Failed to send provision command', 503);
  }

  await writeAuditLog({
    adminId: admin.sub,
    action: 'job:provision',
    targetType: 'server',
    targetId: params.id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: req.headers.get('user-agent') ?? undefined,
    detail: { jobId: job.id, configId: resolvedConfigId, bundleId, mode },
  });

  return json({ jobId: job.id, status: 'queued', streamUrl: `/api/admin/jobs/${job.id}/stream` }, 202);
}
