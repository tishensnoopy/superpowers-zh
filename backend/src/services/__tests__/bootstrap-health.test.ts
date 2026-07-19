import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runBootstrapHealthcheck } from '../bootstrap-health';

vi.mock('../kb-schema', () => ({
  ensureKbSchema: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../admin-locale-perms', () => ({
  ensureAdminLocalePermissions: vi.fn().mockResolvedValue({ patched: 0 }),
  ensureEditorContentPermissions: vi.fn().mockResolvedValue({ created: 0 }),
}));

const ENV_KEYS = [
  'DATABASE_CLIENT', 'DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_NAME', 'DATABASE_USERNAME', 'DATABASE_PASSWORD',
  'APP_KEYS', 'API_TOKEN_SALT', 'ADMIN_JWT_SECRET', 'TRANSFER_TOKEN_SALT', 'ENCRYPTION_KEY', 'JWT_SECRET',
  'MEILI_HOST', 'MEILI_MASTER_KEY',
];

describe('bootstrap-health 启动自检自愈', () => {
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = {};
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      process.env[k] = 'x';
    }
    delete process.env.REDIS_HOST;
  });
  afterEach(() => {
    for (const k of ENV_KEYS) process.env[k] = saved[k];
    delete process.env.REDIS_HOST;
  });

  function makeStrapi(rawImpl?: () => Promise<any>) {
    const raw = vi.fn().mockImplementation(rawImpl ?? (() => Promise.resolve({})));
    return { strapi: { db: { connection: { raw } } }, raw } as any;
  }

  it('全部正常：postgres ok（短路项先查）+ kb-schema 自愈执行 + env 齐全', async () => {
    const { strapi, raw } = makeStrapi();
    const report = await runBootstrapHealthcheck(strapi);

    expect(raw.mock.calls[0][0]).toBe('SELECT 1');
    const byName = Object.fromEntries(report.checks.map((c: any) => [c.name, c]));
    expect(byName['postgres'].level).toBe('ok');
    expect(byName['kb-schema'].level).toBe('ok');
    expect(byName['kb-schema'].healed).toBe(true);
    expect(byName['admin-locale-perms'].level).toBe('ok');
    expect(byName['admin-locale-perms'].healed).toBe(false);
    expect(byName['required-env'].level).toBe('ok');
    expect(report.ok).toBe(true);
    expect(report.failed).toEqual([]);
  });

  it('postgres 连接失败：level=fail 且短路返回（后续检查不执行）', async () => {
    const { strapi } = makeStrapi(() => Promise.reject(new Error('connection refused')));
    const report = await runBootstrapHealthcheck(strapi);

    expect(report.ok).toBe(false);
    expect(report.failed).toEqual(['postgres']);
    expect(report.checks.length).toBe(1);
    expect(report.checks[0].message).toContain('connection refused');
  });

  it('必填 env 缺失：列出缺失项，level=fail', async () => {
    delete process.env.MEILI_HOST;
    delete process.env.APP_KEYS;
    const { strapi } = makeStrapi();
    const report = await runBootstrapHealthcheck(strapi);

    const envCheck = report.checks.find((c: any) => c.name === 'required-env');
    expect(envCheck.level).toBe('fail');
    expect(envCheck.message).toContain('MEILI_HOST');
    expect(envCheck.message).toContain('APP_KEYS');
  });

  it('未配置 REDIS_HOST：warn（向量化禁用），不算 fail', async () => {
    const { strapi } = makeStrapi();
    const report = await runBootstrapHealthcheck(strapi);

    const redisCheck = report.checks.find((c: any) => c.name === 'redis');
    expect(redisCheck.level).toBe('warn');
    expect(report.ok).toBe(true);
  });

  it('kb-schema 自愈失败：level=fail 但不中断其他检查', async () => {
    const { ensureKbSchema } = await import('../kb-schema');
    (ensureKbSchema as any).mockRejectedValueOnce(new Error('permission denied'));
    const { strapi } = makeStrapi();
    const report = await runBootstrapHealthcheck(strapi);

    const byName = Object.fromEntries(report.checks.map((c: any) => [c.name, c]));
    expect(byName['kb-schema'].level).toBe('fail');
    expect(byName['required-env']).toBeDefined();
    expect(report.failed).toEqual(['kb-schema']);
  });

  it('admin-locale-perms 有修复动作：healed=true；自愈失败：level=fail 不中断', async () => {
    const { ensureAdminLocalePermissions } = await import('../admin-locale-perms');
    (ensureAdminLocalePermissions as any).mockResolvedValueOnce({ patched: 72 });
    const { strapi } = makeStrapi();
    const report1 = await runBootstrapHealthcheck(strapi);
    const check1 = report1.checks.find((c: any) => c.name === 'admin-locale-perms');
    expect(check1.level).toBe('ok');
    expect(check1.healed).toBe(true);
    expect(check1.message).toContain('72');

    (ensureAdminLocalePermissions as any).mockRejectedValueOnce(new Error('i18n not ready'));
    const report2 = await runBootstrapHealthcheck(strapi);
    const check2 = report2.checks.find((c: any) => c.name === 'admin-locale-perms');
    expect(check2.level).toBe('fail');
    expect(report2.checks.find((c: any) => c.name === 'required-env')).toBeDefined();
  });

  it('配置了 REDIS_HOST 但连接失败：warn 不算 fail，report.ok 仍为 true', async () => {
    process.env.REDIS_HOST = 'broken-redis';
    vi.doMock('ioredis', () => ({
      default: class {
        constructor(_opts: any) {}
        async connect() { throw new Error('connect ETIMEDOUT'); }
        async ping() { throw new Error('unreachable'); }
        disconnect() {}
      },
    }));
    const { strapi } = makeStrapi();
    const report = await runBootstrapHealthcheck(strapi);

    const redisCheck = report.checks.find((c: any) => c.name === 'redis');
    expect(redisCheck.level).toBe('warn');
    expect(redisCheck.message).toContain('ETIMEDOUT');
    expect(report.ok).toBe(true);

    vi.doUnmock('ioredis');
  });
});
