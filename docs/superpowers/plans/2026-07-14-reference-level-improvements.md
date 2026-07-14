# 仅供参考级别改进实施计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实施代码审查中标记为"仅供参考"的 21 项改进，覆盖日志清理、可访问性、类型安全、文档补全、重构和架构增强。

**架构：** 分 6 个阶段递进实施 — 阶段 1-2 为低风险快速清理，阶段 3-4 为中等风险类型与文档改进，阶段 5-6 为可选的重构与架构增强。每个任务独立可提交。

**技术栈：** Strapi v5（后端）、Next.js 15 + React 18 + TypeScript（前端）、Vitest（单元测试）

---

## 评估后保持现状（4 项，不生成任务）

以下 4 项经评估后决定保持现状，无需实施：

| 编号 | 项目 | 理由 |
|------|------|------|
| R8 | FloatingChat useEffect 无 cleanup | `scrollIntoView` 是同步 DOM 操作，无副作用、无异步资源，不需要 cleanup。当前实现正确。 |
| R19 | DEFAULT_API_URL 硬编码 | `http://localhost:1337` 是合理的 fallback，生产环境通过 `NEXT_PUBLIC_STRAPI_API_URL` 覆盖。无需改动。 |
| R20 | layout.tsx revalidate 评估 | 当前 revalidate 配置符合项目约定（页面 300s，sitemap/llms.txt 3600s）。无需调整。 |
| R21 | proxyJsonRequest body 类型 unknown | `unknown` 是合理的 API 设计，强制调用方负责类型安全。保持现状。 |

---

## 阶段 1：日志噪声清理（低风险，高 ROI）

### 任务 1：R1 — knowledge-base service console.log 清理

**文件：**
- 修改：`backend/src/api/knowledge-base/services/knowledge-base.ts`

**背景：** Batch 2 已清理 controller 层的 console.log 噪声，service 层同样存在大量冗余日志（search/updateStatus/setVectorDbIds/initializeDefaults/getPendingDocuments/deleteVectors 共 14 处 console.log）。保留 console.error，移除 console.log。

- [ ] **步骤 1：清理 search 方法日志**

修改 `backend/src/api/knowledge-base/services/knowledge-base.ts:4-26`，移除 line 5 和 line 20 的 `console.log`：

```typescript
  async search(params: any) {
    try {
      const query = params?.query || '';
      const documents = await strapi.db.query('api::knowledge-base.knowledge-base').findMany({
        where: {
          status: 'ready',
          $or: [
            { title: { $containsi: query } },
            { content: { $containsi: query } },
            { tags: { $containsi: query } },
          ],
        },
        orderBy: { priority: 'desc', createdAt: 'desc' },
      });

      return { data: documents };
    } catch (err) {
      console.error('[KnowledgeBaseService] search() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
```

- [ ] **步骤 2：清理 updateStatus 方法日志**

移除 line 29 和 line 52 的 `console.log`：

```typescript
  async updateStatus(documentId: number, status: string, message?: string) {
    try {
      const updateData: any = { status };
      if (message) {
        updateData.statusMessage = message;
      }
      if (status === 'ready') {
        updateData.processedAt = new Date();
        updateData.failedAt = null;
      } else if (status === 'failed') {
        updateData.failedAt = new Date();
        const document = await strapi.db.query('api::knowledge-base.knowledge-base').findOne({
          where: { id: documentId },
        });
        if (document) {
          updateData.retryCount = (document.retryCount || 0) + 1;
        }
      } else if (status === 'processing') {
        updateData.processedAt = null;
        updateData.failedAt = null;
      }

      const result = await this.update(documentId, { data: updateData });
      return result;
    } catch (err) {
      console.error('[KnowledgeBaseService] updateStatus() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
```

- [ ] **步骤 3：清理 setVectorDbIds 方法日志**

移除 line 61 和 line 69 的 `console.log`：

```typescript
  async setVectorDbIds(documentId: number, ids: string[]) {
    try {
      const result = await this.update(documentId, {
        data: {
          vectorDbIds: ids,
          chunkCount: ids.length,
        },
      });
      return result;
    } catch (err) {
      console.error('[KnowledgeBaseService] setVectorDbIds() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
```

- [ ] **步骤 4：清理 initializeDefaults 方法日志**

移除 line 78、81、84、111、118、121 的 `console.log`：

```typescript
  async initializeDefaults() {
    try {
      const existing = await strapi.db.query('api::knowledge-base.knowledge-base').findMany();

      if (existing.length === 0) {
        const defaults = [
          {
            title: 'Introduction to Our Company',
            content: 'Welcome to our company. We provide high-quality products and services.',
            sourceType: 'manual',
            status: 'ready',
            priority: 'high',
            tags: 'company, introduction, about',
          },
          {
            title: 'Product FAQ',
            content: 'Frequently asked questions about our products.',
            sourceType: 'faq',
            status: 'ready',
            priority: 'medium',
            tags: 'product, FAQ, questions',
          },
          {
            title: 'Technical Documentation',
            content: 'Technical specifications and documentation.',
            sourceType: 'manual',
            status: 'pending',
            priority: 'low',
            tags: 'technical, documentation, specs',
          },
        ];

        const created = await Promise.all(
          defaults.map((item, index) => {
            return this.create({ data: item });
          })
        );
        return created;
      } else {
        return existing;
      }
    } catch (err) {
      console.error('[KnowledgeBaseService] initializeDefaults() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
```

