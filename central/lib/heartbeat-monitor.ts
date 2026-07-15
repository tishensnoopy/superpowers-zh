import { query } from './db';

export async function markStaleServersOffline(thresholdSeconds: number): Promise<number> {
  const result = await query(
    `UPDATE customer_servers
     SET status = 'offline'
     WHERE status = 'online'
       AND last_heartbeat IS NOT NULL
       AND last_heartbeat < now() - ($1 || ' seconds')::interval
     RETURNING id`,
    [String(thresholdSeconds)]
  );
  return result.rowCount ?? 0;
}

export function startHeartbeatMonitor(thresholdSeconds = 60, intervalMs = 10000): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      const count = await markStaleServersOffline(thresholdSeconds);
      if (count > 0) console.log(`[heartbeat-monitor] marked ${count} stale servers offline`);
    } catch (err) {
      console.error('[heartbeat-monitor] failed:', err);
    }
  }, intervalMs);
}
