import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { createJob, updateJobStatus, type JobType } from '@/lib/job-manager';
import { sendToServer, isOnline } from '@/lib/connections';
import { writeAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const body = await req.json();
  const { type, ...rest } = body;
  const validTypes = ['config-sync', 'restart', 'status', 'logs'];
  if (!validTypes.includes(type)) {
    return errorResponse(`Invalid type. Must be one of: ${validTypes.join(', ')}`, 400);
  }

  // 验证 server 存在
  const srv = await query(`SELECT id FROM customer_servers WHERE id=$1`, [params.id]);
  if (srv.rows.length === 0) return errorResponse('Server not found', 404);

  // 检查 Agent 在线
  if (!isOnline(params.id)) {
    return errorResponse('Agent is offline. Cannot send command.', 409);
  }

  // 创建 job
  const job = await createJob({
    serverId: params.id,
    type: type as JobType,
    triggeredBy: admin.sub,
  });

  // 生成指令：服务端字段放在 ...rest 之后，防止客户端覆盖 commandId/type
  const command = {
    ...rest,
    commandId: job.id,
    type: `command:${type}`,
  };

  const sent = await sendToServer(params.id, command);
  if (!sent) {
    // 下发失败时取消 job，避免 queued 僵尸记录（markStaleJobsFailed 只清理 running）
    await updateJobStatus(job.id, 'cancelled', { errorMessage: 'send failed: agent disconnected' });
    return errorResponse('Failed to send command (agent disconnected)', 503);
  }

  await writeAuditLog({
    adminId: admin.sub,
    action: `job:${type}`,
    targetType: 'server',
    targetId: params.id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: req.headers.get('user-agent') ?? undefined,
    detail: { jobId: job.id, type },
  });

  return json({ jobId: job.id, status: 'queued' }, 202);
}
