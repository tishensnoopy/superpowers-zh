import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { revokeAgentToken } from '@/lib/agent-auth';
import { writeAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const count = await revokeAgentToken(params.id);
  if (count === 0) {
    return errorResponse('No active token to revoke', 404);
  }

  await writeAuditLog({
    adminId: admin.sub,
    action: 'token:revoke',
    targetType: 'server',
    targetId: params.id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: req.headers.get('user-agent') ?? undefined,
    detail: { revokedCount: count },
  });

  return json({ revoked: count });
}
