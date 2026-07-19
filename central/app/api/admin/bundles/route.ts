import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { buildBundle, scrubCredentials } from '@/lib/bundles';
import { writeAuditLog } from '@/lib/audit';

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const result = await query(
    `SELECT id, ref, size_bytes, status, error, created_at FROM bundles ORDER BY created_at DESC LIMIT 50`
  );
  return json({ bundles: result.rows });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const body = await req.json().catch(() => ({}));
  const ref = typeof body.ref === 'string' && body.ref.trim();
  if (!ref) return errorResponse('ref is required (branch/tag/commit)', 400);

  const inserted = await query(
    `INSERT INTO bundles (ref, filename, created_by) VALUES ($1, $2, $3) RETURNING id`,
    [ref, '', admin.sub]
  );
  const id = (inserted.rows[0] as { id: string }).id;

  try {
    await buildBundle({ id, ref });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    return errorResponse(`bundle build failed: ${scrubCredentials(raw)}`, 500);
  }

  await writeAuditLog({
    adminId: admin.sub,
    action: 'bundle:build',
    targetType: 'bundle',
    targetId: id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: req.headers.get('user-agent') ?? undefined,
    detail: { ref },
  });

  const row = await query(`SELECT id, ref, size_bytes, status, created_at FROM bundles WHERE id=$1`, [id]);
  return json({ bundle: row.rows[0] }, 201);
}
