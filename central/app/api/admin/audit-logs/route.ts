import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { listAuditLogs } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { searchParams } = req.nextUrl;
  const adminId = searchParams.get('adminId') ?? undefined;
  const targetType = searchParams.get('targetType') ?? undefined;
  const targetId = searchParams.get('targetId') ?? undefined;
  const action = searchParams.get('action') ?? undefined;
  const limit = parseInt(searchParams.get('limit') ?? '100', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  const result = await listAuditLogs({ adminId, targetType, targetId, action, limit, offset });
  return json(result);
}
