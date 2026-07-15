import WebSocket from 'ws';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { AGENT_VERSION } from './config';
import { executeCommand } from './executor';

const HEARTBEAT_INTERVAL_MS = 30000;

export function calculateReconnectDelay(attempt: number): number {
  const base = Math.min(1000 * Math.pow(2, attempt), 60000);
  const jitter = Math.random() * 1000;
  return base + jitter;
}

export interface CommandHandler {
  onProgress: (stage: string, message: string) => void;
  onLog: (stream: 'stdout' | 'stderr', line: string) => void;
}

export class AgentConnection {
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private disposed = false;
  private readonly onStatusChange: (status: 'online' | 'offline') => void;
  private processedCommands = new Set<string>();

  constructor(
    private readonly wsUrl: string,
    private readonly token: string,
    private readonly serverId: string,
    onStatusChange?: (status: 'online' | 'offline') => void
  ) {
    this.onStatusChange = onStatusChange ?? (() => {});
  }

  start(): void {
    this.disposed = false;
    this.connect();
  }

  private connect(): void {
    const url = `${this.wsUrl}?token=${this.token}`;
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.reconnectAttempt = 0;
      this.onStatusChange('online');
      this.sendRegister();
      this.startHeartbeat();
    });

    this.ws.on('message', (raw) => {
      try {
        const cmd = JSON.parse(raw.toString());
        this.handleCommand(cmd).catch((err) => {
          console.error('[agent] command failed:', err);
        });
      } catch (err) {
        console.error('[agent] message parse failed:', err);
      }
    });

    this.ws.on('close', () => {
      this.stopHeartbeat();
      this.onStatusChange('offline');
      if (!this.disposed) this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[agent] ws error:', err.message);
    });
  }

  private sendRegister(): void {
    this.send({
      type: 'agent:register',
      serverId: this.serverId,
      agentVersion: AGENT_VERSION,
      hostname: os.hostname(),
      dockerVersion: this.getDockerVersion(),
    });
  }

  private getDockerVersion(): string {
    try { return execSync('docker --version', { encoding: 'utf8' }).trim(); }
    catch { return 'unknown'; }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const heartbeat = this.collectHeartbeat();
      this.send({ type: 'agent:heartbeat', ...heartbeat });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private collectHeartbeat() {
    const cpu = os.loadavg()[0];
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const mem = (totalMem - freeMem) / totalMem;
    const disk = this.getDiskUsage();
    return { cpu, mem, disk, services: [] };
  }

  private getDiskUsage(): number {
    try {
      const out = execSync(`df -P / | awk 'NR==2 {print $5}'`, { encoding: 'utf8' }).trim();
      return parseFloat(out) / 100;
    } catch { return 0; }
  }

  private async handleCommand(cmd: any): Promise<void> {
    if (this.processedCommands.has(cmd.commandId)) return;
    this.processedCommands.add(cmd.commandId);
    setTimeout(() => this.processedCommands.delete(cmd.commandId), 5 * 60 * 1000);

    this.send({ type: 'command:ack', commandId: cmd.commandId, receivedAt: new Date().toISOString() });

    const startedAt = Date.now();
    const hooks: CommandHandler = {
      onProgress: (stage, message) => this.send({ type: 'command:progress', commandId: cmd.commandId, stage, message }),
      onLog: (stream, line) => this.send({ type: 'log:line', jobId: cmd.jobId ?? cmd.commandId, stream, line, ts: new Date().toISOString() }),
    };

    try {
      const stdout = await executeCommand(cmd, hooks);
      this.send({
        type: 'command:result', commandId: cmd.commandId, success: true,
        stdout, durationMs: Date.now() - startedAt,
      });
    } catch (err: any) {
      this.send({
        type: 'command:result', commandId: cmd.commandId, success: false,
        exitCode: err.exitCode ?? 1, stderr: err.message, durationMs: Date.now() - startedAt,
      });
    }
  }

  private scheduleReconnect(): void {
    const delay = calculateReconnectDelay(this.reconnectAttempt++);
    console.log(`[agent] reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempt})`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private send(msg: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    if (this.ws) {
      await new Promise<void>((resolve) => {
        if (this.ws!.readyState === WebSocket.CLOSED) return resolve();
        this.ws!.once('close', () => resolve());
        this.ws!.close(1001, 'agent shutdown');
        setTimeout(() => {
          if (this.ws!.readyState !== WebSocket.CLOSED) this.ws!.terminate();
          resolve();
        }, 1000);
      });
    }
  }
}
