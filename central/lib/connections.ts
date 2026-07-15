import type { WebSocket } from 'ws';
import { broadcastJobUpdate, broadcastJobLog, broadcastJobProgress } from './sse-broadcaster';

const connections = new Map<string, Set<WebSocket>>();

export function addConnection(serverId: string, ws: WebSocket): () => void {
  if (!connections.has(serverId)) connections.set(serverId, new Set());
  connections.get(serverId)!.add(ws);
  return () => {
    connections.get(serverId)?.delete(ws);
    if (connections.get(serverId)?.size === 0) connections.delete(serverId);
  };
}

export function getConnections(serverId: string): WebSocket[] {
  return Array.from(connections.get(serverId) ?? []);
}

export function isOnline(serverId: string): boolean {
  return (connections.get(serverId)?.size ?? 0) > 0;
}

export function broadcastToAdmins(event: string, data: unknown): void {
  // 兼容 M2 留的接口：根据 event 名转发到对应 SSE 广播器
  if (event === 'job:update' && data && typeof data === 'object' && 'jobId' in data) {
    broadcastJobUpdate((data as { jobId: string }).jobId, data);
  } else if (event === 'job:log' && data && typeof data === 'object' && 'jobId' in data) {
    broadcastJobLog((data as { jobId: string }).jobId, data as unknown as { stream: string; line: string; ts?: string });
  } else if (event === 'job:progress' && data && typeof data === 'object' && 'jobId' in data) {
    broadcastJobProgress((data as { jobId: string }).jobId, data as unknown as { stage: string; message: string });
  }
  // server:heartbeat 等不通过 SSE 推（M5 的 audit/可观测性可选）
}

export async function sendToServer(serverId: string, message: unknown): Promise<boolean> {
  const sockets = getConnections(serverId);
  if (sockets.length === 0) return false;
  const data = JSON.stringify(message);
  for (const ws of sockets) {
    if (ws.readyState === ws.OPEN) ws.send(data);
  }
  return true;
}
