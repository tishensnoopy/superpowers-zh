import { execFile } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { open } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export interface BundleDeps {
  fetchImpl?: typeof fetch;
  writeImpl?: (file: string, chunk: Uint8Array) => Promise<void>;
  execImpl?: (cmd: string, args: string[]) => Promise<void>;
  downloadImpl?: typeof downloadBundle;
  tmpDir?: string;
}

const defaultExec = (cmd: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024 }, (err, _stdout, stderr) =>
      err ? reject(new Error(`${cmd} failed: ${stderr || err.message}`)) : resolve()
    );
  });

/** 下载发布包到本地文件（流式，带 agent token 鉴权） */
export async function downloadBundle(
  opts: { url: string; token: string; destFile: string },
  deps: BundleDeps = {}
): Promise<number> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const res = await fetchImpl(opts.url, {
    headers: { Authorization: `Bearer ${opts.token}` },
    redirect: 'manual',
  });
  if (!res.ok || !res.body) {
    throw new Error(`bundle download failed: HTTP ${res.status} from ${opts.url}`);
  }

  let size = 0;
  const reader = res.body.getReader();
  try {
    if (deps.writeImpl) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        await deps.writeImpl(opts.destFile, value);
      }
      return size;
    }

    // 生产路径：流式写盘
    mkdirSync(path.dirname(opts.destFile), { recursive: true });
    const fh = await open(opts.destFile, 'w');
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        await fh.write(value);
      }
    } finally {
      await fh.close();
    }
    return size;
  } finally {
    reader.releaseLock();
  }
}

/**
 * 发布包同步到部署目录（rsync --delete 语义，防陈旧文件）。
 * 排除：.env（实例配置）、backend/public/uploads/（实例媒体库）——代码分发绝不覆盖实例数据。
 */
export async function syncBundleToDir(
  opts: { url: string; token: string; dataDir: string },
  deps: BundleDeps = {}
): Promise<void> {
  const execImpl = deps.execImpl ?? defaultExec;
  const tmp = deps.tmpDir ?? path.join(os.tmpdir(), `bundle-${Date.now()}`);
  const tarFile = path.join(tmp, 'release.tar.gz');
  const extractDir = path.join(tmp, 'extract');

  const downloadImpl = deps.downloadImpl ?? ((o: { url: string; token: string; destFile: string }) =>
    downloadBundle(o, { fetchImpl: deps.fetchImpl }));

  mkdirSync(extractDir, { recursive: true });
  try {
    await downloadImpl({ url: opts.url, token: opts.token, destFile: tarFile });
    await execImpl('tar', ['-xzf', tarFile, '-C', extractDir, '--no-same-owner']);
    // git archive 根目录无包裹层，直接同步内容
    await execImpl('rsync', [
      '-a', '--delete',
      '--exclude', '.env',
      '--exclude', 'backend/public/uploads/',
      '--exclude', 'node_modules/',
      `${extractDir}/`,
      `${opts.dataDir}/`,
    ]);
  } finally {
    await execImpl('rm', ['-rf', tmp]).catch(() => {});
  }
}