- [ ] **步骤 5：清理 getPendingDocuments 和 deleteVectors 方法日志**

移除 line 131、137、146、153 的 `console.log`：

```typescript
  async getPendingDocuments() {
    try {
      const documents = await strapi.db.query('api::knowledge-base.knowledge-base').findMany({
        where: { status: 'pending' },
        orderBy: { priority: 'desc', createdAt: 'asc' },
      });
      return documents;
    } catch (err) {
      console.error('[KnowledgeBaseService] getPendingDocuments() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async deleteVectors(knowledgeBaseId: number) {
    try {
      // knowledge_embeddings 表的列是 knowledge_base_id（整数），不是 documentId
      await strapi.db.connection.raw(
        'DELETE FROM knowledge_embeddings WHERE knowledge_base_id = ?',
        [knowledgeBaseId]
      );
      return true;
    } catch (err) {
      console.error('[KnowledgeBaseService] deleteVectors() failed:', err);
      return false;
    }
  },
```

- [ ] **步骤 6：运行后端测试验证**

运行：`cd backend && npm test`
预期：51 passed，无回归

- [ ] **步骤 7：Commit**

```bash
git add backend/src/api/knowledge-base/services/knowledge-base.ts
git commit -m "refactor(backend): 清理 knowledge-base service console.log 噪声"
```

---

### 任务 2：R16 — api.ts 冗余 console.log 清理

**文件：**
- 修改：`frontend-next/lib/api.ts`

**背景：** `fetchApi` 内部已有结构化的 `logRequest`/`logResponse`/`logError`，但 `getSiteSettings`/`getNavigation`/`getFooter`/`getPages`/`getHomepage`/`getPageBySlug`/`getProducts`/`getFeaturedProducts`/`getProductBySlug`/`getProductCategories`/`getProductCategoryTree` 等函数额外添加了冗余的 `console.log`，与 `logRequest`/`logResponse` 重复。移除这些冗余日志。

- [ ] **步骤 1：移除所有 API 函数中的冗余 console.log**

`frontend-next/lib/api.ts` 中有约 20 处 `console.log` 分布在 `getSiteSettings`(L102,105)、`getNavigation`(L110,112)、`getNavigationTree`(L117,119)、`getFooter`(L124,127)、`getPages`(L132,135)、`getHomepage`(L140,142)、`getPageBySlug`(L147,149)、`getProducts`(L154,161)、`getFeaturedProducts`(L166,168)、`getProductBySlug`(L173,175)、`getProductCategories`(L180,182)、`getProductCategoryTree`(L187,189) 等函数。

对每个函数，移除 "Fetching xxx..." 和 "xxx loaded: ..." 两条 console.log。例如 `getSiteSettings` 改为：

```typescript
export async function getSiteSettings() {
  return fetchApi<{ data: SiteSettings[] }>('/api/site-settings');
}
```

对其余函数做同样处理，保留 `fetchApi` 内部的 `logRequest`/`logResponse`/`logError`。

- [ ] **步骤 2：运行前端测试验证**

运行：`cd frontend-next && npx vitest run`
预期：347 passed，无回归

- [ ] **步骤 3：Commit**

```bash
git add frontend-next/lib/api.ts
git commit -m "refactor(frontend-next): 移除 api.ts 冗余 console.log（fetchApi 已有结构化日志）"
```

---

## 阶段 2：可访问性与样式（低风险）

### 任务 3：R15 — Faq 搜索框 aria-label

**文件：**
- 修改：`frontend-next/components/sections/Faq.tsx:75-81`

- [ ] **步骤 1：添加 aria-label**

修改 `frontend-next/components/sections/Faq.tsx` 第 75-81 行的 input：

```tsx
              <input
                type="text"
                placeholder="搜索常见问题..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="搜索常见问题"
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-card focus:outline-none focus:border-[#F5851F] transition-colors"
              />
```

- [ ] **步骤 2：运行前端测试验证**

运行：`cd frontend-next && npx vitest run components/sections/__tests__/Faq.test.tsx`
预期：PASS（若有 Faq 测试文件）；若无则运行全套 `npx vitest run` 预期 347 passed

- [ ] **步骤 3：Commit**

```bash
git add frontend-next/components/sections/Faq.tsx
git commit -m "fix(frontend-next): Faq 搜索框添加 aria-label 提升可访问性"
```

---

