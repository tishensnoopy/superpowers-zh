import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const result = await query(`SELECT * FROM customer_servers WHERE id=$1`, [params.id]);
  if (result.rows.length === 0) return errorResponse('Not found', 404);
  return json(result.rows[0]);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const { displayName, hostname } = await req.json();
  const result = await query(
    `UPDATE customer_servers SET display_name=COALESCE($1,display_name), hostname=COALESCE($2,hostname)
     WHERE id=$3 RETURNING *`,
    [displayName ?? null, hostname ?? null, params.id]
  );
  if (result.rows.length === 0) return errorResponse('Not found', 404);
  return json(result.rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const result = await query('DELETE FROM customer_servers WHERE id=$1 RETURNING id', [params.id]);
  if (result.rows.length === 0) return errorResponse('Not found', 404);
  return json({ ok: true });
}
