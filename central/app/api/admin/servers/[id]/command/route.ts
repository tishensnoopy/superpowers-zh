import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { createJob } from '@/lib/job-manager';
import { sendToServer, isOnline } from '@/lib/connections';

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
    type: type as any,
    triggeredBy: admin.sub,
  });

  // 生成 commandId（与 jobId 相同）
  const command = {
    commandId: job.id,
    type: `command:${type}`,
    ...rest,
  };

  const sent = await sendToServer(params.id, command);
  if (!sent) {
    return errorResponse('Failed to send command (agent disconnected)', 503);
  }

  return json({ jobId: job.id, status: 'queued' }, 202);
}