### 任务 4：R12 — Hero h1 whiteSpace 提取为 Tailwind 类

**文件：**
- 修改：`frontend-next/components/sections/Hero.tsx:49-59`

- [ ] **步骤 1：将内联 whiteSpace 改为 Tailwind 类**

修改 `frontend-next/components/sections/Hero.tsx` 第 49-59 行，从 style 对象中移除 `whiteSpace: 'pre-line'`，在 className 中添加 `whitespace-pre-line`：

```tsx
            <h1
              className="text-white leading-[1.2] mb-6 whitespace-pre-line"
              style={{
                fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                fontSize: 'clamp(2.4rem, 4vw, 3.6rem)',
                fontWeight: 800,
              }}
            >
              {title || '让每个孩子\n自信迈入小学大门'}
            </h1>
```

- [ ] **步骤 2：运行前端测试验证**

运行：`cd frontend-next && npx vitest run components/sections/__tests__/Hero.test.tsx`
预期：5 passed

- [ ] **步骤 3：Commit**

```bash
git add frontend-next/components/sections/Hero.tsx
git commit -m "refactor(frontend-next): Hero h1 whiteSpace 提取为 Tailwind 类"
```

---

## 阶段 3：类型安全（中风险）

### 任务 5：R14 — Testimonials any 类型替换为 interface

**文件：**
- 修改：`frontend-next/components/sections/Testimonials.tsx`

- [ ] **步骤 1：定义 Testimonial interface 并替换 any**

在 `frontend-next/components/sections/Testimonials.tsx` 顶部添加 interface，替换 line 29 的 `(testimonial: any)`：

```typescript
import { Star } from 'lucide-react';
import type { Section } from '@/lib/api';

interface Testimonial {
  id: number;
  rating?: number;
  content: string;
  author: string;
  position?: string;
  company?: string;
  avatar?: {
    url: string;
  };
}

export default function Testimonials({ section }: { section: Section }) {
  const { title, testimonials } = section;
  const testimonialList = Array.isArray(testimonials) ? testimonials : testimonials?.data || [];

  return (
    <section className="py-24 bg-background">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFF3E5] text-[#F5851F] text-sm font-medium mb-5">
            <Star size={14} />
            客户评价
          </div>
          <h2
            className="text-[#1C2B3A] mb-4"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: '2.25rem',
              fontWeight: 800,
            }}
          >
            {title || '听听家长们怎么说'}
          </h2>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {testimonialList.map((testimonial: Testimonial) => (
            <div key={testimonial.id} className="col-span-12 md:col-span-4">
              <div className="bg-card rounded-2xl p-8 border border-border shadow-sm hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: testimonial.rating || 5 }).map((_, i) => (
                    <Star key={i} size={14} fill="#F5851F" className="text-[#F5851F]" />
                  ))}
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">&ldquo;{testimonial.content}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex items-center justify-center text-[#F5851F] font-bold text-sm shrink-0">
                    {testimonial.avatar?.url ? (
                      <img
                        src={testimonial.avatar.url}
                        alt={testimonial.author}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      testimonial.author?.[0] || '?'
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-[#1C2B3A]">{testimonial.author}</div>
                    <div className="text-xs text-muted-foreground">
                      {[testimonial.position, testimonial.company].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **步骤 2：运行前端测试验证**

运行：`cd frontend-next && npx vitest run`
预期：347 passed，无回归

- [ ] **步骤 3：Commit**

```bash
git add frontend-next/components/sections/Testimonials.tsx
git commit -m "refactor(frontend-next): Testimonials any 类型替换为 Testimonial interface"
```

---

### 任务 6：R11 — ContactForm submitData 字段冗余清理

**文件：**
- 修改：`frontend-next/components/sections/ContactForm.tsx:141-153`

**背景：** `submitData` 中 `name: values.parentName` 与 `parentName: values.parentName` 冗余。需确认后端 API 接受的字段名后决定保留哪个。若后端接受 `parentName`，移除 `name`；若后端接受 `name`，移除 `parentName`。

- [ ] **步骤 1：检查后端 appointment schema 确认字段名**

运行：`cd backend && grep -r "parentName\|parent_name" src/api/appointment/`
预期：确认 schema 中定义的字段名

- [ ] **步骤 2：根据 schema 移除冗余字段**

若后端字段为 `parentName`，修改 `frontend-next/components/sections/ContactForm.tsx:141-153`，移除 `name` 行：

```typescript
    const submitData = {
      childName: values.childName || '',
      parentName: values.parentName || '',
      phone: values.phone || '',
      campus: values.campus || '',
      age: values.age || undefined,
      course: values.course || undefined,
      preferredDate: values.preferredDate || undefined,
      preferredTimeSlot: values.preferredTimeSlot || undefined,
      message: values.message || undefined,
      sourcePage: typeof window !== 'undefined' ? window.location.pathname : '',
    };
