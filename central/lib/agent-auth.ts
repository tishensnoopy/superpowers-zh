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

export async function revokeAgentToken(tokenId: string): Promise<void> {
  await query(`UPDATE agent_tokens SET revoked_at = now() WHERE id = $1`, [tokenId]);
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

export async function consumeEnrollmentCode(code: string): Promise<{ customerId: string } | null> {
  const result = await query<{ customer_id: string; expires_at: string; used_at: string | null }>(
    `SELECT customer_id, expires_at, used_at FROM enrollment_codes WHERE code = $1`,
    [code]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  if (row.used_at !== null) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  await query(`UPDATE enrollment_codes SET used_at = now() WHERE code = $1`, [code]);
  return { customerId: row.customer_id };
}
