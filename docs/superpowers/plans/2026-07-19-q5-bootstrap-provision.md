# Q5 母站：bootstrap 自检自愈 + 一键开通 + KB 注入隔离 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** ① backend 启动时自动检查并修复 pgvector 扩展、`knowledge_embeddings` 表、`source_url` 唯一索引、必填 env、Redis 连通性（本次 KB 表漏建事故永不复发）；② 新客户从零开通固化为一条命令；③ KB 注入隔离落地——母站克隆时 KB 零携带，100% 由新实例自身内容派生。

**架构：** DDL 单一事实来源抽为 `kb-schema.ts`，bootstrap 自检服务与向量化 worker 共用；`runBootstrapHealthcheck` 在 bootstrap 最前面执行，缺表/缺索引自愈，缺扩展尝试自愈（容器内 postgres 是 superuser），缺 env/Redis 告警不阻断；一键开通脚本 `provision-new-customer.sh` 编排"预检→rsync→env→deploy.sh→数据脚本→验证清单"；KB 隔离 = 零硬编码种子（Q1 已做）+ rsync 排除 DB/uploads + `reset-knowledge-base.ts` 兜底。

**技术栈：** Strapi v5 bootstrap、knex raw SQL、ioredis、BullMQ、bash/rsync/sshpass、docker compose。

**规格来源：** `docs/superpowers/specs/2026-07-19-master-site-hardening-design.md` Q5 节（决策 D5=做 B1，D7=保留内容占位种子+KB 隔离逻辑）。

**前置依赖：** Q1 计划已合入（KB 无硬编码种子、source_url 唯一索引 SQL 已在 rebuild 脚本出现——本计划把它上移为 bootstrap 自愈项，两处 SQL 一致且都 `IF NOT EXISTS`，幂等不冲突）。

---

## 关键事实（实施前必读，已核实）

- `backend/src/queues/document-processor.ts:65-97` 现有 `ensureSchema` 是**懒执行**（首个向量化 job 才触发）——这就是 fresh 部署 `/api/chat/message` 500 的根因（KB 表不存在时检索 SQL 直接报错）。
- 现有 DDL（必须原样保留，worker 已在生产用它建过表）：
  - `CREATE EXTENSION IF NOT EXISTS vector`
  - `CREATE TABLE IF NOT EXISTS knowledge_embeddings (id BIGSERIAL PRIMARY KEY, knowledge_base_id BIGINT NOT NULL, chunk_index INTEGER NOT NULL, chunk_text TEXT NOT NULL, embedding vector, source_type VARCHAR(50) DEFAULT 'document', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`
  - `CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_kb_id ON knowledge_embeddings (knowledge_base_id)`
- `backend/src/index.ts:51` bootstrap 当前无任何自检。
- `deploy.sh`（仓库根目录）已支持 `--no-pull`（rsync 模式）与分阶段健康检查；开通脚本复用它，不重造轮子。
- rsync 部署排除项（项目既定约束）：`.env`、`backend/public/uploads/`、`node_modules`、`.git`。
- 服务器 DB：容器内 `postgres` 用户是 superuser，`CREATE EXTENSION vector` 可自愈；若遇非 superuser 环境则降级为醒目告警。
- 测试命令：`cd backend && npx vitest run`；脚本语法检查：`bash -n <file>`。

## 文件结构

- 创建：`backend/src/services/kb-schema.ts` — DDL 单一事实来源（`ensureKbSchema(strapi)`）
- 修改：`backend/src/queues/document-processor.ts:60-97` — `ensureSchema` 委托 `ensureKbSchema`（行为不变）
- 创建：`backend/src/services/bootstrap-health.ts` — `runBootstrapHealthcheck(strapi)` 自检自愈
- 修改：`backend/src/index.ts:51-53` — bootstrap 最前面调用自检
- 创建：`backend/src/services/__tests__/kb-schema.test.ts`
- 创建：`backend/src/services/__tests__/bootstrap-health.test.ts`
- 创建：`backend/scripts/reset-knowledge-base.ts` — KB 清空（DB 克隆场景隔离兜底）
- 创建：`backend/scripts/__tests__/reset-knowledge-base.test.ts`
- 创建：`provision-new-customer.sh`（仓库根目录）— 一键开通编排

---

### 任务 1：kb-schema.ts——DDL 单一事实来源

**文件：**
- 创建：`backend/src/services/kb-schema.ts`
- 修改：`backend/src/queues/document-processor.ts:60-97`
- 测试：`backend/src/services/__tests__/kb-schema.test.ts`

- [ ] **步骤 1：编写失败的测试**

