import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt, COOKIE_NAME, AdminJwtPayload } from './auth';

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function requireAdmin(): Promise<AdminJwtPayload | NextResponse> {
  const store = cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return errorResponse('Unauthorized', 401);
  try {
    return await verifyJwt(token);
  } catch {
    return errorResponse('Invalid session', 401);
  }
}
