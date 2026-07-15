import { runCompose, ComposeHooks } from '../lib/compose';
import { CommandHandler } from '../executor';

export type RestartCommand = {
  type: 'command:restart';
  commandId: string;
  services: string[];
};

export async function handleRestart(
  cmd: RestartCommand,
  dataDir: string,
  handler: CommandHandler,
  composeHooks: ComposeHooks,
  signal?: AbortSignal
): Promise<string> {
  handler.onProgress('restart', `restarting: ${cmd.services.join(', ')}`);
  const result = await runCompose(['restart', ...cmd.services], { cwd: dataDir, signal }, composeHooks);
  if (result.exitCode !== 0) throw new Error(`restart failed: ${result.stderr}`);
  return 'ok';
}
