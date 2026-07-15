import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface EnrollmentParams {
  centralApiUrl: string;
  enrollmentCode: string;
  hostname: string;
  displayName: string;
  envFile: string;
}

export interface EnrollmentResult {
  serverId: string;
  agentToken: string;
}

export async function performEnrollment(params: EnrollmentParams): Promise<EnrollmentResult> {
  const res = await fetch(`${params.centralApiUrl}/api/agent/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enrollmentCode: params.enrollmentCode,
      hostname: params.hostname,
      displayName: params.displayName || undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Enrollment failed with status ${res.status}`);
  }

  const result: EnrollmentResult = await res.json();

  mkdirSync(dirname(params.envFile), { recursive: true });
  const envContent = [
    `CENTRAL_API_URL=${params.centralApiUrl}`,
    `CENTRAL_WS_URL=${params.centralApiUrl.replace(/^http/, 'ws')}/api/agent/ws`,
    `SERVER_ID=${result.serverId}`,
    `AGENT_TOKEN=${result.agentToken}`,
    '',
  ].join('\n');
  writeFileSync(params.envFile, envContent, { mode: 0o600 });

  return result;
}
