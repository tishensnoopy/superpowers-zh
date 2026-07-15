#!/usr/bin/env node
import { loadConfig } from './config';
import { AgentConnection } from './connection';
import { performEnrollment } from './register';

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === 'register') {
    const centralApiUrl = requireEnv('--central');
    const enrollmentCode = requireEnv('--enrollment-code');
    const hostname = requireEnv('--hostname');
    const displayName = optionalArg('--display-name') ?? hostname;
    const envFile = optionalArg('--env-file') ?? '/etc/yousen-agent/agent.env';

    const result = await performEnrollment({ centralApiUrl, enrollmentCode, hostname, displayName, envFile });
    console.log(`[register] success. serverId=${result.serverId}`);
    console.log(`[register] agent.env written to ${envFile}`);
    process.exit(0);
  }

  const config = loadConfig();
  console.log(`[agent] starting. serverId=${config.serverId} central=${config.centralWsUrl}`);

  const conn = new AgentConnection(
    config.centralWsUrl,
    config.agentToken,
    config.serverId,
    (status) => console.log(`[agent] status: ${status}`)
  );
  conn.start();

  const shutdown = async (signal: string) => {
    console.log(`[agent] received ${signal}, shutting down...`);
    await conn.dispose();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

function requireEnv(flag: string): string {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || !process.argv[idx + 1]) {
    console.error(`Missing required flag: ${flag} <value>`);
    process.exit(1);
  }
  return process.argv[idx + 1];
}

function optionalArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

main().catch((err) => {
  console.error('[agent] fatal:', err);
  process.exit(1);
});
