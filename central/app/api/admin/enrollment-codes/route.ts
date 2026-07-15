import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import crypto from 'node:crypto';

const CODE_TTL_HOURS = 24;

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const customerId = req.nextUrl.searchParams.get('customerId');
  if (!customerId) return errorResponse('customerId required', 400);
  const result = await query(
    `SELECT id, customer_id, code, issued_at, expires_at, used_at, failed_attempts
     FROM enrollment_codes WHERE customer_id=$1 ORDER BY issued_at DESC`,
    [customerId]
  );
  return json({ items: result.rows });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const { customerId } = await req.json();
  if (!customerId) return errorResponse('customerId required', 400);

  const code = crypto.randomBytes(16).toString('base64url').toUpperCase().slice(0, 32);
  const result = await query(
    `INSERT INTO enrollment_codes (customer_id, code, expires_at)
     VALUES ($1,$2, now() + interval '${CODE_TTL_HOURS} hours')
     RETURNING id, customer_id, code, issued_at, expires_at, used_at, failed_attempts`,
    [customerId, code]
  );
  return json(result.rows[0], 201);
}
