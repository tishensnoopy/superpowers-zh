# Q1 知识库与后台内容精确对应 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让知识库（KB）成为后台已发布内容的精确镜像：后台增删改查/发布/取消发布，KB 文档与向量实时对应；清除服务器上的种子/孤儿/重复垃圾数据；AI 客服不再编造知识库没有的信息。

**架构：** 生命周期事件（afterCreate/afterUpdate/afterDelete）统一委托给 `reconcileContent`——它不相信事件载荷，而是以"该 documentId+locale 当前是否存在 published 版本"为唯一事实来源，决定 upsert 还是删除 KB 文档。全量同步 `syncWebsiteContent` 同样只拉 published，并回收孤儿 KB 文档。Strapi v5 `db.lifecycles` 无 afterPublish/afterUnpublish 事件（已核实 `@strapi/database/dist/lifecycles/types.d.ts` 的 Action 类型），发布/取消发布走 afterCreate/afterUpdate/afterDelete，事件无关设计正好覆盖。

**技术栈：** Strapi v5（Document Service API）、vitest、pgvector、BullMQ。

**规格来源：** `docs/superpowers/specs/2026-07-19-master-site-hardening-design.md` Q1 节（决策 D1=全量执行 A~F，D7=保留内容占位种子但 KB 零硬编码种子）。

---

## 关键事实（实施前必读，已核实）

- `backend/src/index.ts:10` 当前注册的是 `api::course.course`（不存在的内容类型），正确 UID 是 `api::product.product`——这就是课程从不进 KB 的根因。
- 5 个同步内容类型的 draftAndPublish：product ✅ / news-article ✅ / teacher ✅ / campus ✅ / faq-item ❌（faq 无草稿态，记录永远视为已发布，`status: 'published'` 查询对两类都安全）。
- `knowledge-base` content type：`draftAndPublish: false`，i18n localized，`sourceUrl` 字段（DB 列 `source_url`）当前**无唯一索引**。
- `strapi.documents(uid).findOne({ documentId, locale, status: 'published' })` 找不到时返回 `null`（不抛错）。
- `strapi.documents(uid).findOne/findMany` 默认**不** populate 组件字段；product.objectives 是可重复组件，必须显式 `populate: '*'`，否则序列化丢"教学目标"。
- KB 同步文档每个 locale 是独立 document（各有独立 documentId），`documents().delete({ documentId })` 只删自己。
- 测试命令：`cd backend && npx vitest run`；单文件：`npx vitest run src/services/__tests__/knowledge-sync-service.test.ts`。
- 既有测试 `backend/src/services/__tests__/knowledge-sync-service.test.ts` 的 `syncSingleContent with locale` / `deleteSyncedContent` 两个 describe 引用了旧行为，本计划任务 2 会整体替换它们。

## 文件结构

- 修改：`backend/src/services/knowledge-sync-service.ts` — 导出 `CONTENT_TYPES`/`SYNCED_UIDS`；新增 `reconcileContent`；`syncSingleContent`/`deleteSyncedContent` 改为它的薄封装；`syncWebsiteContent` 改 published-only + populate + 孤儿回收
- 修改：`backend/src/index.ts` — UID bug 修复；生命周期统一调 `reconcileContent`；订阅列表直接复用 `SYNCED_UIDS`（单一事实来源，防 UID 漂移）
- 修改：`backend/src/api/knowledge-base/services/knowledge-base.ts` — `initializeDefaults()` 移除 3 条英文硬编码种子
- 修改：`backend/src/services/rag-service.ts` — 强化 `SYSTEM_PROMPT_TEMPLATE` 防幻觉约束并导出供测试
- 修改：`backend/src/services/__tests__/knowledge-sync-service.test.ts` — 替换过时 describe，新增 reconcile/mirror 测试
- 创建：`backend/src/__tests__/register-lifecycles.test.ts` — index.ts 订阅行为测试
- 创建：`backend/src/services/__tests__/rag-prompt.test.ts` — 防幻觉 prompt 测试
- 创建：`backend/src/api/knowledge-base/__tests__/knowledge-base-defaults.test.ts` — 无种子测试
- 创建：`backend/scripts/rebuild-kb-from-published.ts` — 服务器清理重建脚本（删垃圾→建唯一索引→镜像同步→全量重向量化）
- 创建：`backend/scripts/__tests__/rebuild-kb-from-published.test.ts`

---

### 任务 1：修 UID bug + 生命周期订阅单一事实来源

**文件：**
- 修改：`backend/src/services/knowledge-sync-service.ts:16-22`（CONTENT_TYPES 加导出）
- 修改：`backend/src/index.ts:9-46`（register 重写）
- 测试：`backend/src/__tests__/register-lifecycles.test.ts`（新建）

- [ ] **步骤 1：编写失败的测试**

创建 `backend/src/__tests__/register-lifecycles.test.ts`：