```

- [ ] **步骤 3：运行前端测试验证**

运行：`cd frontend-next && npx vitest run`
预期：347 passed

- [ ] **步骤 4：Commit**

```bash
git add frontend-next/components/sections/ContactForm.tsx
git commit -m "refactor(frontend-next): ContactForm 移除 submitData 冗余 name 字段"
```

---

## 阶段 4：后端文档与校验（低风险）

### 任务 7：R3 — document-processor 模块级 JSDoc 增强

**文件：**
- 修改：`backend/src/queues/document-processor.ts:1-15`

**背景：** 文件头部已有基础注释，但缺少 Worker 生命周期管理说明和 closeDocumentWorker 导出函数的文档。

- [ ] **步骤 1：增强模块级 JSDoc**

修改 `backend/src/queues/document-processor.ts:1-15`，补充 Worker 生命周期和关闭机制说明：

```typescript
/**
 * Document processing queue + worker.
 *
 * Pipeline: fetch knowledge-base document -> clean text -> chunk ->
 * generate embedding -> write to pgvector (`knowledge_embeddings`).
 *
 * Job data shapes accepted (the existing knowledge-base controller enqueues
 * `{ type, documentId }` with the numeric `id`; newer callers may use
 * `{ knowledgeBaseId }`):
 *   - { knowledgeBaseId: number }
 *   - { documentId: number, type?: 'vectorize' | 'revectorize' }
 *
 * `llm-service` is required via a deferred require() so this module can load
 * even before the LLM service file exists (incremental dev / boot safety).
 *
 * Worker lifecycle:
 *   - `startDocumentWorker(strapi)` creates and starts the Worker, saving the
 *     instance to `documentWorkerInstance` for later shutdown.
 *   - `closeDocumentWorker()` gracefully closes the Worker. Called from
 *     `src/index.ts` destroy() before `closeAllQueues()`.
 *   - The Queue (`documentQueue`) is a producer-only instance; consumers that
 *     enqueue via `utils/queue.addJob()` do not need it.
 *
 * Schema bootstrap:
 *   - `ensureSchema(strapi)` lazily creates the `knowledge_embeddings`
 *     pgvector table on the first job, making the worker self-sufficient.
 */
```

- [ ] **步骤 2：运行后端测试验证**

运行：`cd backend && npm test`
预期：51 passed

- [ ] **步骤 3：Commit**

```bash
git add backend/src/queues/document-processor.ts
git commit -m "docs(backend): document-processor 模块级 JSDoc 增强（Worker 生命周期+schema 自举）"
```

---

### 任务 8：R7 — knowledge-base controllers JSDoc

**文件：**
- 修改：`backend/src/api/knowledge-base/controllers/knowledge-base.ts`

- [ ] **步骤 1：为每个 controller 方法添加 JSDoc**

在 `backend/src/api/knowledge-base/controllers/knowledge-base.ts` 中，为 `find`/`findOne`/`create`/`update`/`delete`/`search`/`syncAll` 添加简短 JSDoc。例如：

```typescript
export default factories.createCoreController('api::knowledge-base.knowledge-base', ({ strapi }) => ({
  /**
   * 列表查询。公开访问，不 populate 关联。
   */
  async find(ctx) {
    // ...
  },

  /**
   * 单条查询。公开访问，不 populate 关联。
   * @param ctx.params.id — documentId（Strapi v5 REST 路由参数）
   */
  async findOne(ctx) {
    // ...
  },

  /**
   * 创建知识库文档。需认证。
   * 自动设置 status='pending', retryCount=0，并触发 document-processing 队列向量化。
   */
  async create(ctx) {
    // ...
  },

  /**
   * 更新知识库文档。需认证。
   * 若文档状态为 ready 且有 content，触发 revectorize 队列重新向量化。
   * @param ctx.params.id — documentId
   */
  async update(ctx) {
    // ...
  },

  /**
   * 删除知识库文档。需认证。
   * 先清理 pgvector 中的向量数据，再删除 Strapi 记录，防止孤立残留。
   * @param ctx.params.id — documentId
   */
  async delete(ctx) {
    // ...
  },

  /**
   * 关键词搜索知识库。公开访问，查询长度限制 200 字符。
   * @param ctx.query.q — 搜索关键词
   */
  async search(ctx) {
    // ...
  },

  /**
   * 同步网站内容到知识库。需认证。
   * 调用 knowledge-sync-service 将 Strapi 内容序列化后写入知识库。
   */
  async syncAll(ctx) {
    // ...
  },
}));
```

- [ ] **步骤 2：运行后端测试验证**

运行：`cd backend && npm test`
预期：51 passed

- [ ] **步骤 3：Commit**

```bash
git add backend/src/api/knowledge-base/controllers/knowledge-base.ts
git commit -m "docs(backend): knowledge-base controllers 添加 JSDoc 注释"
```

---

### 任务 9：R4 — 路由权限注释说明

**文件：**
- 修改：`backend/src/api/knowledge-base/routes/knowledge-base.ts`

- [ ] **步骤 1：在路由文件头部添加权限设计注释**

修改 `backend/src/api/knowledge-base/routes/knowledge-base.ts`，在文件头部添加注释：

```typescript
/**
 * Knowledge Base 路由权限设计：
 *
 * 公开访问（auth: false）：
 *   - GET /knowledge-bases — 列表查询（访客可浏览已就绪文档）
 *   - GET /knowledge-bases/:id — 单条查询
 *   - GET /knowledge-bases/search — 关键词搜索
 *
 * 需认证（auth: true）：
 *   - POST /knowledge-bases — 创建文档（仅管理员）
 *   - PUT /knowledge-bases/:id — 更新文档（仅管理员）
 *   - DELETE /knowledge-bases/:id — 删除文档（仅管理员）
 *   - POST /knowledge-bases/sync-all — 同步网站内容（仅管理员）
 *
 * 权限分层理由：访客只需浏览和搜索已就绪的知识库内容，
 * 文档的增删改和同步操作涉及向量化队列和 pgvector 写入，必须由管理员执行。
 */
