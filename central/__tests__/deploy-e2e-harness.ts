/**
 * M4 部署流程集成测试夹具：mock git/docker，模拟完整部署 5 分钟流程在毫秒级完成。
 * 被 deploy-flow.test.ts 和 M5 的 e2e/full-flow.spec.ts 复用。
 *
 * 设计说明：execa 是 agent 运行时依赖，未在 central/package.json 声明，因此 harness
 * 不能直接 `import { execa } from 'execa'`（tsc 与 vitest 均无法解析）。改为由调用方
 * 通过 vi.hoisted 创建 mock 函数并传入，harness 只负责在其上安装 mockImplementation。
 *
 * 用法：
 *   const { execaMock } = vi.hoisted(() => ({ execaMock: vi.fn() }));
 *   vi.mock('execa', () => ({ execa: execaMock }));
 *   installDeployMocks(opts, execaMock);
 */
import { vi } from 'vitest';

/** execa mock 函数类型 */
export type ExecaMock = ReturnType<typeof vi.fn>;

export interface HarnessOptions {
  /** 健康检查结果序列；每次 docker compose ps 调用按顺序返回 */
  healthSequence?: string[];
  /** git pull 输出 */
  gitPullOutput?: string;
  /** 是否模拟 git pull 失败 */
  gitPullFail?: boolean;
  /** docker compose up 输出 */
  composeUpOutput?: string;
}

/**
 * 在传入的 execa mock 上安装 git/docker 的 mock 实现。
 * @param opts mock 行为选项
 * @param execaMock 由调用方通过 vi.hoisted 创建的 mock 函数
 */
export function installDeployMocks(opts: HarnessOptions = {}, execaMock: ExecaMock) {
  const healthSeq = opts.healthSequence ?? ['healthy'];
  let healthIdx = 0;
  const gitPullFail = opts.gitPullFail ?? false;
  const gitPullOutput = opts.gitPullOutput ?? 'Fast-forward\n';
  const composeUpOutput = opts.composeUpOutput ?? 'Container yousen-backend Started\n';

  execaMock.mockImplementation(async (cmd: string, args?: readonly string[]) => {
    // git pull
    if (cmd === 'git') {
      if (gitPullFail) {
        throw { stdout: '', stderr: 'CONFLICT', exitCode: 1, message: 'pull failed' };
      }
      return { stdout: gitPullOutput, stderr: '', exitCode: 0 } as any;
    }
    // docker compose ps <svc> --format json
    if (cmd === 'docker' && args?.[1] === 'ps') {
      const health = healthSeq[Math.min(healthIdx, healthSeq.length - 1)];
      healthIdx++;
      return { stdout: JSON.stringify({ Health: health }), stderr: '', exitCode: 0 } as any;
    }
    // docker compose up -d --build
    if (cmd === 'docker' && args?.[1] === 'up') {
      return { stdout: composeUpOutput, stderr: '', exitCode: 0 } as any;
    }
    return { stdout: '', stderr: '', exitCode: 0 } as any;
  });

  return {
    reset: () => {
      healthIdx = 0;
      vi.clearAllMocks();
    },
  };
}

/** 构造一个标准 deploy 命令（bundle 模式：bundleUrl 必填，否则 agent fail-fast） */
export function makeDeployCommand(overrides: Partial<any> = {}) {
  return {
    commandId: 'test-cmd-' + Math.random().toString(36).slice(2),
    type: 'command:deploy' as const,
    jobId: 'test-job-' + Math.random().toString(36).slice(2),
    imageTag: 'unused',
    mode: 'nginx' as const,
    bundleUrl: '/api/agent/bundles/test-b-1/download',
    centralApiUrl: 'http://test-central',
    envVars: { NEXT_PUBLIC_SITE_URL: 'https://test.example.com' },
    ...overrides,
  };
}
