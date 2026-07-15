import { execa } from 'execa';

export interface PullResult {
  ok: boolean;
  output?: string;
  error?: string;
}

/**
 * 在指定目录执行 git pull，捕获 stdout/stderr。
 * 不抛异常，返回结构化结果，方便 executor 上报。
 */
export async function pullLatest(cwd: string): Promise<PullResult> {
  try {
    const { stdout, stderr } = await execa('git', ['pull'], { cwd });
    const output = (stdout + stderr).trim();
    if (output.includes('CONFLICT')) {
      return { ok: false, error: output };
    }
    return { ok: true, output };
  } catch (err: any) {
    const output = ((err.stdout ?? '') + (err.stderr ?? '') + (err.message ?? '')).trim();
    return { ok: false, error: output };
  }
}
