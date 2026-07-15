import type { WebSocket } from 'ws';
import { query } from '@/lib/db';
import { broadcastToAdmins } from './connections';
import { updateJobStatus } from './job-manager';

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

    case 'command:result': {
      // 通过状态机更新 job 状态（网络乱序/重复 result 时容忍冲突）
      try {
        await updateJobStatus(
          msg.commandId,
          msg.success ? 'success' : 'failed',
          { exitCode: msg.exitCode, errorMessage: msg.stderr }
        );
      } catch (err: unknown) {
        const msg_ = err instanceof Error ? err.message : String(err);
        if (!/invalid transition|job not found/.test(msg_)) throw err;
        console.warn(`[agent-router] command:result status conflict for ${msg.commandId}:`, msg_);
      }
      broadcastToAdmins('job:update', { jobId: msg.commandId, ...msg });
      break;
    }

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

    case 'command:ack': {
      try {
        await updateJobStatus(msg.commandId, 'running');
      } catch (err: unknown) {
        const msg_ = err instanceof Error ? err.message : String(err);
        if (!/invalid transition|job not found/.test(msg_)) throw err;
        console.warn(`[agent-router] command:ack status conflict for ${msg.commandId}:`, msg_);
      }
      break;
    }
  }
}
