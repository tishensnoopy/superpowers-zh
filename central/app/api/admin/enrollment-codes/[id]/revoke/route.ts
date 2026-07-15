import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const result = await query(
    `UPDATE enrollment_codes SET used_at=now() WHERE id=$1 AND used_at IS NULL RETURNING id`,
    [params.id]
  );
  if (result.rows.length === 0) return errorResponse('Not found or already used', 404);
  return json({ ok: true });
}
