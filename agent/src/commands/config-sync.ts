import { writeEnvFile } from '../lib/env-file';
import { runCompose, ComposeHooks } from '../lib/compose';
import { CommandHandler } from '../executor';

export type ConfigSyncCommand = {
  type: 'command:config-sync';
  commandId: string;
  envVars: Record<string, string>;
  restart: boolean;
};

export async function handleConfigSync(
  cmd: ConfigSyncCommand,
  dataDir: string,
  handler: CommandHandler,
  composeHooks: ComposeHooks,
  signal?: AbortSignal
): Promise<string> {
  const envPath = `${dataDir}/.env`;
  writeEnvFile(envPath, cmd.envVars);
  handler.onProgress('config-written', '.env updated');

  if (cmd.restart) {
    handler.onProgress('restart', 'restarting backend + frontend');
    const result = await runCompose(['restart', 'backend', 'frontend'], { cwd: dataDir, signal }, composeHooks);
    if (result.exitCode !== 0) {
      throw new Error(`restart failed: ${result.stderr}`);
    }
    handler.onProgress('restart-complete', 'services restarted');
  }

  return 'ok';
}
