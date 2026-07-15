# AI 客服增强 + 遗留项处理 设计规格

**日期**: 2026-07-14
**状态**: 已确认，待编写实现计划
**前置**: 通宵综合执行（Stage 0-8）已完成

## 1. 背景与目标

通宵综合执行已完成 AI 客服系统基础（RAG + pgvector + BullMQ + 通义千问），但存在三个问题：

1. **API Key 硬编码**: `llm-service.ts` 从 `process.env.DASHSCOPE_API_KEY` 读取，客户交付时无法自行更换模型
2. **无防滥用机制**: AI 可能被用来问无关问题，且无对话轮次限制
3. **知识库与网站内容分离**: 课程/新闻/教师/校区等网站内容未自动入库，AI 无法回答"你们有哪些课程"

**目标**:
- 客户可在 Strapi admin 自行配置 API Key / 模型 / 参数
- AI 严格基于知识库回答，知识库外问题引导转人工 + 留资
- 网站内容自动同步到知识库，内容更新自动重新向量化
- 10 轮对话阈值，超出引导留资

## 2. 现状分析

### 已有基础设施

| 组件 | 状态 | 说明 |
|------|------|------|
| `ai-config` content type | ✅ 已存在 | 支持 qwen/openai/custom provider + private apiKey |
| `vector-config` content type | ✅ 已存在 | 支持 pgvector/qdrant/milvus |
| `knowledge-base` content type | ✅ 已存在 | 支持 manual/pdf/webpage/faq 四种来源 |
| `llm-service.ts` | ⚠️ 硬编码 | 从 `process.env` 读取，未接入 ai-config 表 |
| `rag-service.ts` | ⚠️ 无阈值 | 检索结果不判断相似度阈值 |
| `chat controller` | ⚠️ 无限流 | 无对话轮次限制 |
| `document-processor.ts` | ✅ 已实现 | BullMQ Worker 完整向量化管线 |
| `chat-session schema` | ⚠️ 无计数 | 缺少 messageCount 字段 |

### 断层

`ai-config` 表已存在但 `llm-service.ts` 未使用 → **核心改造点**

## 3. 整体架构

```
访客浏览器 (FloatingChat)
    ↓ POST /api/chat/message
Next.js API Route (代理层)
    ↓ HTTP
Strapi chat controller
    ├── 1. 限流检查：chat-session.messageCount >= 10？
    │   └── 是 → 返回 { type: 'transfer', content: '留资引导', actionUrl: '/appointment' }
    ├── 2. RAG 检索：rag-service.retrieve(query, topK=5)
    │   └── 相似度 < 0.3 → 返回 { type: 'transfer', content: '转人工引导' }
    ├── 3. LLM 生成：llm-service.chat(prompt, history)
    │   └── 从 ai-config 表读取 active 配置（5min 内存缓存）
    │   └── 统一 OpenAI 兼容 API 调用
    └── 4. 递增 messageCount，返回 { type: 'answer', content, retrievedDocs }
```

## 4. AI 配置动态加载

### 4.1 新增 `ai-config-service.ts`

封装 ai-config 表读取 + 5 分钟内存缓存。

```typescript
interface AiConfig {
  provider: 'qwen' | 'openai' | 'custom';
  model: string;
  embeddingModel: string;
  apiKey: string;
  apiEndpoint: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  topK: number;
}

let cachedConfig: { data: AiConfig; expiresAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function getActiveAiConfig(strapi): Promise<AiConfig | null> {
  if (cachedConfig && Date.now() < cachedConfig.expiresAt) {
    return cachedConfig.data;
  }
  const configs = await strapi.documents('api::ai-config.ai-config').findMany({
    filters: { isActive: true },
    limit: 1,
  });
  if (!configs.length) return null;
  cachedConfig = { data: configs[0], expiresAt: Date.now() + CACHE_TTL };
  return cachedConfig.data;
}

export function clearCache(): void { cachedConfig = null; }
```

### 4.2 `llm-service.ts` 改造

- **旧**: `const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';`
- **新**: `const config = await getActiveAiConfig(strapi);`
- 统一 OpenAI 兼容 API 格式（通义千问/DeepSeek/Kimi/智谱 GLM 都支持）
- endpoint 默认通义千问兼容地址，customer 可改

### 4.3 降级策略

如果 `ai-config` 表无 active 配置，回退到 `process.env.DASHSCOPE_API_KEY`，确保系统不中断。启动时打印警告日志。

### 4.4 多模型兼容