export default {
  routes: [
    // ... 现有路由不变
  ],
};
```

- [ ] **步骤 2：Commit**

```bash
git add backend/src/api/knowledge-base/routes/knowledge-base.ts
git commit -m "docs(backend): knowledge-base 路由权限设计注释说明"
```

---

### 任务 10：R6 — queue.ts isQueueAvailable 日志增强

**文件：**
- 修改：`backend/src/utils/queue.ts:13-15`

- [ ] **步骤 1：添加 Redis 不可用时的 warn 日志**

修改 `backend/src/utils/queue.ts` 第 13-15 行：

```typescript
export function isQueueAvailable(): boolean {
  const available = isAvailable && !!REDIS_HOST;
  if (!available && !REDIS_HOST) {
    strapi?.log?.warn('[Queue] Redis not configured (REDIS_HOST missing). Queue features disabled.');
  }
  return available;
}
```

注意：需确认文件顶部是否已有 `strapi` 引用。若无，需在 `register` 或 `bootstrap` 中注入，或通过 `import { strapi } from '@strapi/strapi'` 获取。若 strapi 不可用，退回 `console.warn`：

```typescript
export function isQueueAvailable(): boolean {
  const available = isAvailable && !!REDIS_HOST;
  if (!available && !REDIS_HOST) {
    console.warn('[Queue] Redis not configured (REDIS_HOST missing). Queue features disabled.');
  }
  return available;
}
```

- [ ] **步骤 2：运行后端测试验证**

运行：`cd backend && npm test`
预期：51 passed

- [ ] **步骤 3：Commit**

```bash
git add backend/src/utils/queue.ts
git commit -m "fix(backend): isQueueAvailable 添加 Redis 不可用 warn 日志"
```

---

### 任务 11：R2 — chat feedback session 存在性校验

**文件：**
- 修改：`backend/src/api/chat/controllers/chat.ts` submitFeedback 方法

**背景：** feedback 端点未校验 sessionDocumentId 是否对应真实 session，可能导致写入孤儿 feedback 记录。

- [ ] **步骤 1：定位 submitFeedback 方法**

运行：`cd backend && grep -n "submitFeedback\|feedback" src/api/chat/controllers/chat.ts`
预期：找到 submitFeedback 方法行号

- [ ] **步骤 2：添加 session 存在性校验**

在 submitFeedback 方法中，写入 feedback 前添加 session 校验：

```typescript
  async submitFeedback(ctx: any) {
    const { sessionDocumentId, question, answer, feedbackType } = ctx.request.body || {};

    if (!sessionDocumentId || !question || !answer) {
      ctx.throw(400, 'sessionDocumentId, question and answer are required');
    }

    // 校验 session 存在性
    const sessions = await strapi.documents('api::chat-session.chat-session').findMany({
      filters: { documentId: sessionDocumentId },
      limit: 1,
    });
    if (!sessions || sessions.length === 0) {
      ctx.throw(404, 'Session not found');
    }

    // ... 现有 feedback 写入逻辑不变
  },
