import { ComposeHooks } from './lib/compose';
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
  | { type: 'command:deploy'; commandId: string; jobId?: string; imageTag?: string; envVars?: Record<string, string>; mode?: 'nginx' | 'direct' }
  | { type: 'command:cancel'; commandId: string };

export async function executeCommand(cmd: Command, hooks: CommandHandler): Promise<string | undefined> {
  const composeHooks: ComposeHooks = { onLog: hooks.onLog };

  // cancel 和 deploy 不需要预创建 AbortController：
  // cancel 需要检查 registry 中是否已存在 controller（否则 createAbortController
  // 会新建一个空 controller，导致 abortCommand 永远返回 true，'no running task' 分支成为死代码）
  if (cmd.type === 'command:cancel') {
    const aborted = abortCommand(cmd.commandId);
    return aborted ? 'cancelled' : 'no running task';
  }

  if (cmd.type === 'command:deploy') {
    // M4 实现
    throw new Error('deploy not implemented yet (M4)');
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

      default:
        throw new Error(`unknown command type: ${(cmd as any).type}`);
    }
  } finally {
    cleanupAbortController(cmd.commandId);
  }
}