```typescript
import { describe, it, expect, vi } from 'vitest';
import index from '../index';
import { SYNCED_UIDS } from '../services/knowledge-sync-service';

describe('register() 生命周期订阅', () => {
  it('订阅的 UID 与 knowledge-sync-service.SYNCED_UIDS 完全一致（防 UID 漂移）', async () => {
    const subscribe = vi.fn();
    const strapi: any = { db: { lifecycles: { subscribe } } };

    await index.register({ strapi });

    expect(subscribe).toHaveBeenCalledTimes(SYNCED_UIDS.length);
    const models = subscribe.mock.calls.map((c) => c[0].models[0]).sort();
    expect(models).toEqual([...SYNCED_UIDS].sort());
    // 回归：历史上的 bug——注册了不存在的 api::course.course
    expect(models).toContain('api::product.product');
    expect(models).not.toContain('api::course.course');
  });

  it('每个订阅都挂 afterCreate/afterUpdate/afterDelete 三个钩子', async () => {
    const subscribe = vi.fn();
    const strapi: any = { db: { lifecycles: { subscribe } } };

    await index.register({ strapi });

    for (const call of subscribe.mock.calls) {
      const subscriber = call[0];
      expect(typeof subscriber.afterCreate).toBe('function');
      expect(typeof subscriber.afterUpdate).toBe('function');
      expect(typeof subscriber.afterDelete).toBe('function');
    }
  });

  it('生命周期钩子以 published 状态为准 reconcile（draft 事件不产生 KB 文档）', async () => {
    let captured: any = null;
    const subscribe = vi.fn((s: any) => {
      if (s.models[0] === 'api::product.product') captured = s;
    });
    const findOnePublished = vi.fn().mockResolvedValue(null); // 无 published 版本（草稿）
    const findOneKb = vi.fn().mockResolvedValue(null); // KB 中也没有
    const createKb = vi.fn();
    const strapi: any = {
      db: {
        lifecycles: { subscribe },
        query: vi.fn(() => ({ findOne: findOneKb })),
      },
      documents: vi.fn((uid: string) => {
        if (uid === 'api::knowledge-base.knowledge-base') return { create: createKb };
        return { findOne: findOnePublished };
      }),
      service: vi.fn(() => ({ deleteVectors: vi.fn() })),
    };

    await index.register({ strapi });
    expect(captured).not.toBeNull();

    // 模拟后台"保存草稿"触发 afterCreate
    await captured.afterCreate({ result: { documentId: 'p1', locale: 'zh-CN', name: '草稿课程' } });

    expect(findOnePublished).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: 'p1', status: 'published' })
    );
    expect(createKb).not.toHaveBeenCalled();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd backend && npx vitest run src/__tests__/register-lifecycles.test.ts`
预期：FAIL——`SYNCED_UIDS` 未导出（import 报错），且当前订阅含 `api::course.course`。

- [ ] **步骤 3：实现——导出 SYNCED_UIDS 并重写 register**

`backend/src/services/knowledge-sync-service.ts` 第 16 行 `const CONTENT_TYPES = [` 改为：

```typescript
export const CONTENT_TYPES = [
```

并在其后追加：

```typescript
/** 生命周期订阅列表的单一事实来源——index.ts register 必须使用它，禁止另写 UID 列表 */
export const SYNCED_UIDS = CONTENT_TYPES.map((c) => c.uid);
```

`backend/src/index.ts` 的 `register` 整个替换为：

```typescript
  async register({ strapi }: { strapi: Core.Strapi }) {
    console.log('[Register] Registering lifecycle hooks...');

    const { reconcileContent, SYNCED_UIDS } = await import('./services/knowledge-sync-service');

    for (const uid of SYNCED_UIDS) {
      try {
        // afterCreate/afterUpdate/afterDelete 统一走 reconcile：
        // Strapi v5 无 afterPublish/afterUnpublish 事件，发布/取消发布/删除都经这三个钩子，
        // reconcileContent 以"当前是否存在 published 版本"为唯一事实来源，事件载荷不可信。
        const handler = async (event: any) => {
          const record = event?.result;
          if (!record?.documentId) return;
          await reconcileContent(strapi, uid, {
            documentId: record.documentId,
            locale: record.locale,
          });
          console.log(`[Lifecycle] Reconciled ${uid} (${record.documentId}, ${record.locale ?? 'zh-CN'})`);
        };
        strapi.db.lifecycles.subscribe({
          models: [uid],
          afterCreate: handler,
          afterUpdate: handler,
          afterDelete: handler,
        });
      } catch (err) {
        console.warn(`[Register] Failed to subscribe lifecycle for ${uid}:`, err);
      }
    }

    console.log('[Register] Lifecycle hooks registered');
  },
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd backend && npx vitest run src/__tests__/register-lifecycles.test.ts`
预期：3 个测试 PASS。注意第 3 个测试此时会 FAIL（`reconcileContent` 尚未实现，`syncSingleContent` 旧实现会直接 create）——属预期，任务 2 完成后转绿。本任务只要求前 2 个测试 PASS。

- [ ] **步骤 5：Commit**

```bash
git add backend/src/__tests__/register-lifecycles.test.ts backend/src/services/knowledge-sync-service.ts backend/src/index.ts
git commit -m "fix(kb-sync): 修正生命周期订阅 UID（course→product）并统一订阅列表单一事实来源"
```

---

### 任务 2：reconcileContent——以 published 状态为唯一事实来源

**文件：**
- 修改：`backend/src/services/knowledge-sync-service.ts`（新增 `reconcileContent`，`syncSingleContent`/`deleteSyncedContent` 改薄封装）
- 测试：`backend/src/services/__tests__/knowledge-sync-service.test.ts`（替换 `syncSingleContent with locale`、`deleteSyncedContent` 两个 describe）

- [ ] **步骤 1：替换过时测试为新行为测试**

打开 `backend/src/services/__tests__/knowledge-sync-service.test.ts`，**删除**第 180 行到文件末尾的 `describe('syncSingleContent with locale', ...)` 整块（含其中全部 it），替换为：

