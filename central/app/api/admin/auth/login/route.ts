import { NextRequest } from 'next/server';
import { json, errorResponse } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { verifyPassword, signJwt, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) return errorResponse('Missing email or password', 400);

  const result = await query<{ id: string; password_hash: string; role: string }>(
    'SELECT id, password_hash, role FROM admin_users WHERE email = $1',
    [email]
  );
  if (result.rows.length === 0) return errorResponse('Invalid credentials', 401);

  const user = result.rows[0];
  if (!(await verifyPassword(password, user.password_hash))) {
    return errorResponse('Invalid credentials', 401);
  }

  const token = await signJwt({ sub: user.id, email, role: user.role as any });
  const res = json({ ok: true, role: user.role });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
  return res;
}
