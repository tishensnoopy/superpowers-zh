/**
 * 客户后台 Editor 账号管理（创建/重置/停用，幂等）。
 *
 * 为什么走 admin 体系而非 users-permissions：
 *   Strapi 社区版后台面板只有 3 个固定角色，Editor（strapi-editor）可管全部内容、
 *   不能改系统设置/用户——正好匹配"客户管内容、运营方管系统"。
 *   users-permissions 的 client-admin 角色只约束 REST API，对后台面板无效。
 *
 * 用法（backend 容器内）：
 *   # 创建或重置（已存在则重置密码+激活）
 *   npx tsx scripts/create-editor-account.ts --email zl@example.com --password 'Str0ng!Passw0rd' --firstname 朱莉
 *   # 停用（客户终止合作）
 *   npx tsx scripts/create-editor-account.ts --email zl@example.com --deactivate
 */

export interface EditorAccountParams {
  email: string;
  password?: string;
  firstname?: string;
  lastname?: string;
  deactivate?: boolean;
}

export async function manageEditorAccount(
  strapi: any,
  params: EditorAccountParams
): Promise<{ action: 'created' | 'updated' | 'deactivated'; email: string }> {
  const role = await strapi.db.query('admin::role').findOne({ where: { code: 'strapi-editor' } });
  if (!role) throw new Error('strapi-editor role not found（Strapi 初始化不完整）');

  const userService = strapi.service('admin::user');
  const existing = await strapi.db.query('admin::user').findOne({ where: { email: params.email } });

  if (params.deactivate) {
    if (!existing) throw new Error(`账号不存在: ${params.email}`);
    await userService.updateById(existing.id, { isActive: false });
    return { action: 'deactivated', email: params.email };
  }

  if (!params.password) {
    throw new Error('创建/重置账号必须提供 password（建议 12 位以上含大小写数字符号）');
  }

  if (existing) {
    // 幂等重置：密码 + 确保 Editor 角色 + 激活。哈希由 admin::user 服务内部完成
    await userService.updateById(existing.id, {
      password: params.password,
      isActive: true,
      roles: [role.id],
    });
    return { action: 'updated', email: params.email };
  }

  await userService.create({
    email: params.email,
    password: params.password,
    firstname: params.firstname ?? '客户',
    lastname: params.lastname ?? '管理员',
    isActive: true,
    roles: [role.id],
  });
  return { action: 'created', email: params.email };
}

function parseArgs(argv: string[]): EditorAccountParams {
  const params: EditorAccountParams = { email: '' };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--deactivate') params.deactivate = true;
    else if (arg === '--email') params.email = argv[++i];
    else if (arg === '--password') params.password = argv[++i];
    else if (arg === '--firstname') params.firstname = argv[++i];
    else if (arg === '--lastname') params.lastname = argv[++i];
  }
  if (!params.email) {
    console.error('用法: npx tsx scripts/create-editor-account.ts --email <邮箱> [--password <密码>] [--firstname <名>] [--lastname <姓>] [--deactivate]');
    process.exit(1);
  }
  return params;
}

/**
 * 加载 Strapi 工厂。tsx/esbuild 下原生 import('@strapi/strapi') 会把
 * @strapi/core 的 ESM dist 拉进来，其内部 `import 'lodash/fp'` 在 node ESM
 * 解析下要求 lodash/fp/index.js（不存在）而失败；CJS require 走 fp.js 正常。
 * 因此优先原生 import，失败回退 createRequire（与 strapi develop 的 CJS 链路一致）。
 */
async function loadCreateStrapi(): Promise<(opts?: any) => { load: () => Promise<any> }> {
  try {
    const m = await import('@strapi/strapi');
    return (m as any).createStrapi ?? (m as any).default?.createStrapi;
  } catch {
    const { createRequire } = await import('module');
    const req = createRequire(process.cwd() + '/index.js');
    const m = req('@strapi/strapi');
    return m.createStrapi ?? m.default?.createStrapi;
  }
}

async function main() {
  const params = parseArgs(process.argv);
  const createStrapi = await loadCreateStrapi();
  // 显式指定 distDir：脚本在 tsx 下运行时 Strapi 的 TS 探测会误判，
  // 导致去 ./config 加载 .ts 配置报 "extension must be one of .js,.json"
  const path = await import('path');
  const strapi = await createStrapi({
    appDir: process.cwd(),
    distDir: path.join(process.cwd(), 'dist'),
  }).load();
  try {
    const result = await manageEditorAccount(strapi, params);
    console.log(`[create-editor-account] ${result.action}: ${result.email}`);
    if (result.action !== 'deactivated') {
      console.log('[create-editor-account] 请告知客户登录后第一时间在 Profile 修改密码');
    }
  } finally {
    await strapi.destroy();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
