import { readFileSync, existsSync } from 'node:fs';

export interface AgentConfig {
  centralWsUrl: string;
  centralApiUrl: string;
  serverId: string;
  agentToken: string;
}

const ENV_FILE = process.env.AGENT_ENV_FILE ?? '/etc/yousen-agent/agent.env';

/**
 * 从 WS URL 推导 API base：`wss://host/api/agent/ws` → `https://host/api/agent`。
 * 用 URL API 而非字符串 replace（`'wss://'.replace('ws','http')` 会产出 `httpss://`）。
 */
export function apiUrlFromWsUrl(wsUrl: string): string {
  const url = new URL(wsUrl);
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.pathname = url.pathname.replace(/\/ws\/?$/, '');
  return url.toString().replace(/\/$/, '');
}

export function loadConfig(): AgentConfig {
  if (process.env.CENTRAL_WS_URL && process.env.AGENT_TOKEN && process.env.SERVER_ID) {
    return {
      centralWsUrl: process.env.CENTRAL_WS_URL,
      centralApiUrl: process.env.CENTRAL_API_URL ?? apiUrlFromWsUrl(process.env.CENTRAL_WS_URL),
      serverId: process.env.SERVER_ID,
      agentToken: process.env.AGENT_TOKEN,
    };
  }
  if (existsSync(ENV_FILE)) {
    const content = readFileSync(ENV_FILE, 'utf8');
    const env: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
      if (m) env[m[1]] = m[2];
    }
    return {
      centralWsUrl: env.CENTRAL_WS_URL,
      centralApiUrl: env.CENTRAL_API_URL,
      serverId: env.SERVER_ID,
      agentToken: env.AGENT_TOKEN,
    };
  }
  throw new Error(`No config found. Set env vars or create ${ENV_FILE}`);
}

export const AGENT_VERSION = '0.1.0';
