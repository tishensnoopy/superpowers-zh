import { execa } from 'execa';

export interface ComposeOptions {
  cwd: string;
  signal?: AbortSignal;
}

export interface ComposeHooks {
  onLog: (stream: 'stdout' | 'stderr', line: string) => void;
}

export async function runCompose(
  args: string[],
  opts: ComposeOptions,
  hooks?: ComposeHooks
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const subprocess = execa('docker', ['compose', ...args], {
    cwd: opts.cwd,
    signal: opts.signal,
    reject: false,
  });

  subprocess.stdout?.on('data', (chunk: Buffer) => {
    if (!hooks) return;
    for (const line of chunk.toString().split('\n')) {
      if (line) hooks.onLog('stdout', line);
    }
  });
  subprocess.stderr?.on('data', (chunk: Buffer) => {
    if (!hooks) return;
    for (const line of chunk.toString().split('\n')) {
      if (line) hooks.onLog('stderr', line);
    }
  });

  const result = await subprocess;
  // 被 abort 杀死的子进程 exitCode 为 null，不能误报为 0（成功）
  if (opts.signal?.aborted || result.failed === true && result.exitCode === null) {
    throw new Error('command aborted');
  }
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode ?? 0,
  };
}
