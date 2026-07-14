# 通宵综合执行决策报告

> **日期**: 2026-07-14
> **执行范围**: P0-P2 修复 + 路由审计 + 页面内容补充 + AI 客服系统完整实现
> **分支**: `feat/homepage-sections`

---

## 1. 执行概览

### Stage 1-3: P0-P2 修复（已完成）
- 23 项 P0/P1/P2 问题全部修复
- 包括: Next.js Image Docker 修复、SSR URL 分离、品牌字样统一、字体加载、Hero 按钮跳转等

### Stage 4: 路由审计（已完成）
- 层级导航菜单（幼儿园课程 → 幼小衔接/课后托管/全日制托班）
- Footer 预约链接修复（/appointment → /contact）
- 路由审计报告: `docs/superpowers/reports/2026-07-13-route-audit.md`

### Stage 5: 页面内容补充（已完成）
- 关于我们页 4 个 section 补充
- 6 个 E2E 测试

### Stage 6: 综合测试（已完成）
- 36 个视觉测试（全页面截图对比）
- 4 个 Strapi API 测试（真实后端录入验证）
- 课程 slug 修复、首页 meta description 修复
- 87 E2E 测试 + 287 vitest 测试全部通过

### Stage 7: AI 客服系统（进行中）

#### Task 7.1: 基础设施 ✅
- PostgreSQL 升级为 `pgvector/pgvector:pg16`
- `knowledge_embeddings` 表创建（vector(1536) + ivfflat 索引）
- docker-compose.yml 添加 AI 环境变量

#### Task 7.2: Strapi Schema ✅
- 4 个新 content type: chat-session, chat-message, ai-config, vector-config
- 2 个 schema 扩展: knowledge-base（+file/sourceUrl/category）, faq-item（+sourceType/sourceSession/reviewStatus/vectorSynced）
- 所有表手动 SQL 创建（生产模式不自动同步 schema）

#### Task 7.3: LLM 服务 ✅
- `backend/src/services/llm-service.ts`: 通义千问/DashScope 集成
- 功能: generateEmbedding, generateEmbeddings, chat, chatStream, detectIntent
- 18 个单元测试全部通过

#### Task 7.4: RAG 服务 ✅
- `backend/src/services/rag-service.ts`: pgvector 检索 + 答案生成
- 功能: retrieve, generateAnswer, feedbackToFaq
- 12 个单元测试全部通过

#### Task 7.5: 文档处理队列（后台 Agent 进行中）
- 增强现有 BullMQ document-processor worker
- 向量化管线: 文本提取 → 清洗 → 分块(500+50) → Embedding → pgvector

#### Task 7.6: 后端 API 路由（后台 Agent 进行中）
- `POST /api/chat/start` - 创建会话
- `POST /api/chat/message` - 发送消息（SSE 流式返回）
- `POST /api/chat/transfer` - 转人工
- `GET /api/chat/history/:sessionId` - 获取历史

#### Task 7.7: 前端 FloatingChat 组件 ✅
- `ChatInput.tsx`: 输入框+发送按钮，回车发送/Shift+Enter 换行，loading/disabled 状态
- `ChatMessage.tsx`: user/assistant/system 三种角色样式，流式打字光标，转人工特殊样式
- `FloatingChat.tsx`: 悬浮按钮+聊天窗口，SSE 流式接收，转人工 UI，localStorage 会话持久化
- 集成到 `app/layout.tsx`（所有页面右下角显示）
- 35 个单元测试全部通过

#### Task 7.8: Next.js SSE 代理路由 ✅
- `lib/chat.ts`: API 客户端封装（startChat/sendMessage/transferToHuman/getChatHistory/parseSSEStream）
- `lib/chat-proxy.ts`: 代理工具（JSON 代理+SSE 流式代理）
- `app/api/chat/{start,message,transfer,history/[sessionId]}/route.ts`: 4 个 Next.js API 路由
- 20 个单元测试全部通过

#### Task 7.9: E2E 测试 ✅
- 8 个 E2E 测试覆盖 FloatingChat 全流程
- 注: 需要重建 Docker 容器后才能运行（当前容器使用旧代码）

---

## 2. 关键技术决策

| # | 决策 | 选择 | 理由 |
|---|------|------|------|
| 1 | LLM 供应商 | 通义千问 (Qwen) | 用户指定，国内访问稳定 |
| 2 | Embedding 模型 | text-embedding-v2 (1536维) | 通义千问自带，与 pgvector 匹配 |
| 3 | 向量库 | pgvector (PostgreSQL 扩展) | 用户指定，与现有 PostgreSQL 集成 |
| 4 | 消息队列 | BullMQ + Redis | 项目已有基础设施 |
| 5 | 流式返回 | SSE (Server-Sent Events) | Next.js App Router 推荐 |
| 6 | 前端代理 | Next.js API Route 代理 | 避免暴露后端 URL，CORS 友好 |
| 7 | 会话持久化 | localStorage 存 sessionId | 刷新页面不丢失会话 |
| 8 | 文档分块 | 500 字符 + 50 重叠 | RAG 最佳实践 |
| 9 | 检索 top-K | 5 | RAG 最佳实践 |
| 10 | Strapi v5 生产模式 | 手动 SQL 建表 | 生产模式不自动同步 schema |

---

## 3. 测试汇总

