import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const customerId = req.nextUrl.searchParams.get('customerId');
  const params = customerId ? [customerId] : [];
  const result = await query(
    `SELECT id, customer_id, hostname, display_name, status, last_heartbeat, agent_version, meta, created_at
     FROM customer_servers ${customerId ? 'WHERE customer_id=$1' : ''} ORDER BY created_at DESC`,
    params
  );
  return json({ items: result.rows });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const { customerId, hostname, displayName } = await req.json();
  if (!customerId || !hostname) return errorResponse('customerId and hostname are required', 400);

  try {
    const result = await query(
      `INSERT INTO customer_servers (customer_id, hostname, display_name)
       VALUES ($1,$2,$3) RETURNING *`,
      [customerId, hostname, displayName ?? null]
    );
    return json(result.rows[0], 201);
  } catch (err: any) {
    if (err.code === '23505') return errorResponse('Server already exists for this customer', 409);
    throw err;
  }
}
