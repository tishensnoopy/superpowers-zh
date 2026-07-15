import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query, withTransaction } from '@/lib/db';
import { encryptSensitiveFields, maskSensitiveFields } from '@/lib/config-sanitizer';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const customerId = req.nextUrl.searchParams.get('customerId');
  if (!customerId) return errorResponse('customerId query param required', 400);
  const result = await query(
    `SELECT id, customer_id, version, brand, ai, deployment, env_overrides, published_at, created_at
     FROM customer_configs WHERE customer_id=$1 ORDER BY version DESC`,
    [customerId]
  );
  return json({ items: result.rows.map((r) => maskApiRow(r)) });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const { customerId, brand, ai, deployment, envOverrides } = await req.json();
  if (!customerId) return errorResponse('customerId is required', 400);

  const encrypted = encryptSensitiveFields({ brand, ai, deployment, envOverrides });
  try {
    const result = await withTransaction(async (client) => {
      const versionRow = await client.query<{ max: number }>(
        'SELECT COALESCE(MAX(version),0) + 1 AS max FROM customer_configs WHERE customer_id=$1',
        [customerId]
      );
      const version = versionRow.rows[0].max;
      const insertResult = await client.query(
        `INSERT INTO customer_configs (customer_id, version, brand, ai, deployment, env_overrides)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [customerId, version, encrypted.brand ?? {}, encrypted.ai ?? {}, encrypted.deployment ?? {}, encrypted.envOverrides ?? {}]
      );
      return insertResult.rows[0];
    });
    return json(maskApiRow(result), 201);
  } catch (err: any) {
    if (err.code === '23505') return errorResponse('Version conflict, please retry', 409);
    throw err;
  }
}

function maskApiRow(row: Record<string, any>) {
  return {
    ...row,
    ai: maskSensitiveFields({ ai: row.ai }).ai,
    env_overrides: maskSensitiveFields({ envOverrides: row.env_overrides }).envOverrides,
  };
}
