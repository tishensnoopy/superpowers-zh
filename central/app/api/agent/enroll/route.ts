import { NextRequest } from 'next/server';
import { json, errorResponse } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { consumeEnrollmentCode, generateAgentToken } from '@/lib/agent-auth';

export async function POST(req: NextRequest) {
  const { enrollmentCode, hostname, displayName } = await req.json();
  if (!enrollmentCode || !hostname) {
    return errorResponse('enrollmentCode and hostname are required', 400);
  }

  const result = await consumeEnrollmentCode(enrollmentCode);
  if (!result) return errorResponse('Invalid or expired enrollment code', 401);

  let serverRow;
  try {
    const insertResult = await query<{ id: string }>(
      `INSERT INTO customer_servers (customer_id, hostname, display_name, status)
       VALUES ($1, $2, $3, 'offline') RETURNING id`,
      [result.customerId, hostname, displayName ?? null]
    );
    serverRow = insertResult.rows[0];
  } catch (err: any) {
    if (err.code === '23505') return errorResponse('Hostname already exists for this customer', 409);
    throw err;
  }

  const token = await generateAgentToken(serverRow.id);
  return json({ serverId: serverRow.id, agentToken: token }, 201);
}
