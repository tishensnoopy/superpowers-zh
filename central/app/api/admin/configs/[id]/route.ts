import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { encryptSensitiveFields, maskSensitiveFields } from '@/lib/config-sanitizer';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const result = await query(`SELECT * FROM customer_configs WHERE id=$1`, [params.id]);
  if (result.rows.length === 0) return errorResponse('Not found', 404);
  const row = result.rows[0];
  return json({
    ...row,
    ai: maskSensitiveFields({ ai: row.ai }).ai,
    env_overrides: maskSensitiveFields({ envOverrides: row.env_overrides }).envOverrides,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { brand, ai, deployment, envOverrides } = await req.json();
  const encrypted = encryptSensitiveFields({ brand, ai, deployment, envOverrides });
  const result = await query(
    `UPDATE customer_configs SET brand=COALESCE($1,brand), ai=COALESCE($2,ai),
       deployment=COALESCE($3,deployment), env_overrides=COALESCE($4,env_overrides)
     WHERE id=$5 AND published_at IS NULL RETURNING *`,
    [encrypted.brand ?? null, encrypted.ai ?? null, encrypted.deployment ?? null, encrypted.envOverrides ?? null, params.id]
  );
  if (result.rows.length === 0) {
    const exists = await query('SELECT id FROM customer_configs WHERE id=$1', [params.id]);
    if (exists.rows.length === 0) return errorResponse('Not found', 404);
    return errorResponse('Published configs are immutable', 409);
  }
  const row = result.rows[0];
  return json({
    ...row,
    ai: maskSensitiveFields({ ai: row.ai }).ai,
    env_overrides: maskSensitiveFields({ envOverrides: row.env_overrides }).envOverrides,
  });
}
