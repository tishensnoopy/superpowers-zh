import { runCompose, ComposeHooks } from '../lib/compose';

export type LogsCommand = {
  type: 'command:logs';
  commandId: string;
  service: string;
  tail: number;
};

export async function handleLogs(
  cmd: LogsCommand,
  dataDir: string,
  composeHooks: ComposeHooks,
  signal?: AbortSignal
): Promise<string> {
  const result = await runCompose(
    ['logs', '--tail', String(cmd.tail), cmd.service],
    { cwd: dataDir, signal },
    composeHooks
  );
  if (result.exitCode !== 0) throw new Error(`logs failed: ${result.stderr}`);
  return result.stdout;
}