```

- [ ] **步骤 3：编写测试验证 session 不存在时返回 404**

在 `backend/src/api/chat/__tests__/chat.test.ts` 中添加测试用例（若有测试文件），或手动验证。

- [ ] **步骤 4：运行后端测试验证**

运行：`cd backend && npm test`
预期：51 passed（或新增测试后 52 passed）

- [ ] **步骤 5：Commit**

```bash
git add backend/src/api/chat/controllers/chat.ts
git commit -m "fix(backend): chat feedback 添加 session 存在性校验"
```

---

## 阶段 5：前端重构（中风险，可选）

### 任务 12：R9 — FloatingChat handleSend 状态更新优化

**文件：**
- 修改：`frontend-next/components/chat/FloatingChat.tsx:83-159`

**背景：** handleSend 中有三次 setMessages 调用（用户消息、loading、AI 回复），可优化为更少的状态更新。但当前消息量小（<100），性能影响可忽略。**此任务为可选优化，风险 > 收益，建议跳过。**

- [ ] **步骤 1：评估是否需要重构**

阅读 `frontend-next/components/chat/FloatingChat.tsx:83-159`，确认三次 setMessages 的时序：
1. 添加用户消息 + loading 消息
2. 收到 AI 回复后移除 loading，添加 AI 消息
3. 若有 actionUrl，添加 action 消息

结论：时序合理，三次更新分别对应不同的用户可见状态。合并为单次更新会使中间的 loading 状态无法展示。**保持现状。**

- [ ] **步骤 2：若决定保持现状，在代码中添加注释说明**

```typescript
  // 注意：此处分三次 setMessages 是有意为之，分别对应：
  // 1. 用户消息 + loading 状态
  // 2. AI 回复（移除 loading）
  // 3. 可选的 action 按钮
  // 合并会丢失中间 loading 状态的展示
```

- [ ] **步骤 3：Commit（仅注释）**

```bash
git add frontend-next/components/chat/FloatingChat.tsx
git commit -m "docs(frontend-next): FloatingChat handleSend 添加状态更新时序注释"
```

---

### 任务 13：R10 — FloatingChat 网络失败重试机制

**文件：**
- 修改：`frontend-next/components/chat/FloatingChat.tsx`

**背景：** 当前网络失败仅展示错误提示，用户需手动重新输入。可添加"重试"按钮。

- [ ] **步骤 1：定义重试状态和最后失败消息**

在 FloatingChat 组件中添加状态：

```typescript
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
```

- [ ] **步骤 2：在 handleSend catch 块中保存失败消息**

```typescript
    } catch (err) {
      console.error('[FloatingChat] Failed to send message:', err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? { ...m, role: 'assistant' as ChatRole, content: '抱歉，发送失败，请点击重试或重新输入。', isError: true }
            : m
        )
      );
      setLastFailedMessage(message);
    }
```

- [ ] **步骤 3：添加重试按钮渲染逻辑**

在消息列表渲染中，对 isError 的消息添加重试按钮：

```tsx
  const handleRetry = () => {
    if (lastFailedMessage) {
      setLastFailedMessage(null);
      // 移除错误消息
      setMessages((prev) => prev.filter((m) => !m.isError));
      handleSend(lastFailedMessage);
    }
  };
```

- [ ] **步骤 4：编写测试验证重试功能**

在 `frontend-next/components/chat/__tests__/FloatingChat.test.tsx` 中（若存在）添加重试测试用例。

- [ ] **步骤 5：运行前端测试验证**

运行：`cd frontend-next && npx vitest run`
预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add frontend-next/components/chat/FloatingChat.tsx
git commit -m "feat(frontend-next): FloatingChat 网络失败添加重试按钮"
```

---

### 任务 14：R13 — Navigation dropdown 逻辑提取 hook

**文件：**
- 创建：`frontend-next/components/layout/useDropdown.ts`
- 修改：`frontend-next/components/layout/Navigation.tsx`

**背景：** Navigation 中 dropdown 的 mouse enter/leave + click 三种交互混用，可提取为 `useDropdown` hook。当前可工作，重构优先级低。

- [ ] **步骤 1：创建 useDropdown hook**

创建 `frontend-next/components/layout/useDropdown.ts`：

```typescript
import { useState, useCallback } from 'react';

export function useDropdown() {
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);

  const toggle = useCallback((id: number) => {
    setDropdownOpen((prev) => (prev === id ? null : id));
  }, []);

  const open = useCallback((id: number) => {
    setDropdownOpen(id);
  }, []);

  const close = useCallback(() => {
    setDropdownOpen(null);
  }, []);

  return { dropdownOpen, toggle, open, close };
}
```

- [ ] **步骤 2：在 Navigation 中使用 hook**

修改 `frontend-next/components/layout/Navigation.tsx`，替换原有的 `dropdownOpen` 状态和 `handleDropdownToggle`/`handleDropdownMouseEnter`/`handleDropdownMouseLeave`：

```typescript
import { useDropdown } from './useDropdown';

// 在组件内：
const { dropdownOpen, toggle: handleDropdownToggle, open: handleDropdownMouseEnter, close: handleDropdownMouseLeave } = useDropdown();
```

- [ ] **步骤 3：运行前端测试验证**

运行：`cd frontend-next && npx vitest run`
预期：347 passed

- [ ] **步骤 4：Commit**

```bash
git add frontend-next/components/layout/useDropdown.ts frontend-next/components/layout/Navigation.tsx
git commit -m "refactor(frontend-next): Navigation dropdown 逻辑提取为 useDropdown hook"
```

---

### 任务 15：R17 — fetchApi 返回类型泛型化（分批进行）