Customer 在 Strapi admin 填写：
- `provider`: 选 qwen/openai/custom
- `apiEndpoint`: 各模型的兼容 API 地址
- `apiKey`: 各模型的 API Key
- `model`: 如 `qwen-plus` / `deepseek-chat` / `moonshot-v1-8k` / `glm-4`

## 5. 防滥用机制

### 5.1 引导模式（知识库外问题处理）

`rag-service.ts` 改造：

```typescript
export async function retrieve(query: string, topK: number = 5) {
  const results = await vectorSearch(query, topK);
  const SIMILARITY_THRESHOLD = 0.3;
  const relevant = results.filter(r => r.similarity >= SIMILARITY_THRESHOLD);
  return {
    docs: relevant,
    isRelevant: relevant.length > 0,
  };
}
```

Chat controller 改造：

```typescript
const { docs, isRelevant } = await ragService.retrieve(query);
if (!isRelevant) {
  return ctx.body = {
    type: 'transfer',
    content: '这个问题我需要转给人工客服为您解答。您也可以先留下联系方式，我们的顾问会尽快联系您。',
    retrievedDocs: 0,
  };
}
```

### 5.2 10 轮对话阈值

`chat-session` schema 新增字段：

```json
{
  "messageCount": {
    "type": "integer",
    "default": 0
  }
}
```

Chat controller 逻辑：

```typescript
if (session.messageCount >= 10) {
  return ctx.body = {
    type: 'transfer',
    content: '您今天已经咨询了很多问题，为了更好地为您服务，建议您预约一次免费试听课，我们的顾问会为您详细解答。',
    actionUrl: '/appointment',
    retrievedDocs: 0,
  };
}
// 正常回复后递增
await strapi.db.query('api::chat-session.chat-session').update({
  where: { id: session.id },
  data: { messageCount: session.messageCount + 1 },
});
```

### 5.3 前端配合

`ChatResponse` 接口新增 `actionUrl` 字段：

```typescript
export interface ChatResponse {
  type: 'answer' | 'transfer';
  content: string;
  retrievedDocs?: number;
  actionUrl?: string;
}
```

FloatingChat 收到 `type: 'transfer'` 且有 `actionUrl` 时，在消息下方渲染"立即预约"按钮。

### 5.4 输入长度限制

单条消息最大 500 字符，前端 ChatInput + 后端 chat controller 双重校验。

## 6. 网站内容自动同步到知识库

### 6.1 同步服务 `knowledge-sync-service.ts`

```typescript
// 监听 Strapi lifecycle hooks
// course/news-article/teacher/campus/faq-item 的 afterCreate/afterUpdate/afterDelete

// 序列化规则：
// 课程 → "课程：{title}。{description}。适合{ageRange}。学费{price}。"
// 新闻 → "新闻：{title}。{content}"
// 教师 → "教师：{name}，{title}。{bio}"
// 校区 → "校区：{name}，地址{address}，电话{phone}。{description}"
// FAQ → "问题：{question}。答案：{answer}"

// 去重标识：sourceType='content-sync' + sourceUrl='strapi://course/123'
// 更新时：status 回 pending → Worker 重新向量化
// 删除时：删除知识库文档 + 删除 pgvector 向量
```

### 6.2 schema 变更

`knowledge-base` 的 `sourceType` 枚举增加 `content-sync`：

```json
"sourceType": {
  "type": "enumeration",
  "enum": ["manual", "faq", "pdf", "webpage", "chat-history", "content-sync"],
  "default": "manual"
}
```

### 6.3 手动触发 API

新增 `POST /api/knowledge-base/sync-all`：全量重新同步所有网站内容到知识库。用于首次启用或数据迁移。

### 6.4 pgvector 清理

删除知识库文档时，同步删除 pgvector `knowledge_embeddings` 表中对应的向量（按 `documentId` 删除）。

## 7. 遗留项处理

| 遗留项 | 执行步骤 | 前置条件 |
|--------|---------|---------|
| API Key 测试真实 RAG | 配置 DASHSCOPE_API_KEY 到 ai-config 表 → 启动后端 → curl 测试 /api/chat/start + /api/chat/message → 验证真实通义千问回复 | 子系统 A 完成 |
| Chat API 5 端点开放 public | Strapi admin → Settings → Users & Permissions → Public → 勾选 chat 的 5 个 endpoint | 无 |
| 文档上传测试向量化 | 从佑森文件夹挑选 3-5 份文档 → Strapi admin 上传到 knowledge-base → 观察队列日志 → 验证 pgvector 表有数据 → 测试 RAG 检索 | API Key 测试完成 |

