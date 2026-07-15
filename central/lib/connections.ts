import type { WebSocket } from 'ws';

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

export function broadcastToAdmins(_event: string, _data: unknown): void {
  // M4 实现：通过 SSE 推给浏览器
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
