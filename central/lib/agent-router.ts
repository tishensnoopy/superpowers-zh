import type { WebSocket } from 'ws';
import { query } from '@/lib/db';
import { broadcastToAdmins } from './connections';

export type AgentMessage =
  | { type: 'agent:register'; serverId: string; agentVersion: string; hostname: string; dockerVersion: string }
  | { type: 'agent:heartbeat'; cpu: number; mem: number; disk: number; services: Array<{ name: string; status: string }> }
  | { type: 'command:ack'; commandId: string; receivedAt: string }
  | { type: 'command:progress'; commandId: string; stage: string; message: string }
  | { type: 'command:result'; commandId: string; success: boolean; exitCode?: number; stdout?: string; stderr?: string; durationMs: number }
  | { type: 'log:line'; jobId: string; stream: string; line: string; ts: string };

export async function handleAgentMessage(ws: WebSocket, serverId: string, msg: AgentMessage): Promise<void> {
  switch (msg.type) {
    case 'agent:register':
      await query(
        `UPDATE customer_servers SET status='online', agent_version=$1, meta=COALESCE(meta,'{}'::jsonb) || $2::jsonb
         WHERE id=$3`,
        [msg.agentVersion, JSON.stringify({ hostname: msg.hostname, dockerVersion: msg.dockerVersion }), serverId]
      );
      ws.send(JSON.stringify({ type: 'agent:welcome', serverId }));
      break;

    case 'agent:heartbeat':
      await query(
        `UPDATE customer_servers SET last_heartbeat=now(), status='online', meta=$1 WHERE id=$2`,
        [JSON.stringify({ cpu: msg.cpu, mem: msg.mem, disk: msg.disk, services: msg.services }), serverId]
      );
      broadcastToAdmins('server:heartbeat', { serverId, ...msg });
      break;

    case 'command:result':
      await query(
        `UPDATE deploy_jobs SET status=$1, finished_at=now(), exit_code=$2, error_message=$3 WHERE id=$4`,
        [msg.success ? 'success' : 'failed', msg.exitCode ?? null, msg.stderr ?? null, msg.commandId]
      );
      broadcastToAdmins('job:update', { jobId: msg.commandId, ...msg });
      break;

    case 'command:progress':
      broadcastToAdmins('job:progress', { jobId: msg.commandId, ...msg });
      break;

    case 'log:line':
      await query(
        `INSERT INTO job_logs (job_id, stream, line) VALUES ($1,$2,$3)`,
        [msg.jobId, msg.stream, msg.line]
      );
      broadcastToAdmins('job:log', { ...msg, jobId: msg.jobId });
      break;

    case 'command:ack':
      await query(`UPDATE deploy_jobs SET status='running', started_at=now() WHERE id=$1`, [msg.commandId]);
      break;
  }
}
