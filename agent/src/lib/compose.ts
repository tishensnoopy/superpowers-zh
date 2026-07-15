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

  let stdout = '';
  let stderr = '';
  subprocess.stdout?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    stdout += text;
    if (hooks) {
      for (const line of text.split('\n')) {
        if (line) hooks.onLog('stdout', line);
      }
    }
  });
  subprocess.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    stderr += text;
    if (hooks) {
      for (const line of text.split('\n')) {
        if (line) hooks.onLog('stderr', line);
      }
    }
  });

  const result = await subprocess;
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode ?? 0,
  };
}
