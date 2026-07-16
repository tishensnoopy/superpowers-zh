import crypto from 'node:crypto';
import { query } from './db';

export function hashAgentToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function generateAgentToken(serverId: string): Promise<string> {
  const token = crypto.randomBytes(30).toString('base64url');
  await query(
    `INSERT INTO agent_tokens (server_id, token_hash) VALUES ($1, $2)`,
    [serverId, hashAgentToken(token)]
  );
  return token;
}

export async function verifyAgentToken(token: string): Promise<{ id: string; customer_id: string } | null> {
  const hash = hashAgentToken(token);
  const result = await query<{ id: string; customer_id: string }>(
    `SELECT s.id, s.customer_id
     FROM agent_tokens t
     JOIN customer_servers s ON s.id = t.server_id
     WHERE t.token_hash = $1 AND t.revoked_at IS NULL`,
    [hash]
  );
  if (result.rows.length === 0) return null;

  query(`UPDATE agent_tokens SET last_used_at = now() WHERE token_hash = $1`, [hash]).catch(() => {});

  return result.rows[0];
}

export async function revokeAgentToken(serverId: string): Promise<number> {
  const result = await query(
    `UPDATE agent_tokens SET revoked_at = now() WHERE server_id = $1 AND revoked_at IS NULL`,
    [serverId]
  );
  return result.rowCount ?? 0;
}

export async function generateEnrollmentCode(customerId: string): Promise<string> {
  const code = crypto.randomBytes(24).toString('base64url').toUpperCase().slice(0, 32);
  await query(
    `INSERT INTO enrollment_codes (customer_id, code, expires_at)
     VALUES ($1, $2, now() + make_interval(hours => $3))`,
    [customerId, code, 24]
  );
  return code;
}

const MAX_CODE_FAILURES = 5;

/**
 * 消费 enrollment code。
 * - code 不存在/已过期/已使用 → 返回 null，并递增 failed_attempts
 * - failed_attempts 达到 5 → 自动作废（设 used_at = now()）
 * - 成功 → 设 used_at = now()，返回 customerId
 */
export async function consumeEnrollmentCode(code: string): Promise<{ customerId: string } | null> {
  // 先查 code
  const selectResult = await query<{ customer_id: string; expires_at: string; used_at: string | null; failed_attempts: number }>(
    `SELECT customer_id, expires_at, used_at, failed_attempts FROM enrollment_codes WHERE code = $1`,
    [code]
  );
  if (selectResult.rows.length === 0) return null;

  const row = selectResult.rows[0];
  if (row.used_at) return null;  // 已使用
  if (new Date(row.expires_at).getTime() < Date.now()) return null;  // 已过期
  if (row.failed_attempts >= MAX_CODE_FAILURES) {
    // 自动作废
    await query(`UPDATE enrollment_codes SET used_at = now() WHERE code = $1`, [code]);
    return null;
  }

  // 尝试消费：用原子 UPDATE 确保 code 未被并发使用
  const updateResult = await query<{ customer_id: string }>(
    `UPDATE enrollment_codes
     SET used_at = now(), failed_attempts = failed_attempts + 1
     WHERE code = $1 AND used_at IS NULL AND expires_at > now() AND failed_attempts < $2
     RETURNING customer_id`,
    [code, MAX_CODE_FAILURES]
  );

  if (updateResult.rows.length === 0) {
    // 消费失败：递增 failed_attempts
    await query(
      `UPDATE enrollment_codes SET failed_attempts = failed_attempts + 1
       WHERE code = $1 AND used_at IS NULL`,
      [code]
    );
    return null;
  }

  return { customerId: updateResult.rows[0].customer_id };
}
