import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const result = await query(
    `UPDATE customer_configs SET published_at=now() WHERE id=$1 AND published_at IS NULL RETURNING id, published_at`,
    [params.id]
  );
  if (result.rows.length === 0) {
    const exists = await query('SELECT id FROM customer_configs WHERE id=$1', [params.id]);
    if (exists.rows.length === 0) return errorResponse('Not found', 404);
    return errorResponse('Config already published', 409);
  }
  return json(result.rows[0]);
}
