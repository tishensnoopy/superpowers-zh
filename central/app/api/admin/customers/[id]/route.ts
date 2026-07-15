import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const result = await query(
    'SELECT id, name, contact_name, contact_phone, created_at FROM customers WHERE id=$1',
    [params.id]
  );
  if (result.rows.length === 0) return errorResponse('Not found', 404);
  return json(result.rows[0]);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const { name, contactName, contactPhone } = await req.json();
  const result = await query(
    `UPDATE customers SET name=COALESCE($1,name), contact_name=COALESCE($2,contact_name),
       contact_phone=COALESCE($3,contact_phone)
     WHERE id=$4 RETURNING id, name, contact_name, contact_phone, created_at`,
    [name ?? null, contactName ?? null, contactPhone ?? null, params.id]
  );
  if (result.rows.length === 0) return errorResponse('Not found', 404);
  return json(result.rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const result = await query('DELETE FROM customers WHERE id=$1 RETURNING id', [params.id]);
  if (result.rows.length === 0) return errorResponse('Not found', 404);
  return json({ ok: true });
}
