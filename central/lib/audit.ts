import { query } from './db';

export interface AuditLogEntry {
  adminId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  ip?: string;
  userAgent?: string;
  detail?: Record<string, unknown>;
}

export interface AuditLogRow {
  id: string;
  admin_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip: string | null;
  user_agent: string | null;
  detail: Record<string, unknown>;
  ts: string;
}

export interface ListAuditLogsParams {
  adminId?: string;
  targetType?: string;
  targetId?: string;
  action?: string;
  limit?: number;
  offset?: number;
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<AuditLogRow> {
  const result = await query<AuditLogRow>(
    `INSERT INTO audit_logs (admin_id, action, target_type, target_id, ip, user_agent, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, admin_id, action, target_type, target_id, ip, user_agent, detail, ts`,
    [
      entry.adminId ?? null,
      entry.action,
      entry.targetType ?? null,
      entry.targetId ?? null,
      entry.ip ?? null,
      entry.userAgent ?? null,
      JSON.stringify(entry.detail ?? {}),
    ]
  );
  return result.rows[0];
}

export async function listAuditLogs(params: ListAuditLogsParams): Promise<{ items: AuditLogRow[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (params.adminId) {
    conditions.push(`admin_id = $${paramIdx++}`);
    values.push(params.adminId);
  }
  if (params.targetType) {
    conditions.push(`target_type = $${paramIdx++}`);
    values.push(params.targetType);
  }
  if (params.targetId) {
    conditions.push(`target_id = $${paramIdx++}`);
    values.push(params.targetId);
  }
  if (params.action) {
    conditions.push(`action = $${paramIdx++}`);
    values.push(params.action);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  const countResult = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM audit_logs ${where}`, values);
  const total = parseInt(countResult.rows[0].count, 10);

  values.push(limit);
  values.push(offset);
  const result = await query<AuditLogRow>(
    `SELECT id, admin_id, action, target_type, target_id, ip, user_agent, detail, ts
     FROM audit_logs ${where}
     ORDER BY ts DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    values
  );

  return { items: result.rows, total };
}
