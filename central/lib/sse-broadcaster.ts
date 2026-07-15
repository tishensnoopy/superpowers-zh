/**
 * SSE 广播器：维护 jobId → client Set 映射。
 * Agent 上报的 log:line / command:progress / command:result 通过这里推给浏览器。
 *
 * 每个客户端是一个 WritableStreamDefaultWriter（由 Route Handler 创建）。
 */
type SSEClient = WritableStreamDefaultWriter<Uint8Array>;
const clients = new Map<string, Set<SSEClient>>();

export function addSSEClient(jobId: string, writer: SSEClient): void {
  if (!clients.has(jobId)) clients.set(jobId, new Set());
  clients.get(jobId)!.add(writer);
}

export function removeSSEClient(jobId: string, writer: SSEClient): void {
  const set = clients.get(jobId);
  if (!set) return;
  set.delete(writer);
  if (set.size === 0) clients.delete(jobId);
}

/**
 * 向指定 job 的所有 SSE 订阅者推送一条事件。
 * SSE 格式：`event: <event>\ndata: <json>\n\n`
 */
export function broadcastToJob(jobId: string, event: string, data: unknown): void {
  const set = clients.get(jobId);
  if (!set || set.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoded = new TextEncoder().encode(payload);
  for (const writer of set) {
    try {
      // writer.write() 返回 Promise；同步 throw 立即捕获，异步 reject 通过 .catch 清理
      writer.write(encoded).catch(() => set.delete(writer));
    } catch {
      // 同步失败（writer 已 closed/errored），立即清理
      set.delete(writer);
    }
  }
  if (set.size === 0) clients.delete(jobId);
}

export function broadcastJobUpdate(jobId: string, payload: object): void {
  broadcastToJob(jobId, 'job:update', payload);
}

export function broadcastJobLog(jobId: string, payload: { stream: string; line: string; ts?: string }): void {
  broadcastToJob(jobId, 'job:log', payload);
}

export function broadcastJobProgress(jobId: string, payload: { stage: string; message: string }): void {
  broadcastToJob(jobId, 'job:progress', payload);
}

/** 测试用：清空所有订阅（仅测试环境调用） */
export function __resetSSEClients(): void {
  clients.clear();
}
