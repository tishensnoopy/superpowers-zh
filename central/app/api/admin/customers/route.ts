import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const result = await query(
    'SELECT id, name, contact_name, contact_phone, created_at FROM customers ORDER BY created_at DESC'
  );
  return json({ items: result.rows });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const { name, contactName, contactPhone } = await req.json();
  if (!name || typeof name !== 'string') return errorResponse('name is required', 400);

  const result = await query<{ id: string }>(
    `INSERT INTO customers (name, contact_name, contact_phone) VALUES ($1,$2,$3)
     RETURNING id, name, contact_name, contact_phone, created_at`,
    [name, contactName ?? null, contactPhone ?? null]
  );
  return json(result.rows[0], 201);
}