**文件：**
- 修改：`frontend-next/lib/api.ts`

**背景：** `fetchApi` 已是泛型 `<T>`，但调用方多传 `any`。需为每个 API 响应定义 interface，逐步替换。**此任务为大工程，建议分批进行，每次处理 3-5 个函数。**

- [ ] **步骤 1：审计当前 any 使用情况**

运行：`cd frontend-next && grep -n "fetchApi<any>" lib/api.ts | head -20`
预期：列出所有传 `any` 的调用点

- [ ] **步骤 2：为第一批函数定义 response interface**

对 `getCourses`/`getCourseBySlug`/`getCampuses`/`getCampusBySlug`/`getNews`/`getNewsBySlug` 等函数，定义对应的 response interface（如 `interface CoursesResponse { data: Course[]; meta: Pagination }`），替换 `fetchApi<any>` 为 `fetchApi<CoursesResponse>`。

- [ ] **步骤 3：运行前端测试验证**

运行：`cd frontend-next && npx vitest run`
预期：347 passed

- [ ] **步骤 4：Commit 第一批**

```bash
git add frontend-next/lib/api.ts
git commit -m "refactor(frontend-next): fetchApi 第一批 any 类型替换为具体 interface"
```

- [ ] **步骤 5：重复步骤 2-4 处理剩余函数**

每次处理 3-5 个函数，单独 commit。

---

### 任务 16：R18 — 客户端 lib 请求体基本类型检查

**文件：**
- 修改：`frontend-next/lib/chat.ts`

**背景：** 客户端校验意义有限（后端已校验），但可添加基本类型检查提前失败，避免无效网络请求。

- [ ] **步骤 1：为 startChat 添加基本类型检查**

修改 `frontend-next/lib/chat.ts` 的 `startChat`：

```typescript
export async function startChat(options?: { sourcePage?: string }): Promise<ChatResponse> {
  if (options && typeof options !== 'object') {
    throw new Error('startChat options must be an object');
  }
  // ... 现有逻辑
}
```

- [ ] **步骤 2：为 sendMessage 添加基本类型检查**

```typescript
export async function sendMessage(sessionId: string, message: string): Promise<ChatResponse> {
  if (typeof sessionId !== 'string' || !sessionId) {
    throw new Error('sessionId must be a non-empty string');
  }
  if (typeof message !== 'string' || !message) {
    throw new Error('message must be a non-empty string');
  }
  // ... 现有逻辑
}
```

- [ ] **步骤 3：为 transferToHuman 添加基本类型检查**

```typescript
export async function transferToHuman(sessionId: string): Promise<{ success: boolean; sessionId: string; status: string }> {
  if (typeof sessionId !== 'string' || !sessionId) {
    throw new Error('sessionId must be a non-empty string');
  }
  // ... 现有逻辑
}
```

- [ ] **步骤 4：更新 chat.test.ts 添加类型错误测试**

在 `frontend-next/lib/__tests__/chat.test.ts` 中添加：

```typescript
  it('sessionId 为空字符串时抛出错误', async () => {
    await expect(sendMessage('', 'test')).rejects.toThrow('sessionId must be a non-empty string');
  });

  it('message 为空字符串时抛出错误', async () => {
    await expect(sendMessage('sess-123', '')).rejects.toThrow('message must be a non-empty string');
  });
```

- [ ] **步骤 5：运行前端测试验证**

运行：`cd frontend-next && npx vitest run lib/__tests__/chat.test.ts`
预期：新增 2 个测试通过

- [ ] **步骤 6：Commit**

```bash
git add frontend-next/lib/chat.ts frontend-next/lib/__tests__/chat.test.ts
git commit -m "refactor(frontend-next): chat lib 添加基本类型检查提前失败"
```

---

## 阶段 6：架构级增强（高风险，长期）

### 任务 17：R5 — Worker 死信队列与速率控制

**文件：**
- 修改：`backend/src/queues/document-processor.ts`
- 修改：`backend/src/utils/queue.ts`

**背景：** 当前 `attempts: 5` + 指数退避，无死信队列，无速率限制。若后续文档量增长，需要：(1) 失败超阈值时写入死信表供人工介入；(2) BullMQ `limiter` 配置。**此任务为架构级增强，建议在文档量超过 1000 篇时实施。**

- [ ] **步骤 1：创建死信表 schema**

在 `backend/src/queues/document-processor.ts` 的 `ensureSchema` 函数中添加死信表创建：

```typescript
async function ensureSchema(strapi: any): Promise<void> {
  const db = strapi.db.connection;

  try {
    await db.raw('CREATE EXTENSION IF NOT EXISTS vector');
  } catch (err) {
    // ... 现有逻辑
  }

  // 死信表：记录重试耗尽仍失败的文档
  await db.raw(`
    CREATE TABLE IF NOT EXISTS document_processing_dead_letter (
      id SERIAL PRIMARY KEY,
      knowledge_base_id INTEGER NOT NULL,
      job_id VARCHAR(255),
      error_message TEXT,
      attempts INTEGER,
      failed_at TIMESTAMP DEFAULT NOW(),
      payload JSONB
    )
  `);
}
```

