import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  if (admin.role !== 'superadmin') {
    return errorResponse('仅超级管理员可解锁账号', 403);
  }

  const current = await query<{ id: string }>(
    'SELECT id FROM admin_users WHERE id=$1',
    [params.id]
  );
  if (current.rows.length === 0) return errorResponse('Not found', 404);

  const result = await query(
    `UPDATE admin_users SET locked=false, locked_at=null WHERE id=$1
     RETURNING id, email, role, locked, locked_at, created_at`,
    [params.id]
  );

  await writeAuditLog({
    adminId: admin.sub,
    action: 'admin:unlock',
    targetType: 'admin',
    targetId: params.id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: req.headers.get('user-agent') ?? undefined,
  });

  return json(result.rows[0]);
}