### 单元测试 (Vitest)
| 模块 | 测试数 | 状态 |
|------|--------|------|
| ChatInput | 11 | ✅ 全部通过 |
| ChatMessage | 12 | ✅ 全部通过 |
| FloatingChat | 12 | ✅ 全部通过 |
| chat API 客户端 | 12 | ✅ 全部通过 |
| chat-proxy | 8 | ✅ 全部通过 |
| LLM 服务 | 18 | ✅ 全部通过 |
| RAG 服务 | 12 | ✅ 全部通过 |
| 前端现有测试 | 287 | ✅ 全部通过 |
| **总计** | **372** | **全部通过** |

### E2E 测试 (Playwright)
| 测试文件 | 测试数 | 状态 |
|----------|--------|------|
| floating-chat.spec.ts | 8 | 待 Docker 重建后验证 |
| visual-comprehensive.spec.ts | 36 | ✅ 已通过 |
| strapi-admin-seed.spec.ts | 4 | ✅ 已通过 |
| about-page.spec.ts | 6 | ✅ 已通过 |
| courses.spec.ts | 9 | ✅ 已通过 |
| 其他 E2E | 32 | ✅ 已通过 |

### TypeScript 检查
- 新增代码: 0 错误 ✅
- 预存错误: 1 个 (Hero.test.tsx 缺少 vi 导入) — 不影响生产

---

## 4. 文件清单

### 新增文件
**后端** (由后台 Agent 创建，待提交):
- `backend/src/services/llm-service.ts` — LLM 服务
- `backend/src/services/rag-service.ts` — RAG 服务
- `backend/src/services/__tests__/llm-service.test.ts` — LLM 测试
- `backend/src/services/__tests__/rag-service.test.ts` — RAG 测试
- `backend/src/api/chat/` — 聊天 API 路由
- `backend/src/queues/` — 队列配置

**前端** (已提交 00198c6):
- `frontend-next/components/chat/ChatInput.tsx`
- `frontend-next/components/chat/ChatMessage.tsx`
- `frontend-next/components/chat/FloatingChat.tsx`
- `frontend-next/lib/chat.ts` — API 客户端
- `frontend-next/lib/chat-proxy.ts` — 代理工具
- `frontend-next/app/api/chat/start/route.ts`
- `frontend-next/app/api/chat/message/route.ts`
- `frontend-next/app/api/chat/transfer/route.ts`
- `frontend-next/app/api/chat/history/[sessionId]/route.ts`
- `frontend-next/e2e/floating-chat.spec.ts`

### 修改文件
- `frontend-next/app/layout.tsx` — 添加 FloatingChat
- `frontend-next/__tests__/setup.ts` — 添加 scrollIntoView mock
- `backend/src/index.ts` — 注册聊天路由和 worker (Agent)
- `backend/package.json` — 添加 vitest (Agent)
- `docker-compose.yml` — pgvector + AI 环境变量

---

## 5. Git 提交历史

```
0de444d test(frontend-next): AI 客服 FloatingChat E2E 测试
00198c6 feat(frontend-next): AI 客服前端 FloatingChat 组件 + SSE 代理路由
c4164c0 feat: Stage 7.1+7.2 AI 客服基础设施 + Strapi schema
ba39509 test: Stage 6 视觉测试 + Strapi API 测试 + 预存 bug 修复
0daeb59 feat: Stage 5 关于我们页内容补充 - 4 个 section + E2E 测试
60acd79 docs: Stage 4 路由审计报告 + 修复 Footer 预约链接
155c68a feat: Stage 4 路由大检查 - 层级导航 + /appointment 入口 + 测试数据对齐
27b8897 fix(frontend-next): P2-16/18/19/21 新闻分页 + 404 橙色渐变 + Footer 链接 + 阴影对齐
5ba14c7 fix(frontend-next): P1-8/12/13/14 联系页信息卡片 + Nunito 字体 + padding 统一 + Hero Strapi 图片
ed02c4a fix(frontend-next): P1-9/10/11 Hero 按钮跳转 + CourseCTA 锚点 + TeamHeader 6 校区
```

---

## 6. 待完成项

1. **后台 Agent 完成**: 文档处理队列 + 后端 API 路由（Task 7.5+7.6）
2. **提交后端文件**: LLM 服务 + RAG 服务 + API 路由 + 队列配置
3. **Docker 重建**: 前端 + 后端容器需要重建以包含新代码
4. **E2E 全量验证**: 重建后运行全部 E2E 测试
5. **AI 客服端到端测试**: 配置 DASHSCOPE_API_KEY 后测试完整 RAG 流程

---

## 7. 架构图

```
用户浏览器
    ↓ (点击悬浮按钮)
FloatingChat (Client Component)
    ↓ POST /api/chat/start
Next.js API Route (代理)
    ↓ POST /api/chat/start
Strapi 后端 (chat-session 创建)
    ↓ 返回 sessionId
    
用户输入消息
    ↓ POST /api/chat/message
Next.js API Route (SSE 代理)
    ↓ POST /api/chat/message
Strapi 后端
    ├─ 写入用户 chat-message
    ├─ BullMQ 队列
    │   └─ Worker:
    │       ├─ detectIntent (关键词 + LLM)
    │       ├─ pgvector 检索 (top-K=5)
    │       ├─ 通义千问生成回答 (stream)
    │       └─ 写入 AI chat-message
    └─ SSE 流式返回
        ↓
Next.js API Route (透传 SSE)
    ↓
FloatingChat (parseSSEStream)
    ↓ 实时渲染 token
用户看到流式回答
```
