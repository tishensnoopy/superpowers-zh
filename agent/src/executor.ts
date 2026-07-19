import { runCompose, type ComposeHooks } from './lib/compose';
import { createAbortController, abortCommand, cleanupAbortController } from './lib/abort-registry';
import { handleConfigSync } from './commands/config-sync';
import { handleRestart } from './commands/restart';
import { handleStatus } from './commands/status';
import { handleLogs } from './commands/logs';

const DATA_DIR = process.env.AGENT_DATA_DIR ?? '/data';

export interface CommandHandler {
  onProgress: (stage: string, message: string) => void;
  onLog: (stream: 'stdout' | 'stderr', line: string) => void;
}

export type Command =
  | { type: 'command:config-sync'; commandId: string; envVars: Record<string, string>; restart: boolean }
  | { type: 'command:restart'; commandId: string; services: string[] }
  | { type: 'command:status'; commandId: string }
  | { type: 'command:logs'; commandId: string; service: string; tail: number }
  | { type: 'command:deploy'; commandId: string; jobId?: string; imageTag?: string; bundleUrl?: string; centralApiUrl?: string; envVars?: Record<string, string>; mode?: 'nginx' | 'direct' }
  | { type: 'command:provision'; commandId: string; jobId?: string; bundleUrl: string; centralApiUrl: string; envVars: Record<string, string>; mode?: 'nginx' | 'direct'; postSyncKb?: boolean }
  | { type: 'command:cancel'; commandId: string };

export async function executeCommand(cmd: Command, hooks: CommandHandler): Promise<string | undefined> {
  const composeHooks: ComposeHooks = { onLog: hooks.onLog };

  // cancel 需要检查 registry 中是否已存在 controller，不能预创建 AbortController：
  // 否则 createAbortController 会新建一个空 controller，导致 abortCommand 永远返回 true，
  // 'no running task' 分支成为死代码
  if (cmd.type === 'command:cancel') {
    const aborted = abortCommand(cmd.commandId);
    return aborted ? 'cancelled' : 'no running task';
  }

  const controller = createAbortController(cmd.commandId);
  try {
    switch (cmd.type) {
      case 'command:config-sync':
        return await handleConfigSync(cmd, DATA_DIR, hooks, composeHooks, controller.signal);

      case 'command:restart':
        return await handleRestart(cmd, DATA_DIR, hooks, composeHooks, controller.signal);

      case 'command:status':
        return await handleStatus(cmd, DATA_DIR, composeHooks, controller.signal);

      case 'command:logs':
        return await handleLogs(cmd, DATA_DIR, composeHooks, controller.signal);

      case 'command:deploy': {
        const { handleDeploy } = await import('./commands/deploy');
        const { loadConfig } = await import('./config');
        const cfg = loadConfig();
        const deployResult = await handleDeploy(
          cmd as any,
          DATA_DIR,
          hooks,
          {
            runCompose: async (args, opts, composeHooks) => {
              const r = await runCompose(args, opts, composeHooks);
              return { exitCode: r.exitCode };
            },
          },
          controller.signal,
          { agentToken: cfg.agentToken, centralApiUrl: cfg.centralApiUrl }
        );
        if (!deployResult.success) {
          throw Object.assign(new Error(deployResult.stderr ?? 'deploy failed'), {
            exitCode: deployResult.exitCode ?? 1,
          });
        }
        return `deploy completed in ${deployResult.durationMs}ms`;
      }

      case 'command:provision': {
        const { handleProvision } = await import('./commands/provision');
        const { syncEnvFile } = await import('./lib/env-file');
        const { syncBundleToDir } = await import('./lib/bundle');
        const { waitForServicesHealthy } = await import('./lib/healthcheck');
        const { loadConfig } = await import('./config');
        const cfg = loadConfig();
        const result = await handleProvision(
          { ...cmd, mode: cmd.mode ?? 'direct' } as any,
          DATA_DIR,
          hooks,
          controller.signal,
          {
            syncBundle: syncBundleToDir,
            writeEnv: syncEnvFile,
            runCompose: async (args, opts, composeHooks) => {
              const r = await runCompose(args, opts, composeHooks);
              return { exitCode: r.exitCode };
            },
            waitHealthy: (services, o) =>
              waitForServicesHealthy(services, { cwd: o.cwd, intervalMs: 5000, maxAttempts: 24, onProgress: o.onProgress as any }),
            agentToken: cfg.agentToken,
          }
        );
        if (!result.success) {
          throw Object.assign(new Error(result.stderr ?? 'provision failed'), { exitCode: 1 });
        }
        return `provision completed in ${result.durationMs}ms`;
      }

      default:
        throw new Error(`unknown command type: ${(cmd as any).type}`);
    }
  } finally {
    cleanupAbortController(cmd.commandId);
  }
}
