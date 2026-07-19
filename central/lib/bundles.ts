import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { query } from './db';

const REPO_PATH = process.env.CENTRAL_CODE_REPO ?? '/opt/central-code-repo';
const BUNDLE_DIR = process.env.CENTRAL_BUNDLE_DIR ?? path.join(process.cwd(), 'data', 'bundles');

export interface BundleDeps {
  repoPath?: string;
  bundleDir?: string;
  execImpl?: (cmd: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
  statImpl?: (p: string) => Promise<{ size: number }>;
  queryImpl?: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>;
}

const defaultExec = (cmd: string, args: string[]) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) =>
      err ? reject(Object.assign(err, { stderr })) : resolve({ stdout, stderr })
    );
  });

export async function buildBundle(
  bundle: { id: string; ref: string },
  deps: BundleDeps = {}
): Promise<{ id: string; path: string; sizeBytes: number }> {
  const repoPath = deps.repoPath ?? REPO_PATH;
  const bundleDir = deps.bundleDir ?? BUNDLE_DIR;
  const execImpl = deps.execImpl ?? defaultExec;
  const statImpl = deps.statImpl ?? stat;
  const queryImpl = deps.queryImpl ?? query;

  await mkdir(bundleDir, { recursive: true });
  const filePath = path.join(bundleDir, `${bundle.id}.tar.gz`);

  try {
    await execImpl('git', ['-C', repoPath, 'fetch', '--all', '--tags', '--prune']);
    await execImpl('git', ['-C', repoPath, 'archive', '--format=tar.gz', '-o', filePath, bundle.ref]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await queryImpl(`UPDATE bundles SET status='failed', error=$1 WHERE id=$2`, [message, bundle.id]);
    throw err;
  }

  const { size } = await statImpl(filePath);
  await queryImpl(`UPDATE bundles SET status='ready', size_bytes=$1 WHERE id=$2`, [size, bundle.id]);
  return { id: bundle.id, path: filePath, sizeBytes: size };
}

export function bundlePath(id: string, deps: BundleDeps = {}): string {
  return path.join(deps.bundleDir ?? BUNDLE_DIR, `${id}.tar.gz`);
}