```typescript
describe('reconcileContent（published 为唯一事实来源）', () => {
  function makeStrapi(opts: { published?: any; existingKb?: any }) {
    const findOnePublished = vi.fn().mockResolvedValue(opts.published ?? null);
    const findOneKb = vi.fn().mockResolvedValue(opts.existingKb ?? null);
    const createKb = vi.fn().mockResolvedValue({ id: 10 });
    const updateKb = vi.fn().mockResolvedValue({});
    const deleteKb = vi.fn().mockResolvedValue({});
    const deleteVectors = vi.fn().mockResolvedValue(true);
    const strapi: any = {
      documents: vi.fn((uid: string) => {
        if (uid === 'api::knowledge-base.knowledge-base') {
          return { create: createKb, update: updateKb, delete: deleteKb };
        }
        return { findOne: findOnePublished };
      }),
      db: { query: vi.fn(() => ({ findOne: findOneKb })) },
      service: vi.fn(() => ({ deleteVectors })),
    };
    return { strapi, findOnePublished, findOneKb, createKb, updateKb, deleteKb, deleteVectors };
  }

  it('已发布内容 → 创建 KB 文档（sourceUrl 含 locale）', async () => {
    const { strapi, createKb } = makeStrapi({
      published: { documentId: 'p1', name: '幼小衔接全能班', price: 3800, locale: 'zh-CN' },
    });
    await reconcileContent(strapi, 'api::product.product', { documentId: 'p1', locale: 'zh-CN' });
    expect(createKb).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: '幼小衔接全能班',
          sourceType: 'content-sync',
          sourceUrl: 'strapi://api::product.product/p1?locale=zh-CN',
          locale: 'zh-CN',
          status: 'pending',
        }),
      })
    );
  });

  it('已发布内容 + 已有 KB → 更新并置回 pending（触发重向量化）', async () => {
    const { strapi, updateKb, createKb } = makeStrapi({
      published: { documentId: 'p1', name: '改名后的课程', locale: 'zh-CN' },
      existingKb: { id: 5, documentId: 'kb1' },
    });
    await reconcileContent(strapi, 'api::product.product', { documentId: 'p1', locale: 'zh-CN' });
    expect(updateKb).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'kb1',
        data: expect.objectContaining({ title: '改名后的课程', status: 'pending' }),
      })
    );
    expect(createKb).not.toHaveBeenCalled();
  });

  it('草稿保存（无 published 版本）且 KB 无记录 → 不创建任何文档', async () => {
    const { strapi, createKb, deleteKb } = makeStrapi({ published: null });
    await reconcileContent(strapi, 'api::product.product', { documentId: 'p1', locale: 'zh-CN' });
    expect(createKb).not.toHaveBeenCalled();
    expect(deleteKb).not.toHaveBeenCalled();
  });

  it('取消发布/删除（无 published 版本）且 KB 有记录 → 删 KB 文档并清向量', async () => {
    const { strapi, deleteKb, deleteVectors } = makeStrapi({
      published: null,
      existingKb: { id: 5, documentId: 'kb1' },
    });
    await reconcileContent(strapi, 'api::product.product', { documentId: 'p1', locale: 'zh-CN' });
    expect(deleteVectors).toHaveBeenCalledWith(5);
    expect(deleteKb).toHaveBeenCalledWith({ documentId: 'kb1' });
  });

  it('查询 published 版本带 status+populate（objectives 等组件字段不丢失）', async () => {
    const { strapi, findOnePublished } = makeStrapi({
      published: { documentId: 'p1', name: 'x', locale: 'zh-CN' },
    });
    await reconcileContent(strapi, 'api::product.product', { documentId: 'p1', locale: 'zh-CN' });
    expect(findOnePublished).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'p1',
        locale: 'zh-CN',
        status: 'published',
        populate: '*',
      })
    );
  });

  it('en-US locale → sourceUrl 带 locale=en-US', async () => {
    const { strapi, createKb } = makeStrapi({
      published: { documentId: 'p1', name: 'English Course', locale: 'en-US' },
    });
    await reconcileContent(strapi, 'api::product.product', { documentId: 'p1', locale: 'en-US' });
    expect(createKb).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceUrl: 'strapi://api::product.product/p1?locale=en-US',
          locale: 'en-US',
        }),
      })
    );
  });

  it('未知 UID → 静默返回不报错', async () => {
    const { strapi, createKb } = makeStrapi({ published: { documentId: 'x' } });
    await expect(
      reconcileContent(strapi, 'api::unknown.unknown', { documentId: 'x', locale: 'zh-CN' })
    ).resolves.toBeUndefined();
    expect(createKb).not.toHaveBeenCalled();
  });

  it('序列化用 published 版本数据，不用事件载荷（syncSingleContent 薄封装验证）', async () => {
    const { strapi, createKb } = makeStrapi({
      published: { documentId: 'p1', name: '正式名称', locale: 'zh-CN' },
    });
    await syncSingleContent(strapi, 'api::product.product', {
      documentId: 'p1',
      name: 'DRAFT草稿名',
      locale: 'zh-CN',
    });
    expect(createKb).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: '正式名称' }) })
    );
  });

  it('deleteSyncedContent 同样走 reconcile（条目删除 → KB 删除）', async () => {
    const { strapi, deleteKb, deleteVectors } = makeStrapi({
      published: null,
      existingKb: { id: 7, documentId: 'kb9' },
    });
    await deleteSyncedContent(strapi, 'api::product.product', { documentId: 'p1', locale: 'en-US' });
    expect(deleteVectors).toHaveBeenCalledWith(7);
    expect(deleteKb).toHaveBeenCalledWith({ documentId: 'kb9' });
  });
});
```

并把文件顶部 import 行改为：

```typescript
import { serializeProduct, serializeNews, serializeTeacher, serializeCampus, serializeFaq, syncWebsiteContent, syncSingleContent, deleteSyncedContent, reconcileContent } from '../knowledge-sync-service';
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd backend && npx vitest run src/services/__tests__/knowledge-sync-service.test.ts`
预期：FAIL——`reconcileContent` 未导出。

- [ ] **步骤 3：实现 reconcileContent + 薄封装**

