import { NextRequest } from 'next/server';
import { json, errorResponse } from '@/lib/api-helpers';
import { consumeEnrollmentCode, generateAgentToken } from '@/lib/agent-auth';
import { query } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { writeAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown';

  // IP 维度限流：单 IP 5 分钟内最多 3 次尝试，超限锁定 1 小时
  const rl = checkRateLimit(ip, 'enroll', { maxAttempts: 3, windowMs: 5 * 60 * 1000, lockoutMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return errorResponse(
      rl.reason === 'locked'
        ? `IP locked due to too many failed attempts. Retry after ${Math.ceil((rl.retryAfterMs ?? 0) / 60000)} minutes.`
        : `Too many attempts from this IP. Retry after ${Math.ceil((rl.retryAfterMs ?? 0) / 60000)} minutes.`,
      429
    );
  }

  const { enrollmentCode, hostname, displayName } = await req.json();
  if (!enrollmentCode || !hostname) {
    return errorResponse('enrollmentCode and hostname are required', 400);
  }

  // 命令注入防护：hostname 仅允许字母数字-_（最长 64）
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(hostname)) {
    return errorResponse('hostname must match /^[A-Za-z0-9_-]{1,64}$/', 400);
  }
  // displayName 允许字母数字-_、中文、空格（最长 128）
  if (displayName && !/^[A-Za-z0-9_\u4e00-\u9fa5 -]{1,128}$/.test(displayName)) {
    return errorResponse('displayName contains invalid characters', 400);
  }

  const result = await consumeEnrollmentCode(enrollmentCode);
  if (!result) {
    return errorResponse('Invalid, expired, or used enrollment code', 401);
  }

  // 创建 server 记录
  let serverRow;
  try {
    const insertResult = await query<{ id: string }>(
      `INSERT INTO customer_servers (customer_id, hostname, display_name, status)
       VALUES ($1, $2, $3, 'offline') RETURNING id`,
      [result.customerId, hostname, displayName ?? null]
    );
    serverRow = insertResult.rows[0];
  } catch (err: any) {
    if (err.code === '23505') return errorResponse('Hostname already exists for this customer', 409);
    throw err;
  }
  const serverId = serverRow.id;

  // 生成长期 token
  const token = await generateAgentToken(serverId);

  await writeAuditLog({
    action: 'agent:enroll',
    targetType: 'server',
    targetId: serverId,
    ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
    detail: { hostname, displayName },
  });

  return json({ serverId, agentToken: token }, 200);
}
