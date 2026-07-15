import { execa } from 'execa';

export interface HealthcheckOptions {
  cwd: string;
  timeoutMs?: number;
}

export interface WaitForHealthyOptions {
  cwd: string;
  intervalMs: number;
  maxAttempts: number;
  onProgress: (info: { service: string; attempt: number; healthy: boolean }) => void;
}

export interface WaitForHealthyResult {
  ok: boolean;
  failedService?: string;
}

/**
 * 查询单个服务的健康状态。
 * 复刻 deploy.sh 的逻辑：docker compose ps <service> --format json，读 Health 字段。
 */
export async function checkServiceHealthy(service: string, opts: HealthcheckOptions): Promise<boolean> {
  try {
    const { stdout } = await execa(
      'docker',
      ['compose', 'ps', service, '--format', 'json'],
      { cwd: opts.cwd, timeout: opts.timeoutMs ?? 10000 }
    );
    if (!stdout.trim()) return false;
    // docker compose ps --format json 可能返回多行 JSON（每服务一行）
    for (const line of stdout.trim().split('\n')) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.Health && parsed.Health !== 'healthy') return false;
      } catch {
        // 忽略解析失败（某些 compose 版本输出格式不同）
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 按顺序等待多个服务健康，复刻 deploy.sh 的分阶段启动顺序：
 * 阶段1: postgres + redis + meilisearch（基础设施）
 * 阶段2: backend（Strapi）
 * 阶段3: frontend（Next.js）
 *
 * 此函数依次等待每个服务，每个服务最多 maxAttempts 次，每次间隔 intervalMs。
 * 如果某个服务在 maxAttempts 次后仍不健康，立即返回失败。
 */
export async function waitForServicesHealthy(
  services: string[],
  opts: WaitForHealthyOptions
): Promise<WaitForHealthyResult> {
  for (const service of services) {
    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      const healthy = await checkServiceHealthy(service, { cwd: opts.cwd });
      opts.onProgress({ service, attempt, healthy });
      if (healthy) break;
      if (attempt === opts.maxAttempts) {
        return { ok: false, failedService: service };
      }
      await new Promise((r) => setTimeout(r, opts.intervalMs));
    }
  }
  return { ok: true };
}
