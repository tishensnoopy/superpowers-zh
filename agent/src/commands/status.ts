import { runCompose, ComposeHooks } from '../lib/compose';

export type StatusCommand = {
  type: 'command:status';
  commandId: string;
};

export async function handleStatus(
  _cmd: StatusCommand,
  dataDir: string,
  composeHooks: ComposeHooks,
  signal?: AbortSignal
): Promise<string> {
  const result = await runCompose(['ps', '--format', 'json'], { cwd: dataDir, signal }, composeHooks);
  if (result.exitCode !== 0) throw new Error(`status failed: ${result.stderr}`);
  return result.stdout;
}
