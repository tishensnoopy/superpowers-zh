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

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const result = await query(
    `SELECT id, email, role, locked, locked_at, created_at
     FROM admin_users
     ORDER BY created_at DESC`
  );
  return json({ items: result.rows });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  // 仅 superadmin 可创建管理员
  if (admin.role !== 'superadmin') {
    return errorResponse('仅超级管理员可创建管理员账号', 403);
  }

  const body = await req.json();
  const email: string | undefined = body.email;
  const password: string | undefined = body.password;
  const role: unknown = body.role ?? 'admin';

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errorResponse('email 格式不正确', 400);
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return errorResponse('password 至少 8 个字符', 400);
  }
  if (!isRole(role)) {
    return errorResponse(`role 必须为 ${VALID_ROLES.join('|')} 之一`, 400);
  }

  // email 唯一性检查
  const exists = await query('SELECT id FROM admin_users WHERE email=$1', [email]);
  if (exists.rows.length > 0) {
    return errorResponse('email 已存在', 409);
  }

  const passwordHash = await hashPassword(password);
  const result = await query<{ id: string }>(
    `INSERT INTO admin_users (email, password_hash, role)
     VALUES ($1, $2, $3)
     RETURNING id, email, role, created_at`,
    [email, passwordHash, role]
  );

  await writeAuditLog({
    adminId: admin.sub,
    action: 'admin:create',
    targetType: 'admin',
    targetId: result.rows[0].id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: req.headers.get('user-agent') ?? undefined,
    detail: { email, role },
  });

  return json(result.rows[0], 201);
}