## 8. 测试策略（TDD 全程）

### 8.1 后端单元测试（Vitest）

| 测试文件 | 测试内容 |
|---------|---------|
| `ai-config-service.test.ts` | 缓存命中/失效/清空、无 active 配置降级到 env |
| `llm-service.test.ts`（改造） | mock ai-config-service，验证不同 provider 的 endpoint/key/model 正确传递 |
| `rag-service.test.ts`（改造） | 相似度阈值判断、isRelevant 返回值 |
| `chat controller.test.ts`（改造） | 10 轮阈值触发、引导模式触发、messageCount 递增、500 字符限制 |
| `knowledge-sync-service.test.ts`（新增） | 序列化规则、去重、更新触发重新向量化、删除清理 pgvector |

### 8.2 前端单元测试（Vitest）

| 测试文件 | 测试内容 |
|---------|---------|
| `FloatingChat.test.tsx`（改造） | actionUrl 渲染为按钮、10 轮阈值后的 transfer 消息 |
| `ChatInput.test.tsx`（改造） | 500 字符限制 |
| `lib/chat.ts`（改造） | ChatResponse 接口新增 actionUrl |

### 8.3 E2E 测试（Playwright）

| 测试文件 | 测试内容 |
|---------|---------|
| `floating-chat-enhanced.spec.ts`（新增） | 10 轮阈值触发留资引导、知识库外问题触发转人工 |

## 9. 文件清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `backend/src/services/ai-config-service.ts` | AI 配置读取 + 缓存 |
| `backend/src/services/knowledge-sync-service.ts` | 网站内容自动同步 |
| `backend/src/services/__tests__/ai-config-service.test.ts` | 单元测试 |
| `backend/src/services/__tests__/knowledge-sync-service.test.ts` | 单元测试 |
| `frontend-next/e2e/floating-chat-enhanced.spec.ts` | E2E 测试 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `backend/src/services/llm-service.ts` | 从 process.env → ai-config-service |
| `backend/src/services/rag-service.ts` | 增加相似度阈值 + isRelevant |
| `backend/src/api/chat/controllers/chat.ts` | 10 轮阈值 + 引导模式 + 500 字符限制 |
| `backend/src/api/chat-session/content-types/chat-session/schema.json` | 新增 messageCount 字段 |
| `backend/src/api/knowledge-base/content-types/knowledge-base/schema.json` | sourceType 增加 content-sync |
| `backend/src/api/knowledge-base/services/knowledge-base.ts` | 新增 syncAll + deleteVectors 方法 |
| `backend/src/api/knowledge-base/controllers/knowledge-base.ts` | 新增 sync-all endpoint |
| `backend/src/api/knowledge-base/routes/knowledge-base.ts` | 新增 sync-all 路由 |
| `backend/src/index.ts` | register lifecycle hooks |
| `frontend-next/components/chat/FloatingChat.tsx` | actionUrl 渲染按钮 |
| `frontend-next/components/chat/ChatInput.tsx` | 500 字符限制 |
| `frontend-next/lib/chat.ts` | ChatResponse 新增 actionUrl |

## 10. 自主决策清单

以下决策按 spec 默认处理，无需额外确认：

1. **相似度阈值 0.3**: 基于通义千问 text-embedding-v2 的余弦相似度分布经验值
2. **缓存 TTL 5 分钟**: 平衡配置实时性与数据库负载
3. **10 轮阈值**: 用户明确指定
4. **统一 OpenAI 兼容 API**: 覆盖通义千问/DeepSeek/Kimi/智谱 GLM 等主流国内模型
5. **降级到 env**: ai-config 表无配置时回退 process.env，确保不中断
6. **lifecycle hooks 而非 cron**: 实时同步，无需定时任务
7. **sourceUrl 格式 strapi://{contentType}/{documentId}**: 标准化去重标识
8. **500 字符限制**: 防止超长输入消耗 token
9. **不实现敏感词过滤**: YAGNI，10 轮阈值 + 引导模式已足够
10. **不实现 IP 限流**: YAGNI，10 轮阈值更符合教育机构场景

## 11. 后续子项目

本 spec 完成后，按顺序进入：
- **子项目 5**: 多语言 + SEO/GEO + 微信（单独 spec）
- **子项目 6**: 部署 + 多客户（单独 spec）