创建 `backend/src/services/__tests__/kb-schema.test.ts`：

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ensureKbSchema, KB_SOURCE_URL_UNIQUE_INDEX_SQL } from '../kb-schema';

describe('kb-schema.ensureKbSchema', () => {
  it('按序执行：CREATE EXTENSION → CREATE TABLE → 两个 CREATE INDEX', async () => {
    const raw = vi.fn().mockResolvedValue({});
    const strapi: any = { db: { connection: { raw } } };

    await ensureKbSchema(strapi);

    const sqls = raw.mock.calls.map((c) => String(c[0]));
    expect(sqls.length).toBe(4);
    expect(sqls[0]).toContain('CREATE EXTENSION IF NOT EXISTS vector');
    expect(sqls[1]).toContain('CREATE TABLE IF NOT EXISTS knowledge_embeddings');
    expect(sqls[1]).toContain('knowledge_base_id BIGINT NOT NULL');
    expect(sqls[1]).toContain('embedding vector');
    expect(sqls[2]).toContain('idx_knowledge_embeddings_kb_id');
    expect(sqls[3]).toBe(KB_SOURCE_URL_UNIQUE_INDEX_SQL);
  });

  it('CREATE EXTENSION 失败（非 superuser）只告警不中断，后续 DDL 照常执行', async () => {
    const raw = vi.fn()
      .mockRejectedValueOnce(new Error('permission denied'))
      .mockResolvedValue({});
    const strapi: any = { db: { connection: { raw } } };

    await expect(ensureKbSchema(strapi)).resolves.toBeUndefined();
    expect(raw).toHaveBeenCalledTimes(4);
  });

  it('source_url 唯一索引是部分索引（WHERE source_url IS NOT NULL，放行手工文档）', () => {
    expect(KB_SOURCE_URL_UNIQUE_INDEX_SQL).toContain('UNIQUE INDEX IF NOT EXISTS');
    expect(KB_SOURCE_URL_UNIQUE_INDEX_SQL).toContain('source_url');
    expect(KB_SOURCE_URL_UNIQUE_INDEX_SQL).toContain('WHERE source_url IS NOT NULL');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd backend && npx vitest run src/services/__tests__/kb-schema.test.ts`
预期：FAIL——模块不存在。

- [ ] **步骤 3：实现 kb-schema.ts + 改造 document-processor**

创建 `backend/src/services/kb-schema.ts`：

```typescript
/**
 * knowledge_embeddings（pgvector 裸表）与 knowledge_bases.source_url 唯一索引的
 * DDL 单一事实来源。bootstrap 自检（bootstrap-health）与向量化 worker
 * （document-processor.ensureSchema）共用，禁止各自另写 DDL。
 */

export const KB_SOURCE_URL_UNIQUE_INDEX_SQL =
  'CREATE UNIQUE INDEX IF NOT EXISTS knowledge_bases_source_url_unique ON knowledge_bases (source_url) WHERE source_url IS NOT NULL';

export async function ensureKbSchema(strapi: any): Promise<void> {
  const db = strapi.db.connection;

  try {
    await db.raw('CREATE EXTENSION IF NOT EXISTS vector');
  } catch (err) {
    // 扩展可能已存在或需要 superuser；建表/插入会暴露更明确的错误
    console.warn(
      '[kb-schema] CREATE EXTENSION vector skipped:',
      err instanceof Error ? err.message : err
    );
  }

  await db.raw(`
    CREATE TABLE IF NOT EXISTS knowledge_embeddings (
      id BIGSERIAL PRIMARY KEY,
      knowledge_base_id BIGINT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      embedding vector,
      source_type VARCHAR(50) DEFAULT 'document',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.raw(
    'CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_kb_id ON knowledge_embeddings (knowledge_base_id)'
  );

  // content-sync 防重复（NULL 放行：manual/pdf 等手工文档无 sourceUrl）
  await db.raw(KB_SOURCE_URL_UNIQUE_INDEX_SQL);

  console.log('[kb-schema] knowledge_embeddings + source_url index ensured');
}
```

修改 `backend/src/queues/document-processor.ts`：删除第 60-97 行的 `ensureSchema` 函数体，替换为：

```typescript
/**
 * Ensures the `knowledge_embeddings` pgvector table exists. The table is a raw
 * SQL table (not a Strapi content type) so it must be created out-of-band.
 * DDL 统一由 services/kb-schema.ts 提供（与 bootstrap 自检同源）。
 */
async function ensureSchema(strapi: any): Promise<void> {
  const { ensureKbSchema } = await import('../services/kb-schema');
  await ensureKbSchema(strapi);
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd backend && npx vitest run src/services/__tests__/kb-schema.test.ts && npx vitest run src/queues 2>/dev/null; npx vitest run`
预期：新测试 PASS；全量测试无回归（document-processor 行为不变）。

- [ ] **步骤 5：Commit**

```bash
git add backend/src/services/kb-schema.ts backend/src/services/__tests__/kb-schema.test.ts backend/src/queues/document-processor.ts
git commit -m "refactor(kb): DDL 抽为 kb-schema 单一事实来源，worker 与 bootstrap 自检共用"
```

---

### 任务 2：bootstrap-health.ts——启动自检自愈

**文件：**
- 创建：`backend/src/services/bootstrap-health.ts`
- 修改：`backend/src/index.ts:51-53`
- 测试：`backend/src/services/__tests__/bootstrap-health.test.ts`

- [ ] **步骤 1：编写失败的测试**

创建 `backend/src/services/__tests__/bootstrap-health.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runBootstrapHealthcheck } from '../bootstrap-health';

const REQUIRED_ENV = ['APP_KEYS', 'JWT_SECRET', 'DATABASE_HOST', 'DATABASE_NAME', 'DATABASE_USERNAME', 'DATABASE_PASSWORD'];

function setRequiredEnv() {
  for (const k of REQUIRED_ENV) process.env[k] = process.env[k] ?? 'test-value';
}

describe('bootstrap-health.runBootstrapHealthcheck', () => {
  beforeEach(() => {
    setRequiredEnv();
    delete process.env.REDIS_HOST;
  });
  afterEach(() => {
    for (const k of REQUIRED_ENV) delete process.env[k];
  });

  it('全部正常 → ok:true，无 fail 级检查项', async () => {
    const raw = vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });
    const strapi: any = { db: { connection: { raw } } };

    const report = await runBootstrapHealthcheck(strapi);

    expect(report.ok).toBe(true);
    expect(report.checks.every((c) => c.level !== 'fail')).toBe(true);
    // kb schema 自检一定执行（DDL 幂等）
    const schemaCheck = report.checks.find((c) => c.name === 'kb-schema');
    expect(schemaCheck).toBeTruthy();
    expect(schemaCheck!.level).toBe('ok');
  });

  it('DB 不通 → ok:false 且直接短路（后续检查跳过）', async () => {
    const raw = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'));
    const strapi: any = { db: { connection: { raw } } };

    const report = await runBootstrapHealthcheck(strapi);

    expect(report.ok).toBe(false);
    expect(report.checks[0]).toMatchObject({ name: 'postgres', level: 'fail' });
    expect(report.checks.length).toBe(1);
  });

  it('缺必填 env → fail，并指出缺哪个', async () => {
    delete process.env.JWT_SECRET;
    const raw = vi.fn().mockResolvedValue({ rows: [] });
    const strapi: any = { db: { connection: { raw } } };

    const report = await runBootstrapHealthcheck(strapi);

    expect(report.ok).toBe(false);
    const envCheck = report.checks.find((c) => c.name === 'required-env');
    expect(envCheck).toMatchObject({ level: 'fail' });
    expect(envCheck!.message).toContain('JWT_SECRET');
  });

  it('REDIS_HOST 已配置但连不通 → warn（队列不可用，不阻断启动）', async () => {
    process.env.REDIS_HOST = '127.0.0.1';
    process.env.REDIS_PORT = '1'; // 必连不通
    const raw = vi.fn().mockResolvedValue({ rows: [] });
    const strapi: any = { db: { connection: { raw } } };

    const report = await runBootstrapHealthcheck(strapi);

    const redisCheck = report.checks.find((c) => c.name === 'redis');
    expect(redisCheck).toBeTruthy();
    expect(redisCheck!.level).toBe('warn');
    expect(report.ok).toBe(true); // warn 不影响整体 ok
  });

  it('REDIS_HOST 未配置 → warn 提示队列禁用', async () => {
    const raw = vi.fn().mockResolvedValue({ rows: [] });
    const strapi: any = { db: { connection: { raw } } };

    const report = await runBootstrapHealthcheck(strapi);

    const redisCheck = report.checks.find((c) => c.name === 'redis');
    expect(redisCheck!.level).toBe('warn');
    expect(redisCheck!.message).toContain('REDIS_HOST');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd backend && npx vitest run src/services/__tests__/bootstrap-health.test.ts`
预期：FAIL——模块不存在。

- [ ] **步骤 3：实现 bootstrap-health + 接入 bootstrap**

创建 `backend/src/services/bootstrap-health.ts`：

```typescript
/**
 * bootstrap 自检自愈（决策 D5）。
 *
 * 启动时检查并尽力修复母站运行前提，fresh 部署首启即自检：
 *   1. postgres 连通（不通 → fail 短路）
 *   2. kb-schema（pgvector 扩展 + knowledge_embeddings 表 + 索引）→ 自动建（幂等自愈）
 *   3. 必填 env → 缺失 fail
 *   4. Redis（配置了 REDIS_HOST 时）→ 连不通 warn（队列禁用，不阻断）
 *
 * 设计原则：schema 缺失自愈；环境/凭据缺失醒目告警——自愈不该掩盖配置错误。
 */

export interface HealthCheck {
  name: string;
  level: 'ok' | 'warn' | 'fail';
  healed: boolean;
  message: string;
}

export interface HealthReport {
  ok: boolean; // 无 fail 即 true
  checks: HealthCheck[];
}

const REQUIRED_ENV = [
  'APP_KEYS',
  'JWT_SECRET',
  'DATABASE_HOST',
  'DATABASE_NAME',
  'DATABASE_USERNAME',
  'DATABASE_PASSWORD',
];

export async function runBootstrapHealthcheck(strapi: any): Promise<HealthReport> {
  const checks: HealthCheck[] = [];
  const db = strapi.db.connection;

  // 1. postgres 连通（短路项）
  try {
    await db.raw('SELECT 1');
    checks.push({ name: 'postgres', level: 'ok', healed: false, message: 'connected' });
  } catch (err) {
    checks.push({
      name: 'postgres',
      level: 'fail',
      healed: false,
      message: `数据库连接失败: ${err instanceof Error ? err.message : err}`,
    });
    return finish(checks);
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
    try {
      const { default: Redis } = await import('ioredis');
      const redis = new Redis({
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT ?? 6379),
        password: process.env.REDIS_PASSWORD || undefined,
        connectTimeout: 3000,
        lazyConnect: true,
        maxRetriesPerRequest: 0,
      });
      await redis.connect();
      await redis.ping();
      redis.disconnect();
      checks.push({ name: 'redis', level: 'ok', healed: false, message: 'connected' });
    } catch (err) {
      checks.push({
        name: 'redis',
        level: 'warn',
        healed: false,
        message: `Redis 连接失败（向量化队列不可用）: ${err instanceof Error ? err.message : err}`,
      });
    }
  } else {
    checks.push({ name: 'redis', level: 'warn', healed: false, message: 'REDIS_HOST 未配置，向量化队列禁用' });
  }

  return finish(checks);
}

function finish(checks: HealthCheck[]): HealthReport {
  const ok = checks.every((c) => c.level !== 'fail');
  for (const c of checks) {
    const icon = c.level === 'ok' ? '✓' : c.level === 'warn' ? '!' : '✗';
    const line = `[Healthcheck] ${icon} ${c.name}: ${c.message}${c.healed ? ' (healed)' : ''}`;
    if (c.level === 'fail') console.error(line);
    else if (c.level === 'warn') console.warn(line);
    else console.log(line);
  }
  return { ok, checks };
}
```

修改 `backend/src/index.ts` bootstrap 开头（第 51-53 行 `console.log('[Bootstrap] Starting up...')` 之后）插入：

```typescript
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    console.log('[Bootstrap] Starting up...');

    // 启动自检自愈（D5）：pgvector/KB 表/索引缺了自动建，env/Redis 缺失醒目告警
    try {
      const { runBootstrapHealthcheck } = await import('./services/bootstrap-health');
      const report = await runBootstrapHealthcheck(strapi);
      if (!report.ok) {
        console.error('[Bootstrap] 自检存在 fail 项，请检查上方 [Healthcheck] 输出');
      }
    } catch (err) {
      console.error('[Bootstrap] 自检执行异常（不阻断启动）:', err instanceof Error ? err.message : err);
    }

```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd backend && npx vitest run src/services/__tests__/bootstrap-health.test.ts && npx vitest run`
预期：新测试 5/5 PASS；全量无回归。

- [ ] **步骤 5：Commit**

```bash
git add backend/src/services/bootstrap-health.ts backend/src/services/__tests__/bootstrap-health.test.ts backend/src/index.ts
git commit -m "feat(bootstrap): 启动自检自愈——pgvector/KB表/索引自动建，env/Redis 缺失告警"
```

---

### 任务 3：reset-knowledge-base.ts——KB 注入隔离兜底

**文件：**
- 创建：`backend/scripts/reset-knowledge-base.ts`
- 测试：`backend/scripts/__tests__/reset-knowledge-base.test.ts`

**隔离逻辑（决策 D7 落地）：** 三层防线——① KB 零硬编码种子（Q1 任务 4 已做）；② 部署走 rsync 只同步代码，DB/uploads 不跨实例；③ 若运维用 DB dump 克隆实例，必须先跑本脚本清空 KB，再由本实例内容重新派生（`syncWebsiteContent`）。

- [ ] **步骤 1：编写失败的测试**

创建 `backend/scripts/__tests__/reset-knowledge-base.test.ts`：

```typescript
import { describe, it, expect, vi } from 'vitest';
import { resetKnowledgeBase } from '../reset-knowledge-base';

describe('reset-knowledge-base（KB 注入隔离兜底）', () => {
  it('删除全部 KB 文档并清空 embeddings，返回计数', async () => {
    const deleteKb = vi.fn().mockResolvedValue({});
    const findManyKb = vi.fn().mockResolvedValue([
      { id: 1, documentId: 'kb1' },
      { id: 2, documentId: 'kb2' },
      { id: 3, documentId: 'kb3' },
    ]);
    const raw = vi.fn().mockResolvedValue({});
    const strapi: any = {
      db: { connection: { raw }, query: vi.fn(() => ({ findMany: findManyKb })) },
      documents: vi.fn(() => ({ delete: deleteKb })),
    };

    const result = await resetKnowledgeBase(strapi);

    expect(deleteKb).toHaveBeenCalledTimes(3);
    expect(deleteKb).toHaveBeenCalledWith({ documentId: 'kb1' });
    expect(raw).toHaveBeenCalledWith('DELETE FROM knowledge_embeddings');
    expect(result).toEqual({ deletedDocs: 3 });
  });

  it('KB 已空 → 安全空跑', async () => {
    const raw = vi.fn().mockResolvedValue({});
    const strapi: any = {
      db: { connection: { raw }, query: vi.fn(() => ({ findMany: vi.fn().mockResolvedValue([]) })) },
      documents: vi.fn(() => ({ delete: vi.fn() })),
    };

    const result = await resetKnowledgeBase(strapi);
    expect(result).toEqual({ deletedDocs: 0 });
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd backend && npx vitest run scripts/__tests__/reset-knowledge-base.test.ts`
预期：FAIL——模块不存在。

- [ ] **步骤 3：实现脚本**

创建 `backend/scripts/reset-knowledge-base.ts`：

```typescript
/**
 * KB 清空（母站克隆的 KB 注入隔离兜底，决策 D7）。
 *
 * 何时用：用母站 DB dump 克隆新实例时，clone 里带着母站的 KB 文档与向量。
 *         启动前跑本脚本清空，随后实例自身内容经 syncWebsiteContent 重新派生 KB。
 * 何时不用：正常 fresh 部署（rsync 只同步代码，DB 全新）无需执行——
 *           KB 本来就空，bootstrap 种子发布后生命周期自动派生。
 *
 * 用法（backend 容器内）：npx tsx scripts/reset-knowledge-base.ts
 */

export async function resetKnowledgeBase(strapi: any): Promise<{ deletedDocs: number }> {
  const docs = await strapi.db
    .query('api::knowledge-base.knowledge-base')
    .findMany({ limit: 10000 });

  for (const doc of docs) {
    await strapi.documents('api::knowledge-base.knowledge-base').delete({ documentId: doc.documentId });
  }

  await strapi.db.connection.raw('DELETE FROM knowledge_embeddings');

  console.log(`[reset-knowledge-base] deleted ${docs.length} KB documents, embeddings wiped`);
  return { deletedDocs: docs.length };
}

async function main() {
  const { createStrapi } = await import('@strapi/strapi');
  const strapi = await createStrapi().load();
  try {
    const result = await resetKnowledgeBase(strapi);
    console.log('[reset-knowledge-base] Result:', result);
  } finally {
    await strapi.destroy();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd backend && npx vitest run scripts/__tests__/reset-knowledge-base.test.ts`
预期：2/2 PASS。

- [ ] **步骤 5：Commit**

```bash
git add backend/scripts/reset-knowledge-base.ts backend/scripts/__tests__/reset-knowledge-base.test.ts
git commit -m "feat(scripts): KB 清空脚本——母站 DB 克隆场景的注入隔离兜底"
```

---

### 任务 4：provision-new-customer.sh——一键开通编排

**文件：**
- 创建：`provision-new-customer.sh`（仓库根目录）

- [ ] **步骤 1：编写脚本**

创建 `provision-new-customer.sh`：

```bash
#!/usr/bin/env bash
#
# provision-new-customer.sh —— 母站克隆：新客户从零一键开通
#
# 用法:
#   ./provision-new-customer.sh --host 1.2.3.4 --user ubuntu --password 'xxx' \
#       --customer-name "客户名" --site-domain "www.example.com" [--with-uploads]
#
# 流程（全程幂等，失败可重跑）:
#   1. 本机预检（rsync/sshpass 可用、仓库干净）
#   2. 目标机预检（docker、磁盘>=10G、内存>=2G；缺 docker 则自动安装）
#   3. rsync 代码 → /opt/customer-site/（排除 .env/uploads/node_modules/.git）
#   4. 生成目标机 .env（openssl 随机密钥 + 客户参数）
#   5. 目标机执行 deploy.sh --no-pull -d（基础设施→backend→frontend，含健康检查；
#      backend bootstrap 自检自愈会自动建 pgvector 扩展/knowledge_embeddings/索引）
#   6. （可选 --with-uploads）rsync 母站 uploads + 容器内 restore-uploads.js
#   7. KB 初始化：容器内 resync-knowledge-base.ts（由本实例种子内容派生 KB + 向量化）
#   8. 输出验证清单（前端 200 / 后台 /admin / API /_health / KB 文档计数）
#
# KB 注入隔离（D7）：本脚本不传 DB、不传 KB——新实例 KB 由其自身种子内容派生。
# 若改用 DB dump 克隆，必须在启动前执行: docker compose exec -T backend \
#   npx tsx scripts/reset-knowledge-base.ts
#
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $*"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] !${NC} $*"; }
err()  { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $*" >&2; }

# ============== 参数 ==============
HOST=""; SSH_USER=""; SSH_PASS=""; CUSTOMER_NAME=""; SITE_DOMAIN=""
REMOTE_DIR="/opt/customer-site"
WITH_UPLOADS=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)          HOST="$2"; shift 2 ;;
    --user)          SSH_USER="$2"; shift 2 ;;
    --password)      SSH_PASS="$2"; shift 2 ;;
    --customer-name) CUSTOMER_NAME="$2"; shift 2 ;;
    --site-domain)   SITE_DOMAIN="$2"; shift 2 ;;
    --remote-dir)    REMOTE_DIR="$2"; shift 2 ;;
    --with-uploads)  WITH_UPLOADS=1; shift ;;
    -h|--help)       sed -n '2,30p' "$0"; exit 0 ;;
    *) err "未知参数: $1"; exit 1 ;;
  esac
done

for v in HOST SSH_USER SSH_PASS CUSTOMER_NAME SITE_DOMAIN; do
  if [ -z "${!v}" ]; then err "缺少必填参数（--host/--user/--password/--customer-name/--site-domain）"; exit 1; fi
done

SSH="sshpass -p '$SSH_PASS' ssh -o StrictHostKeyChecking=no $SSH_USER@$HOST"
SCP="sshpass -p '$SSH_PASS' scp -o StrictHostKeyChecking=no"
RSYNC_SSH="sshpass -p '$SSH_PASS' ssh -o StrictHostKeyChecking=no"

remote() { eval "$SSH \"$1\""; }
remote_root() { eval "$SSH \"echo '$SSH_PASS' | sudo -S $1\""; }

# ============== 1. 本机预检 ==============
log "[1/8] 本机预检..."
command -v rsync >/dev/null || { err "本机缺少 rsync"; exit 1; }
command -v sshpass >/dev/null || { err "本机缺少 sshpass（apt-get install sshpass）"; exit 1; }
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
[ -f deploy.sh ] && [ -f docker-compose.yml ] || { err "请在仓库根目录执行"; exit 1; }
ok "本机预检通过"

# ============== 2. 目标机预检 ==============
log "[2/8] 目标机预检（docker/磁盘/内存）..."
if ! remote "command -v docker >/dev/null 2>&1"; then
  warn "目标机无 docker，自动安装..."
  remote_root "apt-get update -qq && apt-get install -y -qq docker.io docker-compose-v2 rsync >/dev/null 2>&1 || (apt-get install -y -qq docker.io rsync && curl -fsSL https://get.docker.com | sh)"
  remote_root "systemctl enable --now docker"
  remote_root "usermod -aG docker $SSH_USER"
fi
DISK_GB=$(remote "df -BG /opt 2>/dev/null | awk 'NR==2{gsub(/G/,\"\",\$4);print \$4}'" | tr -d '[:space:]')
MEM_MB=$(remote "free -m | awk 'NR==2{print \$2}'" | tr -d '[:space:]')
[ "${DISK_GB:-0}" -ge 10 ] || { err "目标机 /opt 可用磁盘 ${DISK_GB}G < 10G"; exit 1; }
[ "${MEM_MB:-0}" -ge 1800 ] || warn "目标机内存 ${MEM_MB}MB 偏低（建议 >=2G）"
ok "目标机预检通过（磁盘 ${DISK_GB}G，内存 ${MEM_MB}MB）"

# ============== 3. rsync 代码 ==============
log "[3/8] 同步代码 → $REMOTE_DIR ..."
remote_root "mkdir -p $REMOTE_DIR && chown $SSH_USER:$SSH_USER $REMOTE_DIR"
rsync -az --delete \
  --exclude '.git' --exclude 'node_modules' --exclude '**/node_modules' \
  --exclude '.env' --exclude 'backend/.env' --exclude 'frontend-next/.env' --exclude 'agent/.env' \
  --exclude 'backend/public/uploads/' \
  --exclude 'backend/data.db' --exclude 'backend/.tmp/' --exclude 'backend/dist/' \
  --exclude 'frontend-next/.next/' \
  --exclude '.worktrees/' --exclude '佑森/' \
  -e "$RSYNC_SSH" \
  ./ "$SSH_USER@$HOST:$REMOTE_DIR/"
ok "代码同步完成"

# ============== 4. 生成 .env ==============
log "[4/8] 生成目标机 .env（随机密钥）..."
if remote "[ -f $REMOTE_DIR/.env ]"; then
  warn ".env 已存在，跳过生成（幂等）"
else
  gen() { openssl rand -base64 32 | tr -d '\n'; }
  APP_KEYS="$(gen),$(gen),$(gen),$(gen)"
  JWT_SECRET="$(gen)"; ADMIN_JWT_SECRET="$(gen)"; API_TOKEN_SALT="$(gen)"; TRANSFER_TOKEN_SALT="$(gen)"
  DB_PASS="$(gen)"; REDIS_PASS="$(gen)"; MEILI_KEY="$(gen)"
  cat > /tmp/provision-env-$$.env <<ENVEOF
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=customer_db
DATABASE_USERNAME=customer
DATABASE_PASSWORD=$DB_PASS
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=$REDIS_PASS
MEILI_HOST=http://meilisearch:7700
MEILI_MASTER_KEY=$MEILI_KEY
APP_KEYS=$APP_KEYS
JWT_SECRET=$JWT_SECRET
ADMIN_JWT_SECRET=$ADMIN_JWT_SECRET
API_TOKEN_SALT=$API_TOKEN_SALT
TRANSFER_TOKEN_SALT=$TRANSFER_TOKEN_SALT
ENCRYPTION_KEY=$(gen)
HOST=0.0.0.0
PORT=1337
NEXT_PUBLIC_STRAPI_API_URL=http://$SITE_DOMAIN
NEXT_PUBLIC_SITE_URL=http://$SITE_DOMAIN
ENVEOF
  $SCP /tmp/provision-env-$$.env "$SSH_USER@$HOST:$REMOTE_DIR/.env"
  rm -f /tmp/provision-env-$$.env
  remote "chmod 600 $REMOTE_DIR/.env"
fi
ok ".env 就绪"

# ============== 5. 部署 ==============
log "[5/8] 目标机部署（deploy.sh --no-pull -d，含健康检查，约 5-10 分钟）..."
remote "cd $REMOTE_DIR && chmod +x deploy.sh && echo '$SSH_PASS' | sudo -S ./deploy.sh --no-pull -d"
ok "部署完成，服务健康"

# ============== 6. uploads（可选）==============
if [ "$WITH_UPLOADS" -eq 1 ]; then
  log "[6/8] 同步 uploads 媒体库..."
  rsync -az -e "$RSYNC_SSH" backend/public/uploads/ "$SSH_USER@$HOST:$REMOTE_DIR/backend/public/uploads/"
  remote "cd $REMOTE_DIR && echo '$SSH_PASS' | sudo -S docker compose exec -T backend node scripts/restore-uploads.js" \
    || warn "restore-uploads.js 失败（可稍后手动重跑）"
  ok "uploads 已同步并登记"
else
  log "[6/8] 跳过 uploads（未指定 --with-uploads）"
fi

# ============== 7. KB 初始化 ==============
log "[7/8] KB 初始化（由本实例内容派生）..."
remote "cd $REMOTE_DIR && echo '$SSH_PASS' | sudo -S docker compose exec -T backend npx tsx scripts/resync-knowledge-base.ts" \
  || warn "KB 初始化失败（可稍后手动重跑；bootstrap 种子发布后生命周期也会自动派生）"
ok "KB 初始化完成"

# ============== 8. 验证清单 ==============
log "[8/8] 验证清单..."
FAIL=0
check() { # name, command
  if remote "$2" >/dev/null 2>&1; then ok "$1"; else err "$1 验证失败: $2"; FAIL=1; fi
}
check "前端首页 200"        "curl -sf -o /dev/null http://localhost:3000/"
check "后台 /admin 200"     "curl -sf -o /dev/null http://localhost:1337/admin"
check "API 健康"            "curl -sf http://localhost:1337/_health"
check "bootstrap 自检无 fail" "! echo '$SSH_PASS' | sudo -S docker compose -f $REMOTE_DIR/docker-compose.yml logs backend 2>/dev/null | grep -q 'Healthcheck.*✗'"
KB_COUNT=$(remote "echo '$SSH_PASS' | sudo -S docker compose -f $REMOTE_DIR/docker-compose.yml exec -T postgres psql -U customer -d customer_db -tAc \"SELECT count(*) FROM knowledge_bases\"" 2>/dev/null | tr -d '[:space:]')
log "KB 文档计数: ${KB_COUNT:-查询失败}（种子发布后应 >0）"

echo ""
if [ "$FAIL" -eq 0 ]; then
  ok "✅ 客户 [$CUSTOMER_NAME] 开通完成: http://$SITE_DOMAIN （后台 /admin，请先创建超管账号）"
else
  err "开通存在失败项，请按上方 ✗ 排查后重跑本脚本（幂等）"
  exit 1
fi
```

- [ ] **步骤 2：语法检查 + 自审**

运行：
```bash
bash -n provision-new-customer.sh && echo "syntax OK"
```
预期：`syntax OK`。
自审要点（执行者逐项核对）：① 所有 `remote`/`remote_root` 调用的引号嵌套在目标机展开正确；② `check "bootstrap 自检无 fail"` 的 grep 模式与 bootstrap-health.ts 的输出格式 `✗` 一致；③ `.env` 模板包含 deploy.sh 校验的全部 REQUIRED_VARS（DATABASE_PASSWORD/APP_KEYS/JWT_SECRET/NEXT_PUBLIC_STRAPI_API_URL/NEXT_PUBLIC_SITE_URL）+ docker-compose.yml 实际消费的变量——打开 `docker-compose.yml` 逐服务核对 environment 段，缺的补上。

- [ ] **步骤 3：Commit**

```bash
git add provision-new-customer.sh
git commit -m "feat(deploy): 新客户一键开通脚本（预检→rsync→env→部署→KB初始化→验证清单）"
```

---

### 任务 5：全量回归 + 交付

- [ ] **步骤 1：全量测试 + typecheck**

运行：`cd backend && npx vitest run && npm run typecheck`
预期：全部 PASS、typecheck 无错。

- [ ] **步骤 2：服务器验证（需用户确认后执行）**

向用户报告并待确认：
1. rsync 代码 → 重建 backend 镜像 → 重启
2. 看 `docker compose logs backend` 中 `[Healthcheck]` 四行全 ✓/!（无 ✗）
3. 数据库验证 `knowledge_bases_source_url_unique` 索引存在：`\d knowledge_bases`
4. AI 客服 `/api/chat/message` 不再 500（knowledge_embeddings 已由自检确保存在）

- [ ] **步骤 3：Commit（如有回归修复）**

```bash
git add -p
git commit -m "test(bootstrap): 全量回归修复"
```

---

## 自检记录

- **规格覆盖：** B1(bootstrap 自检自愈)=任务1/2；B2(一键开通)=任务4；KB 注入隔离(D7)=任务3+任务4 脚本头注释（三层防线：零种子/只传代码/reset 兜底）；B3(品牌差异走 central config)=Q2 计划范畴（deploy/provision 的 envVars 已由 customer_configs.env_overrides 供给，本计划 provision 脚本的 .env 生成即"差异集中化"的脚本侧体现）；B4(部署路线统一)=Q2 计划 ✅
- **类型一致性：** `ensureKbSchema(strapi)` 任务1 定义、任务2 使用签名一致；`runBootstrapHealthcheck` 返回 `{ ok, checks }`、`checks[].level ∈ ok|warn|fail` 在测试/实现/index.ts 三处一致 ✅
- **幂等性：** 所有 DDL `IF NOT EXISTS`；provision 脚本 `.env` 存在则跳过；rsync `--delete` 幂等 ✅