在 `backend/src/services/knowledge-sync-service.ts` 中，**替换**现有的 `syncSingleContent` 和 `deleteSyncedContent` 两个函数（第 176-221 行）为：

```typescript
/**
 * 以"该 documentId+locale 当前是否存在 published 版本"为唯一事实来源，对单条内容做 KB 对账。
 * - 有 published 版本 → upsert KB 文档（置回 pending 触发重向量化）
 * - 无 published 版本（草稿/取消发布/已删除）→ 删除 KB 文档并清向量
 * 生命周期三个钩子（afterCreate/afterUpdate/afterDelete）都调它，事件载荷不可信。
 */
export async function reconcileContent(strapi: any, uid: string, ref: { documentId?: string; locale?: string }): Promise<void> {
  const config = CONTENT_TYPES.find((c) => c.uid === uid);
  if (!config || !ref?.documentId) return;

  const locale = normalizeLocale(ref.locale);
  const sourceUrl = buildSourceUrl(uid, { documentId: ref.documentId, locale });

  const published = await strapi.documents(uid).findOne({
    documentId: ref.documentId,
    locale,
    status: 'published',
    populate: '*',
  });

  const existing = await strapi.db.query('api::knowledge-base.knowledge-base').findOne({
    where: { sourceUrl },
  });

  if (!published) {
    if (existing) {
      const kbService = strapi.service('api::knowledge-base.knowledge-base');
      await kbService.deleteVectors(existing.id);
      await strapi.documents('api::knowledge-base.knowledge-base').delete({
        documentId: existing.documentId,
      });
    }
    return;
  }

  const content = config.serialize(published);
  const title = published.title || published.name || `${config.name}文档`;

  if (existing) {
    await strapi.documents('api::knowledge-base.knowledge-base').update({
      documentId: existing.documentId,
      data: { title, content, locale, status: 'pending' },
    });
  } else {
    await strapi.documents('api::knowledge-base.knowledge-base').create({
      data: {
        title,
        content,
        sourceType: 'content-sync',
        sourceUrl,
        locale,
        status: 'pending',
        priority: 'high',
        tags: config.name,
      },
    });
  }
}

/** 生命周期 create/update 入口：薄封装 reconcileContent（忽略事件载荷内容，只取 documentId+locale） */
export async function syncSingleContent(strapi: any, uid: string, record: any): Promise<void> {
  return reconcileContent(strapi, uid, { documentId: record?.documentId, locale: record?.locale });
}

/** 生命周期 delete 入口：薄封装 reconcileContent（无 published 版本即删除） */
export async function deleteSyncedContent(strapi: any, uid: string, record: any): Promise<void> {
  return reconcileContent(strapi, uid, { documentId: record?.documentId, locale: record?.locale });
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd backend && npx vitest run src/services/__tests__/knowledge-sync-service.test.ts`
预期：全部 PASS（含任务 1 第 3 个遗留测试转绿——再跑一次 `npx vitest run src/__tests__/register-lifecycles.test.ts` 确认 3/3 PASS）。

- [ ] **步骤 5：Commit**

```bash
git add backend/src/services/knowledge-sync-service.ts backend/src/services/__tests__/knowledge-sync-service.test.ts
git commit -m "feat(kb-sync): reconcileContent 以 published 为唯一事实来源，草稿/取消发布自动移出 KB"
```

---

### 任务 3：syncWebsiteContent 全量镜像同步（published-only + 孤儿回收）

**文件：**
- 修改：`backend/src/services/knowledge-sync-service.ts:122-174`（syncWebsiteContent 重写）
- 测试：`backend/src/services/__tests__/knowledge-sync-service.test.ts`（`syncWebsiteContent` describe 扩充）

- [ ] **步骤 1：编写失败的测试**

在 `describe('syncWebsiteContent', ...)` 块内（保留既有"应同步课程到知识库"测试，但先按步骤 3 的说明修它的 mock）追加：

```typescript
  it('findMany 带 status:published + populate:*（草稿不进 KB，组件字段不丢）', async () => {
    const findManyProduct = vi.fn().mockResolvedValue([]);
    const strapi: any = {
      documents: vi.fn((uid: string) => {
        if (uid === 'api::product.product') return { findMany: findManyProduct };
        if (uid === 'api::knowledge-base.knowledge-base') return { create: vi.fn(), update: vi.fn(), delete: vi.fn() };
        return { findMany: vi.fn().mockResolvedValue([]) };
      }),
      db: {
        query: vi.fn(() => ({
          findOne: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        })),
      },
      service: vi.fn(() => ({ deleteVectors: vi.fn() })),
    };

    await syncWebsiteContent(strapi);

    expect(findManyProduct).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'published', populate: '*', locale: 'zh-CN' })
    );
    expect(findManyProduct).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'published', populate: '*', locale: 'en-US' })
    );
  });

  it('孤儿回收：KB content-sync 文档不在 published 集合内 → 删文档+清向量', async () => {
    // 后台只剩 1 门已发布课程；KB 里却有 2 条 content-sync（其中 orphan1 是孤儿）
    const strapi: any = {
      documents: vi.fn((uid: string) => {
        if (uid === 'api::product.product') {
          return { findMany: vi.fn().mockResolvedValue([{ documentId: 'alive1', name: '在售课程' }]) };
        }
        if (uid === 'api::knowledge-base.knowledge-base') {
          return { create: vi.fn().mockResolvedValue({ id: 100 }), update: vi.fn(), delete: deleteKb };
        }
        return { findMany: vi.fn().mockResolvedValue([]) };
      }),
      db: {
        query: vi.fn(() => ({
          findOne: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([
            { id: 1, documentId: 'kb-orphan', sourceType: 'content-sync', sourceUrl: 'strapi://api::campus.campus/gone1?locale=zh-CN' },
            { id: 2, documentId: 'kb-manual', sourceType: 'manual', sourceUrl: null }, // 手工文档绝不回收
          ]),
        })),
      },
      service: vi.fn(() => ({ deleteVectors })),
    };
    const deleteKb = vi.fn();
    const deleteVectors = vi.fn();

    const result = await syncWebsiteContent(strapi);

    expect(deleteVectors).toHaveBeenCalledWith(1);
    expect(deleteKb).toHaveBeenCalledTimes(1);
    expect(deleteKb).toHaveBeenCalledWith({ documentId: 'kb-orphan' });
    expect(result.removed).toBe(1);
  });
```