- [ ] **步骤 2：在 Worker failed 事件中写入死信表**

修改 `worker.on('failed')` 事件处理：

```typescript
  worker.on('failed', async (job, err) => {
    const knowledgeBaseId = job?.data?.knowledgeBaseId ?? job?.data?.documentId ?? 'unknown';
    const attempts = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts?.attempts ?? 5;
    console.error(`[Queue] Job ${job?.id} failed (knowledgeBaseId=${knowledgeBaseId}, attempts=${attempts}/${maxAttempts}):`, err.message);

    // 重试耗尽时写入死信表
    if (attempts >= maxAttempts) {
      try {
        await strapi.db.connection.raw(
          `INSERT INTO document_processing_dead_letter (knowledge_base_id, job_id, error_message, attempts, payload)
           VALUES (?, ?, ?, ?, ?)`,
          [knowledgeBaseId, job?.id, err.message, attempts, JSON.stringify(job?.data || {})]
        );
        console.warn(`[Queue] Job ${job?.id} moved to dead letter table`);
      } catch (dbErr) {
        console.error('[Queue] Failed to write to dead letter table:', dbErr instanceof Error ? dbErr.message : dbErr);
      }
    }
  });
```

- [ ] **步骤 3：添加 BullMQ 速率限制（可选）**

在 Worker 创建时添加 `limiter` 配置：

```typescript
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => { /* ... */ },
    {
      connection: redisConfig,
      limiter: {
        max: 5,
        duration: 1000, // 每秒最多 5 个任务
      },
    }
  );
```

- [ ] **步骤 4：创建死信表查询 API（可选）**

在 `backend/src/api/knowledge-base/controllers/knowledge-base.ts` 中添加 `listDeadLetter` 方法，供管理员查看失败任务。

- [ ] **步骤 5：编写测试验证死信表写入**

在 `backend/src/queues/__tests__/document-processor.test.ts` 中（若存在）添加测试，模拟 5 次重试失败后验证死信表写入。

- [ ] **步骤 6：运行后端测试验证**

运行：`cd backend && npm test`
预期：51 passed（或新增测试后更多）

- [ ] **步骤 7：Commit**

```bash
git add backend/src/queues/document-processor.ts
git commit -m "feat(backend): document-processing 添加死信队列和速率限制"
```

---

## 自检清单

### 规格覆盖度
- [x] R1 — 任务 1（knowledge-base service 日志清理）
- [x] R2 — 任务 11（chat feedback session 校验）
- [x] R3 — 任务 7（document-processor JSDoc）
- [x] R4 — 任务 9（路由权限注释）
- [x] R5 — 任务 17（死信队列与速率控制）
- [x] R6 — 任务 10（isQueueAvailable 日志）
- [x] R7 — 任务 8（controllers JSDoc）
- [x] R8 — 评估后保持现状（无需任务）
- [x] R9 — 任务 12（handleSend 状态优化，建议保持现状+注释）
- [x] R10 — 任务 13（重试机制）
- [x] R11 — 任务 6（submitData 字段冗余）
- [x] R12 — 任务 4（Hero whiteSpace Tailwind 类）
- [x] R13 — 任务 14（Navigation dropdown hook）
- [x] R14 — 任务 5（Testimonials any 替换）
- [x] R15 — 任务 3（Faq aria-label）
- [x] R16 — 任务 2（api.ts 日志清理）
- [x] R17 — 任务 15（fetchApi 泛型化）
- [x] R18 — 任务 16（客户端类型检查）
- [x] R19 — 评估后保持现状（无需任务）
- [x] R20 — 评估后保持现状（无需任务）
- [x] R21 — 评估后保持现状（无需任务）

### 优先级建议
- **高 ROI，建议立即实施：** 任务 1, 2, 3, 4, 7, 8, 9（日志清理 + 可访问性 + 文档）
- **中 ROI，按需实施：** 任务 5, 6, 10, 11, 16（类型安全 + 校验）
- **低 ROI，可选实施：** 任务 12（仅注释）, 13, 14, 15（重构）
- **长期，按需实施：** 任务 17（架构级，文档量大时）

### 类型一致性
- `Testimonial` interface（任务 5）的属性名与 Testimonials.tsx 中使用的属性名一致：`id`, `rating`, `content`, `author`, `position`, `company`, `avatar.url`
- `useDropdown` hook（任务 14）返回的 `dropdownOpen`/`toggle`/`open`/`close` 与 Navigation.tsx 中现有函数签名一致
- 死信表 `document_processing_dead_letter`（任务 17）的列名 `knowledge_base_id` 与 `knowledge_embeddings` 表保持一致
