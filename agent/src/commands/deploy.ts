import { pullLatest } from '../lib/git-pull';
import { waitForServicesHealthy } from '../lib/healthcheck';
import { syncEnvFile } from '../lib/env-file';
import type { ComposeHooks } from '../lib/compose';

export interface DeployCommand {
  commandId: string;
  type: 'command:deploy';
  jobId: string;
  imageTag: string;              // 保留字段，本期忽略（仍用 build context 模式）
  envVars?: Record<string, string>;
  mode: 'nginx' | 'direct';
}

export interface CommandHandler {
  onLog: (stream: 'stdout' | 'stderr', line: string) => void;
  onProgress: (stage: string, message: string) => void;
}

export interface ComposeRunner {
  runCompose(args: string[], opts: { cwd: string; signal?: AbortSignal }, hooks: ComposeHooks): Promise<{ exitCode: number }>;
}

export interface DeployOptions {
  healthcheckIntervalMs?: number;
  healthcheckMaxAttempts?: number;
}

export interface DeployResult {
  success: boolean;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  durationMs: number;
}

/**
 * 执行部署：写 .env（可选）→ git pull → docker compose up --build → 健康检查。
 *
 * imageTag 字段保留为未来切换到镜像仓库 pull 模式时使用，本期忽略。
 * 当前实现沿用现有 docker-compose.yml 的 build context 模式。
 */
export async function handleDeploy(
  cmd: DeployCommand,
  dataDir: string,
  hooks: CommandHandler,
  composeRunner: ComposeRunner,
  signal: AbortSignal,
  opts: DeployOptions = {}
): Promise<DeployResult> {
  const start = Date.now();
  const intervalMs = opts.healthcheckIntervalMs ?? 5000;
  const maxAttempts = opts.healthcheckMaxAttempts ?? 24;  // 默认 2 分钟（与 deploy.sh 一致）

  // 步骤 0：检查取消
  if (signal.aborted) {
    return { success: false, stderr: 'aborted before start', durationMs: Date.now() - start };
  }

  // 步骤 1：写 .env（可选）
  if (cmd.envVars && Object.keys(cmd.envVars).length > 0) {
    try {
      const envPath = `${dataDir}/.env`;
      syncEnvFile(envPath, cmd.envVars);
      hooks.onProgress('config-written', '.env updated');
    } catch (err: any) {
      return { success: false, stderr: `failed to write .env: ${err.message}`, durationMs: Date.now() - start };
    }
  }

  // 步骤 2：git pull
  hooks.onProgress('git-pull', 'pulling latest code');
  const pullResult = await pullLatest(dataDir);
  if (!pullResult.ok) {
    return { success: false, stderr: pullResult.error, durationMs: Date.now() - start };
  }
  if (pullResult.output) hooks.onLog('stdout', pullResult.output);

  // 步骤 3：docker compose up --build
  hooks.onProgress('build', 'building and starting containers');
  const upArgs = cmd.mode === 'nginx'
    ? ['-f', 'docker-compose.yml', '-f', 'docker-compose.nginx.yml', 'up', '-d', '--build']
    : ['up', '-d', '--build'];
  try {
    const upResult = await composeRunner.runCompose(
      upArgs,
      { cwd: dataDir, signal },
      { onLog: (stream, line) => hooks.onLog(stream, line) }
    );
    if (upResult.exitCode !== 0) {
      return { success: false, exitCode: upResult.exitCode, stderr: 'docker compose up failed', durationMs: Date.now() - start };
    }
  } catch (err: any) {
    if (signal.aborted) {
      return { success: false, stderr: 'aborted during build', durationMs: Date.now() - start };
    }
    return { success: false, stderr: err.message, durationMs: Date.now() - start };
  }

  // 步骤 4：健康检查（复刻 deploy.sh 顺序）
  hooks.onProgress('healthcheck', 'waiting for healthchecks');
  const services = cmd.mode === 'nginx'
    ? ['postgres', 'redis', 'meilisearch', 'backend', 'frontend', 'nginx']
    : ['postgres', 'redis', 'meilisearch', 'backend', 'frontend'];
  const healthResult = await waitForServicesHealthy(services, {
    cwd: dataDir,
    intervalMs,
    maxAttempts,
    onProgress: (info) => {
      hooks.onLog('stdout', `[healthcheck] ${info.service} attempt=${info.attempt} healthy=${info.healthy}`);
    },
  });
  if (!healthResult.ok) {
    return {
      success: false,
      stderr: `healthcheck failed for service: ${healthResult.failedService}`,
      durationMs: Date.now() - start,
    };
  }

  return { success: true, exitCode: 0, durationMs: Date.now() - start };
}
