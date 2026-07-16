import type { WebSocket } from 'ws';
import { broadcastJobUpdate, broadcastJobLog, broadcastJobProgress } from './sse-broadcaster';

// Next.js dev mode loads modules in separate module graphs: the custom server
// (tsx) and route handlers (webpack) each get their own copy of this module.
// A plain `const connections = new Map()` would create two independent Maps,
// so server.ts adds to one Map while route handlers read from another (empty) Map.
// Fix: store the Map on globalThis so both module instances share the same one.
const globalForConnections = globalThis as unknown as {
  __centralConnections?: Map<string, Set<WebSocket>>;
};

const connections: Map<string, Set<WebSocket>> =
  globalForConnections.__centralConnections ?? new Map<string, Set<WebSocket>>();
if (!globalForConnections.__centralConnections) {
  globalForConnections.__centralConnections = connections;
}

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
