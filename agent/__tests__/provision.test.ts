import { describe, it, expect, vi } from 'vitest';
import { handleProvision } from '../src/commands/provision';

function makeDeps() {
  return {
    syncBundle: vi.fn(async () => {}),
    writeEnv: vi.fn(),
    runCompose: vi.fn(async () => ({ exitCode: 0 })),
    waitHealthy: vi.fn(async () => ({ ok: true })),
    agentToken: 'tok',
  };
}

const baseCmd = {
  type: 'command:provision' as const,
  commandId: 'c1',
  jobId: 'j1',
  bundleUrl: '/api/agent/bundles/b-1/download',
  centralApiUrl: 'http://central:3100',
  envVars: { APP_KEYS: 'k', JWT_SECRET: 'j' },
  mode: 'direct' as const,
};

describe('provision 从零开通编排', () => {
  it('顺序：写 env → 同步 bundle → compose up --build → 健康检查 → KB resync', async () => {
    const deps = makeDeps();
    const hooks = { onLog: vi.fn(), onProgress: vi.fn() };
    const order: string[] = [];
    deps.writeEnv.mockImplementation(() => { order.push('env'); });
    deps.syncBundle.mockImplementation(async () => { order.push('bundle'); });
    deps.runCompose.mockImplementation(async (args: string[]) => {
      order.push(args.includes('exec') ? 'kb-resync' : 'compose-up');
      return { exitCode: 0 };
    });
    deps.waitHealthy.mockImplementation(async () => { order.push('health'); return { ok: true }; });

    const result = await handleProvision(baseCmd, '/data', hooks, new AbortController().signal, deps);

    expect(order).toEqual(['env', 'bundle', 'compose-up', 'health', 'kb-resync']);
    expect(deps.syncBundle).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://central:3100/api/agent/bundles/b-1/download', token: 'tok', dataDir: '/data' })
    );
    expect(result.success).toBe(true);
  });

  it('写 env 失败 → success:false，stderr 含原因，不执行后续步骤', async () => {
    const deps = makeDeps();
    deps.writeEnv.mockImplementation(() => { throw new Error('ENOENT: no such file or directory'); });
    const hooks = { onLog: vi.fn(), onProgress: vi.fn() };

    const result = await handleProvision(baseCmd, '/data', hooks, new AbortController().signal, deps);

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('ENOENT');
    expect(deps.syncBundle).not.toHaveBeenCalled();
    expect(deps.runCompose).not.toHaveBeenCalled();
  });

  it('健康检查失败 → success:false，不跑 KB resync', async () => {
    const deps = makeDeps();
    deps.waitHealthy.mockResolvedValue({ ok: false, failedService: 'backend' });
    const hooks = { onLog: vi.fn(), onProgress: vi.fn() };

    const result = await handleProvision(baseCmd, '/data', hooks, new AbortController().signal, deps);

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('backend');
    const execCalls = deps.runCompose.mock.calls.filter((c) => c[0].includes('exec'));
    expect(execCalls.length).toBe(0);
  });

  it('KB resync 失败只告警不致命（内容 CRUD 会补派生）', async () => {
    const deps = makeDeps();
    deps.runCompose.mockImplementation(async (args: string[]) => ({
      exitCode: args.includes('exec') ? 1 : 0,
    }));
    const hooks = { onLog: vi.fn(), onProgress: vi.fn() };

    const result = await handleProvision(baseCmd, '/data', hooks, new AbortController().signal, deps);
    expect(result.success).toBe(true);
    expect(hooks.onLog).toHaveBeenCalledWith('stderr', expect.stringContaining('KB resync'));
  });

  it('compose up 失败 → success:false', async () => {
    const deps = makeDeps();
    deps.runCompose.mockResolvedValue({ exitCode: 1 });
    const hooks = { onLog: vi.fn(), onProgress: vi.fn() };

    const result = await handleProvision(baseCmd, '/data', hooks, new AbortController().signal, deps);

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('docker compose up failed');
    expect(deps.waitHealthy).not.toHaveBeenCalled();
  });

  it('nginx 模式使用双 compose 文件且健康检查覆盖 nginx 服务', async () => {
    const deps = makeDeps();
    const hooks = { onLog: vi.fn(), onProgress: vi.fn() };

    const result = await handleProvision(
      { ...baseCmd, mode: 'nginx' },
      '/data',
      hooks,
      new AbortController().signal,
      deps
    );

    expect(result.success).toBe(true);
    const upArgs = deps.runCompose.mock.calls.find((c) => !c[0].includes('exec'))![0];
    expect(upArgs).toEqual(['-f', 'docker-compose.yml', '-f', 'docker-compose.nginx.yml', 'up', '-d', '--build']);
    const services = deps.waitHealthy.mock.calls[0][0];
    expect(services).toContain('nginx');
  });
});
