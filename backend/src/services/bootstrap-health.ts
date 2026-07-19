/**
 * Strapi bootstrap 启动自检自愈。
 *
 * 母站开通即用（决策 D4/D5）：任何一项环境缺失必须在启动时暴露，
 * 而不是等客户用着用着某个功能悄悄坏掉。能自动修的（KB schema）自动修。
 */

export interface HealthCheck {
  name: string;
  level: 'ok' | 'warn' | 'fail';
  healed: boolean;
  message: string;
}

export interface HealthReport {
  checks: HealthCheck[];
  ok: boolean;
  failed: string[];
  durationMs: number;
}

const REQUIRED_ENV = [
  'DATABASE_CLIENT', 'DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_NAME', 'DATABASE_USERNAME', 'DATABASE_PASSWORD',
  'APP_KEYS', 'API_TOKEN_SALT', 'ADMIN_JWT_SECRET', 'TRANSFER_TOKEN_SALT', 'ENCRYPTION_KEY', 'JWT_SECRET',
  'MEILISEARCH_HOST', 'MEILISEARCH_API_KEY',
];

export async function runBootstrapHealthcheck(strapi: any): Promise<HealthReport> {
  const startedAt = Date.now();
  const checks: HealthCheck[] = [];

  // 1. postgres 连通（短路项：库不通则其余检查无意义）
  try {
    const db = strapi.db.connection;
    await db.raw('SELECT 1');
    checks.push({ name: 'postgres', level: 'ok', healed: false, message: 'connected' });
  } catch (err) {
    checks.push({
      name: 'postgres',
      level: 'fail',
      healed: false,
      message: `数据库连接失败: ${err instanceof Error ? err.message : err}`,
    });
    return finish(checks, startedAt);
  }

  // 2. kb-schema 自愈（幂等，缺表/缺索引自动建）
  try {
    const { ensureKbSchema } = await import('./kb-schema');
    await ensureKbSchema(strapi);
    checks.push({ name: 'kb-schema', level: 'ok', healed: true, message: 'pgvector/knowledge_embeddings/source_url 索引已确保存在' });
  } catch (err) {
    checks.push({
      name: 'kb-schema',
      level: 'fail',
      healed: false,
      message: `KB schema 自愈失败: ${err instanceof Error ? err.message : err}`,
    });
  }

  // 3. 必填 env
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  checks.push(
    missing.length === 0
      ? { name: 'required-env', level: 'ok', healed: false, message: '必填环境变量齐全' }
      : { name: 'required-env', level: 'fail', healed: false, message: `缺少必填环境变量: ${missing.join(', ')}` }
  );

  // 4. Redis（可选但配置了就必须通）
  if (process.env.REDIS_HOST) {
    let redis: any;
    try {
      const { default: Redis } = await import('ioredis');
      redis = new Redis({
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT ?? 6379),
        password: process.env.REDIS_PASSWORD || undefined,
        connectTimeout: 3000,
        lazyConnect: true,
        maxRetriesPerRequest: 0,
      });
      await redis.connect();
      await redis.ping();
      checks.push({ name: 'redis', level: 'ok', healed: false, message: 'connected' });
    } catch (err) {
      checks.push({
        name: 'redis',
        level: 'warn',
        healed: false,
        message: `Redis 连接失败（向量化队列不可用）: ${err instanceof Error ? err.message : err}`,
      });
    } finally {
      redis?.disconnect();
    }
  } else {
    checks.push({ name: 'redis', level: 'warn', healed: false, message: 'REDIS_HOST 未配置，向量化队列禁用' });
  }

  return finish(checks, startedAt);
}

function finish(checks: HealthCheck[], startedAt: number): HealthReport {
  const failed = checks.filter((c) => c.level === 'fail').map((c) => c.name);
  const warned = checks.filter((c) => c.level === 'warn').map((c) => c.name);
  const report: HealthReport = {
    checks,
    ok: failed.length === 0,
    failed,
    durationMs: Date.now() - startedAt,
  };

  // fail 打 error、warn 打 warn、全过打 info——都走 console，Strapi logger 此时未必就绪
  if (failed.length > 0) {
    console.error(`[bootstrap-health] FAIL: ${failed.join(', ')}`, JSON.stringify(report, null, 2));
  } else if (warned.length > 0) {
    console.warn(`[bootstrap-health] OK with warnings: ${warned.join(', ')}`, JSON.stringify(report, null, 2));
  } else {
    console.log(`[bootstrap-health] OK (${checks.length} checks, ${report.durationMs}ms)`);
  }
  return report;
}
