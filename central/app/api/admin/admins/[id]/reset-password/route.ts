import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  if (admin.role !== 'superadmin') {
    return errorResponse('仅超级管理员可重置密码', 403);
  }

  const body = await req.json();
  const newPassword: string | undefined = body.newPassword;

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return errorResponse('newPassword 至少 8 个字符', 400);
  }

  const current = await query<{ id: string }>(
    'SELECT id FROM admin_users WHERE id=$1',
    [params.id]
  );
  if (current.rows.length === 0) return errorResponse('Not found', 404);

  const passwordHash = await hashPassword(newPassword);
  await query(
    'UPDATE admin_users SET password_hash=$1 WHERE id=$2',
    [passwordHash, params.id]
  );

  await writeAuditLog({
    adminId: admin.sub,
    action: 'admin:reset-password',
    targetType: 'admin',
    targetId: params.id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: req.headers.get('user-agent') ?? undefined,
  });

  return json({ ok: true });
}
