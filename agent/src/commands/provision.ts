import type { ComposeHooks } from '../lib/compose';

export interface ProvisionCommand {
  type: 'command:provision';
  commandId: string;
  jobId: string;
  bundleUrl: string;             // 相对路径
  centralApiUrl: string;
  envVars: Record<string, string>;
  mode: 'nginx' | 'direct';
  postSyncKb?: boolean;          // 默认 true
}

export interface ProvisionDeps {
  syncBundle: (opts: { url: string; token: string; dataDir: string }) => Promise<void>;
  writeEnv: (envPath: string, vars: Record<string, string>) => void;
  runCompose: (args: string[], opts: { cwd: string; signal?: AbortSignal }, hooks: ComposeHooks) => Promise<{ exitCode: number }>;
  waitHealthy: (services: string[], opts: { cwd: string; onProgress?: (i: unknown) => void }) => Promise<{ ok: boolean; failedService?: string }>;
  agentToken: string;
}

export interface ProvisionResult {
  success: boolean;
  stderr?: string;
  durationMs: number;
}

const SERVICES_NGINX = ['postgres', 'redis', 'meilisearch', 'backend', 'frontend', 'nginx'];
const SERVICES_DIRECT = ['postgres', 'redis', 'meilisearch', 'backend', 'frontend'];

/**
 * 从零开通编排：env → bundle → compose up --build → 健康检查 → KB 初始化。
 * 幂等可重跑：env 覆盖写、bundle rsync --delete、compose up 幂等。
 */
export async function handleProvision(
  cmd: ProvisionCommand,
  dataDir: string,
  hooks: { onLog: (s: 'stdout' | 'stderr', l: string) => void; onProgress: (stage: string, msg: string) => void },
  signal: AbortSignal,
  deps: ProvisionDeps
): Promise<ProvisionResult> {
  const start = Date.now();
  const composeHooks: ComposeHooks = { onLog: hooks.onLog };

  // 1. 写 .env（central 下发的完整配置，含随机生成的密钥）
  hooks.onProgress('env', 'writing .env from central config');
  try {
    deps.writeEnv(`${dataDir}/.env`, cmd.envVars);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, stderr: `failed to write .env: ${msg}`, durationMs: Date.now() - start };
  }

  // 2. 发布包同步
  hooks.onProgress('bundle', 'downloading and syncing release bundle');
  await deps.syncBundle({ url: `${cmd.centralApiUrl}${cmd.bundleUrl}`, token: deps.agentToken, dataDir });

  // 3. compose up --build
  hooks.onProgress('build', 'building and starting containers');
  const upArgs = cmd.mode === 'nginx'
    ? ['-f', 'docker-compose.yml', '-f', 'docker-compose.nginx.yml', 'up', '-d', '--build']
    : ['up', '-d', '--build'];
  const up = await deps.runCompose(upArgs, { cwd: dataDir, signal }, composeHooks);
  if (up.exitCode !== 0) {
    return { success: false, stderr: 'docker compose up failed', durationMs: Date.now() - start };
  }

  // 4. 健康检查（backend bootstrap 自检自愈会在此阶段建 pgvector/KB 表/索引）
  hooks.onProgress('healthcheck', 'waiting for healthchecks');
  const services = cmd.mode === 'nginx' ? SERVICES_NGINX : SERVICES_DIRECT;
  const health = await deps.waitHealthy(services, {
    cwd: dataDir,
    onProgress: (info: any) => hooks.onLog('stdout', `[healthcheck] ${info.service} attempt=${info.attempt} healthy=${info.healthy}`),
  });
  if (!health.ok) {
    return { success: false, stderr: `healthcheck failed for service: ${health.failedService}`, durationMs: Date.now() - start };
  }

  // 5. KB 初始化（由本实例种子内容派生；失败不致命，后续内容 CRUD 会补派生）
  if (cmd.postSyncKb !== false) {
    hooks.onProgress('kb-sync', 'initializing knowledge base from instance content');
    const kb = await deps.runCompose(
      ['exec', '-T', 'backend', 'npx', 'tsx', 'scripts/resync-knowledge-base.ts'],
      { cwd: dataDir, signal },
      composeHooks
    );
    if (kb.exitCode !== 0) {
      hooks.onLog('stderr', 'KB resync failed (non-fatal): 可在内容发布后自动补派生，或手动重跑');
    }
  }

  return { success: true, durationMs: Date.now() - start };
}
