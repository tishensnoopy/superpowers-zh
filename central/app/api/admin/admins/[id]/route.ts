import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { hashPassword } from '@/lib/auth';

const VALID_ROLES = ['superadmin', 'admin', 'viewer'] as const;
type Role = (typeof VALID_ROLES)[number];

function isRole(r: unknown): r is Role {
  return typeof r === 'string' && (VALID_ROLES as readonly string[]).includes(r);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const result = await query(
    'SELECT id, email, role, locked, locked_at, created_at FROM admin_users WHERE id=$1',
    [params.id]
  );
  if (result.rows.length === 0) return errorResponse('Not found', 404);
  return json(result.rows[0]);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  // 仅 superadmin 可修改管理员信息
  if (admin.role !== 'superadmin') {
    return errorResponse('仅超级管理员可修改管理员账号', 403);
  }

  // 不允许修改自己（防止自己降级自己造成无 superadmin）
  if (admin.sub === params.id) {
    return errorResponse('不可修改自己，请使用其他超级管理员账号操作', 400);
  }

  const body = await req.json();
  const email: string | undefined = body.email;
  const role: unknown = body.role;
  const password: string | undefined = body.password;

  // 先确认目标存在并取当前 role
  const current = await query<{ id: string; role: string }>(
    'SELECT id, role FROM admin_users WHERE id=$1',
    [params.id]
  );
  if (current.rows.length === 0) return errorResponse('Not found', 404);

  // 保护：不允许把最后一个 superadmin 降级
  if (
    current.rows[0].role === 'superadmin' &&
    role !== undefined &&
    role !== 'superadmin'
  ) {
    const superadminCount = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM admin_users WHERE role='superadmin'`
    );
    if (parseInt(superadminCount.rows[0].count, 10) <= 1) {
      return errorResponse('系统至少保留一个超级管理员，不可降级最后一个 superadmin', 400);
    }
  }

  if (email !== undefined && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return errorResponse('email 格式不正确', 400);
  }
  if (role !== undefined && !isRole(role)) {
    return errorResponse(`role 必须为 ${VALID_ROLES.join('|')} 之一`, 400);
  }
  if (password !== undefined && (typeof password !== 'string' || password.length < 8)) {
    return errorResponse('password 至少 8 个字符', 400);
  }

  // email 唯一性检查
  if (email !== undefined) {
    const dup = await query('SELECT id FROM admin_users WHERE email=$1 AND id<>$2', [email, params.id]);
    if (dup.rows.length > 0) return errorResponse('email 已存在', 409);
  }

  // 动态构造 UPDATE
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (email !== undefined) {
    sets.push(`email=$${idx++}`);
    values.push(email);
  }
  if (role !== undefined) {
    sets.push(`role=$${idx++}`);
    values.push(role);
  }
  if (password !== undefined) {
    const passwordHash = await hashPassword(password);
    sets.push(`password_hash=$${idx++}`);
    values.push(passwordHash);
  }

  if (sets.length === 0) {
    return errorResponse('未提供任何可更新字段', 400);
  }

  values.push(params.id);
  const result = await query(
    `UPDATE admin_users SET ${sets.join(', ')} WHERE id=$${idx}
     RETURNING id, email, role, locked, locked_at, created_at`,
    values
  );

  await writeAuditLog({
    adminId: admin.sub,
    action: 'admin:update',
    targetType: 'admin',
    targetId: params.id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: req.headers.get('user-agent') ?? undefined,
    detail: {
      email: email ?? null,
      role: role ?? null,
      passwordChanged: password !== undefined,
    },
  });

  return json(result.rows[0]);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  // 仅 superadmin 可删除
  if (admin.role !== 'superadmin') {
    return errorResponse('仅超级管理员可删除管理员账号', 403);
  }

  // 不允许删除自己
  if (admin.sub === params.id) {
    return errorResponse('不可删除自己', 400);
  }

  // 确认目标存在并取 role
  const current = await query<{ id: string; role: string }>(
    'SELECT id, role FROM admin_users WHERE id=$1',
    [params.id]
  );
  if (current.rows.length === 0) return errorResponse('Not found', 404);

  // 保护最后一个 superadmin
  if (current.rows[0].role === 'superadmin') {
    const superadminCount = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM admin_users WHERE role='superadmin'`
    );
    if (parseInt(superadminCount.rows[0].count, 10) <= 1) {
      return errorResponse('系统至少保留一个超级管理员，不可删除最后一个 superadmin', 400);
    }
  }

  const result = await query('DELETE FROM admin_users WHERE id=$1 RETURNING id', [params.id]);
  if (result.rows.length === 0) return errorResponse('Not found', 404);

  await writeAuditLog({
    adminId: admin.sub,
    action: 'admin:delete',
    targetType: 'admin',
    targetId: params.id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: req.headers.get('user-agent') ?? undefined,
  });

  return json({ ok: true });
}