注意：上面第二个测试里 `deleteKb`/`deleteVectors` 在使用后声明——vitest 会因暂时性死区报错，所以**实际写文件时**把这两行 `const deleteKb = vi.fn(); const deleteVectors = vi.fn();` 移到 `const strapi` 之前。以能跑通为准。

- [ ] **步骤 2：运行测试验证失败**

运行：`cd backend && npx vitest run src/services/__tests__/knowledge-sync-service.test.ts -t "syncWebsiteContent"`
预期：FAIL——当前实现无 `status`/`populate` 参数、无 `removed` 返回、无孤儿回收。

- [ ] **步骤 3：实现镜像同步**

`syncWebsiteContent` 整个替换为：

```typescript
/**
 * 全量镜像同步：KB 的 content-sync 文档 = 后台 published 内容的精确镜像。
 * 1) 只拉 published（草稿不进 KB），populate:* 保证组件字段（如 objectives）完整
 * 2) upsert 全部 published 记录
 * 3) 孤儿回收：KB 中 sourceType='content-sync' 但不在 published 集合内的文档 → 删文档+清向量
 *    （只碰 content-sync，manual/faq/pdf 等手工文档绝不回收）
 */
export async function syncWebsiteContent(strapi: any): Promise<{ synced: number; updated: number; removed: number; errors: string[] }> {
  let synced = 0;
  let updated = 0;
  let removed = 0;
  const errors: string[] = [];
  const LOCALES: Locale[] = ['zh-CN', 'en-US'];
  const validSourceUrls = new Set<string>();

  for (const { uid, serialize, name } of CONTENT_TYPES) {
    for (const locale of LOCALES) {
      try {
        const records = await strapi.documents(uid).findMany({
          limit: 1000,
          locale,
          status: 'published',
          populate: '*',
        });
        for (const record of records) {
          const recordWithLocale = { ...record, locale };
          const sourceUrl = buildSourceUrl(uid, recordWithLocale);
          validSourceUrls.add(sourceUrl);
          const content = serialize(record);
          const title = record.title || record.name || `${name}文档`;

          const existing = await strapi.db.query('api::knowledge-base.knowledge-base').findOne({
            where: { sourceUrl },
          });

          if (existing) {
            await strapi.documents('api::knowledge-base.knowledge-base').update({
              documentId: existing.documentId,
              data: { title, content, locale, status: 'pending' },
            });
            updated++;
          } else {
            await strapi.documents('api::knowledge-base.knowledge-base').create({
              data: {
                title,
                content,
                sourceType: 'content-sync',
                sourceUrl,
                locale,
                status: 'pending',
                priority: 'high',
                tags: name,
              },
            });
            synced++;
          }
        }
      } catch (err) {
        errors.push(`${name}[${locale}]: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  // 孤儿回收
  const syncedDocs = await strapi.db.query('api::knowledge-base.knowledge-base').findMany({
    where: { sourceType: 'content-sync' },
    limit: 10000,
  });
  for (const doc of syncedDocs) {
    if (doc.sourceUrl && !validSourceUrls.has(doc.sourceUrl)) {
      try {
        const kbService = strapi.service('api::knowledge-base.knowledge-base');
        await kbService.deleteVectors(doc.id);
        await strapi.documents('api::knowledge-base.knowledge-base').delete({
          documentId: doc.documentId,
        });
        removed++;
      } catch (err) {
        errors.push(`orphan-remove[${doc.sourceUrl}]: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  console.log(`[knowledge-sync-service] Mirror sync complete: ${synced} new, ${updated} updated, ${removed} removed, ${errors.length} errors`);
  return { synced, updated, removed, errors };
}
```

同时修复既有测试"应同步课程到知识库"的 mock：`mockStrapi.db.query.mockReturnValue` 改为返回 `{ findOne: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) }`（孤儿回收扫描返回空），并给 `mockStrapi` 补 `service: vi.fn(() => ({ deleteVectors: vi.fn() }))`。

- [ ] **步骤 4：运行测试验证通过**

运行：`cd backend && npx vitest run src/services/__tests__/knowledge-sync-service.test.ts`
预期：全部 PASS。

- [ ] **步骤 5：Commit**

```bash
git add backend/src/services/knowledge-sync-service.ts backend/src/services/__tests__/knowledge-sync-service.test.ts
git commit -m "feat(kb-sync): 全量同步改镜像模式（published-only + populate + 孤儿回收）"
```

---

### 任务 4：移除 KB 硬编码英文种子

**文件：**
- 修改：`backend/src/api/knowledge-base/services/knowledge-base.ts:71-116`（initializeDefaults）
- 测试：`backend/src/api/knowledge-base/__tests__/knowledge-base-defaults.test.ts`（新建）

- [ ] **步骤 1：编写失败的测试**

创建 `backend/src/api/knowledge-base/__tests__/knowledge-base-defaults.test.ts`：

```typescript
import { describe, it, expect, vi } from 'vitest';
import serviceFactory from '../services/knowledge-base';

describe('knowledge-base.initializeDefaults（母站隔离：零硬编码种子）', () => {
  it('KB 为空也不创建任何种子文档，返回空数组', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const strapi: any = {
      db: { query: vi.fn(() => ({ findMany })) },
    };
    const service: any = (serviceFactory as any)({ strapi });

    const result = await service.initializeDefaults();

    expect(result).toEqual([]);
    // 不得向 DB 写任何内容
    expect(findMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd backend && npx vitest run src/api/knowledge-base/__tests__/knowledge-base-defaults.test.ts`
预期：FAIL——当前实现会查 DB 并创建 3 条英文模板，`result` 不是 `[]`。

- [ ] **步骤 3：实现空种子**

`knowledge-base.ts` 的 `initializeDefaults()` 整个替换为：

```typescript
  /**
   * 母站隔离（决策 D7）：KB 不预置任何硬编码种子。
   * KB 内容 100% 由本实例自身内容经 knowledge-sync-service 派生，
   * 克隆母站时 KB 不会携带母站内容。
   */
  async initializeDefaults() {
    return [];
  },
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd backend && npx vitest run src/api/knowledge-base/__tests__/knowledge-base-defaults.test.ts`
预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add backend/src/api/knowledge-base/services/knowledge-base.ts backend/src/api/knowledge-base/__tests__/knowledge-base-defaults.test.ts
git commit -m "feat(kb): 移除硬编码英文种子，KB 内容 100% 由本实例派生（母站隔离）"
```

---

### 任务 5：防幻觉 system prompt 强约束

**文件：**
- 修改：`backend/src/services/rag-service.ts:46-58`（SYSTEM_PROMPT_TEMPLATE）
- 测试：`backend/src/services/__tests__/rag-prompt.test.ts`（新建）

- [ ] **步骤 1：编写失败的测试**

创建 `backend/src/services/__tests__/rag-prompt.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { SYSTEM_PROMPT_TEMPLATE } from '../rag-service';

describe('SYSTEM_PROMPT_TEMPLATE 防幻觉约束', () => {
  it('包含"暂无该信息"兜底话术要求', () => {
    expect(SYSTEM_PROMPT_TEMPLATE).toContain('暂无该信息');
  });

  it('明确禁止编造校区/课程/价格/政策', () => {
    expect(SYSTEM_PROMPT_TEMPLATE).toContain('不得编造');
    expect(SYSTEM_PROMPT_TEMPLATE).toMatch(/校区/);
    expect(SYSTEM_PROMPT_TEMPLATE).toMatch(/价格/);
    expect(SYSTEM_PROMPT_TEMPLATE).toMatch(/政策/);
  });

  it('检索不到答案时引导转人工或留资', () => {
    expect(SYSTEM_PROMPT_TEMPLATE).toContain('转人工');
    expect(SYSTEM_PROMPT_TEMPLATE).toMatch(/留(下|资)|姓名电话/);
  });

  it('保留 {retrieved_docs} 占位符（buildSystemPrompt 依赖）', () => {
    expect(SYSTEM_PROMPT_TEMPLATE).toContain('{retrieved_docs}');
  });

  it('费用/名额等变动信息建议致电确认', () => {
    expect(SYSTEM_PROMPT_TEMPLATE).toContain('致电确认');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd backend && npx vitest run src/services/__tests__/rag-prompt.test.ts`
预期：FAIL——`SYSTEM_PROMPT_TEMPLATE` 未导出，且当前 prompt 无"暂无该信息/不得编造"字样。

- [ ] **步骤 3：实现新 prompt**

`rag-service.ts` 第 46-58 行的 `SYSTEM_PROMPT_TEMPLATE` 替换为（注意加 `export`）：

```typescript
export const SYSTEM_PROMPT_TEMPLATE = `你是佑森小课堂的AI客服助手。佑森小课堂是武汉的幼小衔接教育机构。
你的职责是回答家长关于课程、校区、预约、费用等问题。

【最高优先级规则——禁止编造】
1. 你只能使用下方"知识库内容"中的信息作答。
2. 知识库中没有的信息，一律回答"暂无该信息"，不得编造任何校区、课程、价格、政策、师资细节。
3. 检索结果与问题无关时，不得强行作答；如实说明并引导家长：转人工客服，或留下姓名电话预约回电。
4. 涉及费用、名额、开班时间等可能变动的信息，即使知识库中有，也建议家长致电确认。

知识库内容:
{retrieved_docs}

回答要求:
1. 语气亲切、专业
2. 回答简洁明了
3. 如实反映课程信息，不夸大`;
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd backend && npx vitest run src/services/__tests__/rag-prompt.test.ts`
预期：5/5 PASS。再跑 `npx vitest run src/services/__tests__/` 确认 rag-service 其他既有测试（若有）不回归。

- [ ] **步骤 5：Commit**

```bash
git add backend/src/services/rag-service.ts backend/src/services/__tests__/rag-prompt.test.ts
git commit -m "feat(rag): 防幻觉强约束 prompt——无答案必须明说暂无该信息并引导转人工/留资"
```

---

### 任务 6：服务器清理重建脚本 rebuild-kb-from-published.ts

**文件：**
- 创建：`backend/scripts/rebuild-kb-from-published.ts`
- 测试：`backend/scripts/__tests__/rebuild-kb-from-published.test.ts`

依赖模式参考既有 `backend/scripts/resync-knowledge-base.ts`（函数体依赖注入 + `main()` CLI 入口）。

- [ ] **步骤 1：编写失败的测试**

创建 `backend/scripts/__tests__/rebuild-kb-from-published.test.ts`：

```typescript
import { describe, it, expect, vi } from 'vitest';
import { rebuildKbFromPublished } from '../rebuild-kb-from-published';

describe('rebuild-kb-from-published 服务器清理重建', () => {
  function makeStrapi() {
    const raw = vi.fn().mockResolvedValue({});
    const deleteKb = vi.fn().mockResolvedValue({});
    const findManyKb = vi.fn()
      // 第 1 次调用：content-sync 全量（待删）
      .mockResolvedValueOnce([{ id: 1, documentId: 'kb-sync-1' }, { id: 2, documentId: 'kb-sync-2' }])
      // 第 2 次调用：英文模板种子（待删）
      .mockResolvedValueOnce([{ id: 9, documentId: 'kb-seed-1' }])
      // 第 3 次调用：重建后全部 pending（待向量化）
      .mockResolvedValueOnce([{ id: 101 }, { id: 102 }, { id: 103 }]);
    const strapi: any = {
      db: {
        connection: { raw },
        query: vi.fn(() => ({ findMany: findManyKb })),
      },
      documents: vi.fn(() => ({ delete: deleteKb })),
    };
    return { strapi, raw, deleteKb, findManyKb };
  }

  it('执行顺序：删 content-sync+种子 → 建唯一索引 → 镜像同步 → 清空 embeddings → 全量重向量化', async () => {
    const { strapi, raw, deleteKb } = makeStrapi();
    const syncWebsiteContent = vi.fn().mockResolvedValue({ synced: 60, updated: 0, removed: 0, errors: [] });
    const queueAdd = vi.fn().mockResolvedValue({ id: 'job-1' });

    const result = await rebuildKbFromPublished(strapi, {
      syncWebsiteContent,
      queueAdd,
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    // 删了 2 条 content-sync + 1 条种子
    expect(deleteKb).toHaveBeenCalledTimes(3);
    // 建了唯一索引（部分索引，允许 NULL）
    const indexSql = raw.mock.calls.map((c) => String(c[0])).find((s) => s.includes('UNIQUE INDEX'));
    expect(indexSql).toBeTruthy();
    expect(indexSql).toContain('source_url');
    expect(indexSql).toContain('IF NOT EXISTS');
    // 镜像同步被调用
    expect(syncWebsiteContent).toHaveBeenCalledWith(strapi);
    // 清空了 embeddings
    const deleteEmb = raw.mock.calls.map((c) => String(c[0])).find((s) => /DELETE FROM knowledge_embeddings/i.test(s));
    expect(deleteEmb).toBeTruthy();
    // 3 条 pending 全部入队
    expect(queueAdd).toHaveBeenCalledTimes(3);
    expect(queueAdd).toHaveBeenCalledWith('document-processing', { knowledgeBaseId: 101, type: 'revectorize' });
    expect(result).toEqual({ deleted: 3, synced: 60, updated: 0, removed: 0, errors: [], queued: 3 });
  });

  it('同步报错不阻断向量化入队', async () => {
    const { strapi } = makeStrapi();
    const syncWebsiteContent = vi.fn().mockResolvedValue({ synced: 0, updated: 0, removed: 0, errors: ['课程[zh-CN]: boom'] });
    const queueAdd = vi.fn().mockResolvedValue({ id: 'job-1' });

    const result = await rebuildKbFromPublished(strapi, {
      syncWebsiteContent,
      queueAdd,
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    expect(result.errors).toEqual(['课程[zh-CN]: boom']);
    expect(queueAdd).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd backend && npx vitest run scripts/__tests__/rebuild-kb-from-published.test.ts`
预期：FAIL——模块不存在。

- [ ] **步骤 3：实现脚本**

创建 `backend/scripts/rebuild-kb-from-published.ts`：

```typescript
/**
 * 服务器 KB 清理重建（一次性修复脚本，幂等）。
 *
 * 背景：KB 中混入 ① 硬编码英文模板种子 ② 无来源孤儿文档 ③ 异常重试产生的重复文档，
 * 且历史同步未过滤草稿。本脚本把 KB 恢复为"后台 published 内容的精确镜像"：
 *   1. 删除全部 content-sync 文档（稍后由镜像同步重建）
 *   2. 删除硬编码英文模板种子（3 个固定标题）
 *   3. 给 knowledge_bases.source_url 建唯一部分索引（防重复，NULL 放行手工文档）
 *   4. 跑 syncWebsiteContent 镜像同步（published-only）
 *   5. 清空 knowledge_embeddings（向量全量重建，避免新旧混杂）
 *   6. 全部 pending 文档入队重向量化（100ms 限速）
 *
 * 用法（backend 容器内）：npx tsx scripts/rebuild-kb-from-published.ts
 * 依赖注入设计（同 resync-knowledge-base.ts），函数体可单测。
 */

interface RebuildOptions {
  syncWebsiteContent: (strapi: any) => Promise<{ synced: number; updated: number; removed: number; errors: string[] }>;
  queueAdd: (queueName: string, data: any) => Promise<{ id: string }>;
  sleep?: (ms: number) => Promise<void>;
}

const SEED_TITLES = ['Introduction to Our Company', 'Product FAQ', 'Technical Documentation'];

export async function rebuildKbFromPublished(
  strapi: any,
  options: RebuildOptions
): Promise<{ deleted: number; synced: number; updated: number; removed: number; errors: string[]; queued: number }> {
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const db = strapi.db.connection;

  // 步骤 1：删除全部 content-sync 文档（镜像同步会重建它们）
  console.log('[rebuild-kb] Step 1: deleting all content-sync documents...');
  const syncDocs = await strapi.db
    .query('api::knowledge-base.knowledge-base')
    .findMany({ where: { sourceType: 'content-sync' }, limit: 10000 });
  for (const doc of syncDocs) {
    await strapi.documents('api::knowledge-base.knowledge-base').delete({ documentId: doc.documentId });
  }
  console.log(`[rebuild-kb] Deleted ${syncDocs.length} content-sync documents`);

  // 步骤 2：删除硬编码英文模板种子
  console.log('[rebuild-kb] Step 2: deleting hardcoded seed documents...');
  const seedDocs = await strapi.db
    .query('api::knowledge-base.knowledge-base')
    .findMany({ where: { title: { $in: SEED_TITLES } }, limit: 100 });
  for (const doc of seedDocs) {
    await strapi.documents('api::knowledge-base.knowledge-base').delete({ documentId: doc.documentId });
  }
  console.log(`[rebuild-kb] Deleted ${seedDocs.length} seed documents`);

  // 步骤 3：source_url 唯一部分索引（NULL 放行：manual/pdf 等手工文档无 sourceUrl）
  console.log('[rebuild-kb] Step 3: creating unique index on source_url...');
  await db.raw(
    'CREATE UNIQUE INDEX IF NOT EXISTS knowledge_bases_source_url_unique ON knowledge_bases (source_url) WHERE source_url IS NOT NULL'
  );

  // 步骤 4：镜像同步（published-only，含孤儿回收）
  console.log('[rebuild-kb] Step 4: mirror syncing website content...');
  const { synced, updated, removed, errors } = await options.syncWebsiteContent(strapi);
  console.log(`[rebuild-kb] Sync: ${synced} new, ${updated} updated, ${removed} removed, ${errors.length} errors`);
  if (errors.length > 0) console.error('[rebuild-kb] Sync errors:', errors);

  // 步骤 5：清空 embeddings（向量全量重建）
  console.log('[rebuild-kb] Step 5: wiping knowledge_embeddings...');
  await db.raw('DELETE FROM knowledge_embeddings');

  // 步骤 6：全部 pending 文档入队重向量化（限速 100ms）
  console.log('[rebuild-kb] Step 6: queueing pending documents for vectorization...');
  const pending = await strapi.db
    .query('api::knowledge-base.knowledge-base')
    .findMany({ where: { status: 'pending' }, limit: 10000 });
  let queued = 0;
  for (const record of pending) {
    await options.queueAdd('document-processing', { knowledgeBaseId: record.id, type: 'revectorize' });
    queued++;
    await sleep(100);
  }
  console.log(`[rebuild-kb] Done: queued ${queued} documents`);

  return { deleted: syncDocs.length + seedDocs.length, synced, updated, removed, errors, queued };
}

// CLI 入口
async function main() {
  const { createStrapi } = await import('@strapi/strapi');
  const strapi = await createStrapi().load();

  const { syncWebsiteContent } = await import('../src/services/knowledge-sync-service');
  const { documentQueue } = await import('../src/queues/document-processor');

  try {
    const result = await rebuildKbFromPublished(strapi, {
      syncWebsiteContent,
      queueAdd: async (queueName: string, data: any) => documentQueue.add('process', data),
    });
    console.log('[rebuild-kb] Result:', result);
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

运行：`cd backend && npx vitest run scripts/__tests__/rebuild-kb-from-published.test.ts`
预期：2/2 PASS。

- [ ] **步骤 5：Commit**

```bash
git add backend/scripts/rebuild-kb-from-published.ts backend/scripts/__tests__/rebuild-kb-from-published.test.ts
git commit -m "feat(scripts): KB 服务器清理重建脚本（删垃圾→唯一索引→镜像同步→全量重向量化）"
```

---

### 任务 7：全量回归 + 交付

**文件：** 无新增

- [ ] **步骤 1：全量测试 + typecheck**

运行：`cd backend && npx vitest run && npm run typecheck`
预期：全部测试 PASS（含既有 resync-knowledge-base.test.ts、seed-i18n.test.ts 等不回归）；typecheck 无错误。
注意：`resync-knowledge-base.ts` 解构 `{ synced, updated, errors }`——`syncWebsiteContent` 新返回多了 `removed` 字段，旧解构不受影响，无需改动。

- [ ] **步骤 2：交付清单（部署需用户确认后执行，不在本计划自动做）**

向用户报告：
1. 本地全部测试通过的证据（vitest 输出摘要）
2. 服务器部署步骤（待用户确认）：
   - rsync 代码到服务器（排除 .env/uploads/node_modules）
   - `sudo docker compose build backend && sudo docker compose up -d backend`
   - 容器内执行 `npx tsx scripts/rebuild-kb-from-published.ts`
   - 验证：DB 查 KB 计数（content-sync 数 == 后台 published 数×locale）、问 AI 客服一个 KB 没有的问题确认回答"暂无该信息"

- [ ] **步骤 3：Commit（如有回归修复）**

```bash
git add -p  # 仅添加回归修复相关文件
git commit -m "test(kb-sync): 全量回归修复"
```

---

## 自检记录

- **规格覆盖：** A(UID)=任务1；B(发布态对应)=任务2/3；C(清理重建+唯一索引)=任务6；D(无种子)=任务4；E(防幻觉)=任务5；F(TDD)=任务1-6 全程 ✅
- **类型一致性：** `reconcileContent(strapi, uid, { documentId, locale })` 在任务1/2 签名一致；`syncWebsiteContent` 返回 `{ synced, updated, removed, errors }` 在任务3/6 一致；`SYNCED_UIDS` 任务1 定义、任务1 使用 ✅
- **D7 衔接：** 内容占位种子保留（不动各 service 的 initializeDefaults，KB 种子除外）；KB 隔离靠"零硬编码种子 + 全部派生"，Q5 计划再补 reset 脚本兜底 ✅
