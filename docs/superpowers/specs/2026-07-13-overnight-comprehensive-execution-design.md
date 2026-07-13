# 通宵综合执行设计规格

> **创建日期：** 2026-07-13
> **状态：** 用户预先批准，执行中
> **执行窗口：** 2026-07-13 当晚至 2026-07-14 早晨
> **用户授权：** "全部按计划做" + "按 spec 默认 + 记录决策" + "我填充+你审查"

## 1. 背景与目标

用户在 2026-07-13 询问"现在还是有很多页面缺失，图也挂了，现在还要继续改还是先进行下一步"。经全面对比 9 份 spec 文档与当前 Next.js 实现，发现 23 项缺失（P0×6 + P1×9 + P2×8）。

用户要求：
1. 按 P0 → P1 → P2 顺序全部修完
2. 完成后执行全面视觉测试（浏览器截图）+ 代码测试 + E2E 测试
3. 后端测试数据用真实输入（通过 Playwright 自动操作 Strapi Admin UI 录入）
4. 系统性页面路由大检查，孤儿页面安排入口
5. 页面内容补充（关于我们页等）
6. 下一步 AI 客服系统（子项目 7）完整实现
7. 全部 TDD 严格模式
8. 明天早上看到测试完备、功能完备的项目

## 2. 用户决策记录

通过 AskUserQuestion 确认的关键决策：

| 决策项 | 用户选择 |
|--------|---------|
| 范围与时间 | 全部按计划做（P0-P2 + 测试 + 路由检查 + AI 客服完整） |
| AI 客服范围 | 完整实现（RAG + 向量化 + 多轮对话 + 转人工 + 反哺 FAQ + BullMQ + 向量库） |
| 未提交修改处理 | 分类提交多个 commit |
| 测试数据录入方式 | Playwright 自动操作 Strapi Admin UI |
| LLM 供应商 | 通义千问（Qwen）|
| 向量库 | pgvector（PostgreSQL 扩展） |
| LLM 角色 | 完整 RAG + 对话 |
| 文案处理 | 我填充 + 用户审查 |
| 小决策处理 | 按 spec 默认 + 记录决策到 reports |
| 其他功能范围 | 子项目 5（多语言+SEO/GEO+微信）+ 子项目 6（部署+多客户）— 今晚不做 |
| TDD 范围 | 全部 TDD 严格模式（包括 P0-P2 修复） |

## 3. 执行策略：分阶段交付

按优先级分 9 个 Stage，每个 Stage 有验证检查点。如果时间不够，前面 Stage 已交付的部分仍然完整可用。

| Stage | 内容 | 预计耗时 | 验证点 |
|-------|------|---------|--------|
| Stage 0 | 分类提交当前未提交修改 | 0.5h | git status clean |
| Stage 1 | P0 修复（6 项，TDD） | 3-4h | 单元测试 + E2E 通过 |
| Stage 2 | P1 修复（9 项，TDD） | 2-3h | 单元测试 + E2E 通过 |
| Stage 3 | P2 修复（除 AI 客服部分，TDD） | 2-3h | 单元测试通过 |
| Stage 4 | 路由大检查 + 入口规划 | 1-2h | E2E 通过 |
| Stage 5 | 页面内容补充 | 1-2h | 视觉验证 |
| Stage 6 | 全面视觉测试 + E2E 测试 | 2-3h | 截图对比 + 测试通过 |
| Stage 7 | AI 客服系统完整实现（TDD） | 6-8h | RAG 端到端测试 |
| Stage 8 | 最终验证 + 决策报告 | 1h | 完整测试套件通过 |

**总计：18-25 小时**

## 4. Stage 0：分类提交当前未提交修改

### 提交分组

1. **backend/seed 脚本**：`backend/scripts/seed-yousen.js`、`seed-floating-button.js`、`seed-navigation-full.js`、`fix-navigation-*.js`、`check-db.js`、`check-lnk.js`、`cleanup-old-data.js`
2. **backend/Docker + 配置**：`backend/Dockerfile`、`backend/.dockerignore`
3. **backend/controllers**：footer/navigation/page/product/site-settings controllers
4. **frontend-next/Docker 配置**：`Dockerfile`、`.dockerignore`、`.env.example`、`docker-compose.yml`、`docker-start.sh`、`configure-docker-mirrors.sh`
5. **frontend-next/组件修复**：`CampusHeader.tsx`、`Footer.tsx`、`Navigation.tsx`、`ContactForm.tsx`、`Faq.tsx`、`Testimonials.tsx`、`TeamFilter.tsx`、`Seo.tsx`
6. **frontend-next/页面修复**：`[slug]/page.tsx`、`appointment-success/page.tsx`、`campuses/[slug]/page.tsx`、`campuses/page.tsx`、`contact/page.tsx`、`courses/[slug]/page.tsx`、`faq/page.tsx`、`layout.tsx`、`llms.txt/route.ts`、`news/[slug]/page.tsx`、`news/page.tsx`、`page.tsx`
7. **frontend-next/删除**：`app/team/page.tsx`（已重定向到 /teachers）
8. **frontend-next/lib**：`api.ts`、`seo.ts`、`__tests__/api-url.test.ts`
9. **frontend-next/E2E 测试**：`e2e/*.spec.ts`
10. **frontend-next/组件测试**：`CampusHeader.test.tsx`
11. **根目录配置**：`.env`、`.env.example`
12. **资源**：`佑森/` 目录（图片素材）

## 5. Stage 1：P0 修复（TDD 严格模式）

### P0-1: G11 Next.js Image Docker 修复

**根因**：`/_next/image` 代理在 Docker 容器内无法访问 `localhost:1337`（localhost 指向容器自身）

**修复方案**：next.config.ts 设置 `images.unoptimized: true`
- 优点：最简单可靠，生产环境用 CDN 时也是最佳实践
- 缺点：失去 Next.js 图片优化（avif/webp 转换）
- 替代方案：自定义 loader 用 `STRAPI_API_URL_SSR`，但增加复杂度

**TDD 流程**：
1. Red：写 Playwright E2E 测试访问 /campuses，断言 `<img>` 标签 src 包含 `/uploads/`
2. Green：修改 next.config.ts
3. Refactor：清理 remotePatterns 配置（保留作文档）

### P0-2: G10 测试数据改武汉 6 校区

**修复范围**：8 个测试文件的 mock 数据
- `components/campus/__tests__/CampusCard.test.tsx`
- `components/campus/__tests__/CampusGrid.test.tsx`
- `components/team/__tests__/TeamFilter.test.tsx`
- `components/team/__tests__/TeamPage.test.tsx`
- `components/team/__tests__/TeamGrid.test.tsx`
- 其他引用北京校区的测试

**数据映射**：
- 朝阳校区 → 百步亭校区（chaoyang → baibuting）
- 海淀校区 → 光谷校区（haidian → guanggu）
- 西城校区 → 中南校区（xicheng → zhongnan）
- 丰台校区 → 后湖校区（fengtai → houhu）
- 东城校区 → 王家湾校区（dongcheng → wangjiawan）
- 石景山校区 → 动物园校区（shijingshan → dongwuyuan）

### P0-3: A2 教师详情页

**新建文件**：
- `frontend-next/app/teachers/[slug]/page.tsx`
- `frontend-next/lib/api.ts` 添加 `getTeacherBySlug(slug)`

**页面内容**：
- 面包屑（首页 > 师资团队 > 教师名）
- Hero 区：大头像 + 姓名 + 职称 + 标签
- 教育背景 + 教学特色（TeacherDetail 组件复用）
- 荣誉成就 badge 标签
- 所属校区链接
- CTA：预约试听

**TDD 流程**：
1. Red：E2E 测试从 /campuses/[slug] 点击教师 → 期望跳转 /teachers/[slug] 返回 200
2. Green：实现页面 + API
3. Refactor：抽取共享组件

### P0-4: A1 + C3 + D1 预约流程补全

**Strapi schema 修改**：
- `backend/src/api/appointment/content-types/appointment/schema.json` 添加字段：
  - `childName`（Text, required）
  - `parentName`（Text, required）
  - `preferredDate`（Date）
  - `assignedTo`（Relation admin user）
  - `notes`（Textarea）
  - `sourcePage`（Text）
- 旧 `name` 字段迁移：保留为 `parentName`（数据迁移）

**新建文件**：
- `frontend-next/app/appointment/page.tsx`（独立预约页）

**修改文件**：
- `frontend-next/components/sections/ContactForm.tsx`：
  - 拆分 `name` 为 `childName` + `parentName` 两个字段
  - 添加 `preferredDate` 日期选择
  - 字段动态从 Strapi 加载（P1 任务 C4 一起做）

**TDD 流程**：
1. Red：E2E 测试提交预约表单，断言 Strapi 后端收到 childName + parentName
2. Green：修改 schema + 表单
3. Refactor：字段配置抽到 Strapi contact-form component

### P0-5: B4 FAQ 分类筛选 + 反馈 UI

**修改文件**：`frontend-next/components/sections/Faq.tsx`

**新增功能**：
1. 顶部加 CategoryFilter pill 组（全部 / 课程咨询 / 服务相关 / 政策规定）
2. 每条 FAQ 展开后追加反馈按钮："有用 👍 / 没用 👎"
3. 调用 `submitFaqFeedback(faqId, { helpful: true/false })`

**分类映射**：
- course → 课程咨询
- service → 服务相关
- policy → 政策规定

**TDD 流程**：
1. Red：单元测试断言筛选后只显示对应分类；E2E 测试点击"有用"按钮调用 API
2. Green：实现 UI + 调用
3. Refactor：CategoryFilter 抽成独立组件

### P0-6: B1 CampusMap 组件

**新建文件**：`frontend-next/components/campus/CampusMap.tsx`

**实现**：
- 消费 `campus.mapEmbed` 字段（spec §2.3 schema 已定义）
- 直接渲染 iframe HTML（用户在 Strapi 后台粘贴百度/高德地图 embed 代码）
- 加载占位符 + 错误处理

**修改文件**：`frontend-next/app/campuses/[slug]/page.tsx` 插入 CampusMap

**TDD 流程**：
1. Red：单元测试断言 mapEmbed 有值时渲染 iframe，无值时渲染占位
2. Green：实现组件
3. Refactor：无

## 6. Stage 2：P1 修复（TDD）

| # | 任务 | 文件 | TDD 测试 |
|---|------|------|---------|
| P1-7 | 课程详情页 specValues 网格 + 价格独立区块 | `app/courses/[slug]/page.tsx` | 单元测试断言网格渲染 |
| P1-8 | 联系页补信息卡片 + 校区电话列表 | `app/contact/page.tsx` | 视觉验证 |
| P1-9 | Hero 区按钮加跳转 | `components/sections/Hero.tsx` | E2E 测试点击跳转 |
| P1-10 | CourseCTA 锚点修正为 `/contact` | `components/course/CourseCTA.tsx` | 单元测试断言 href |
| P1-11 | TeamHeader 统计数据 8→6 | `components/team/TeamHeader.tsx` | 单元测试断言文本 |
| P1-12 | 加载 Nunito 字体 | `app/layout.tsx` | 视觉验证 |
| P1-13 | 统一页面顶部 padding 为 `pt-[120px]` | 多个页面 | 视觉验证 |
| P1-14 | Hero Unsplash 图片换 Strapi 媒体 | `components/sections/Hero.tsx` + Strapi | E2E 测试断言图片源 |
| P1-15 | ContactForm 字段对齐 spec（与 P0-4 合并） | — | — |

## 7. Stage 3：P2 修复（TDD，除 AI 客服部分）

| # | 任务 | 文件 |
|---|------|------|
| P2-16 | 新闻列表分页 | `app/news/page.tsx` + Pagination 组件 |
| P2-17 | ContactForm 字段动态从 Strapi 加载 | `ContactForm.tsx` + Strapi contact-form component |
| P2-18 | 404 页面主色调改回橙色渐变 | `app/not-found.tsx` |
| P2-19 | Footer quickLinks 补"用户协议" | `Footer.tsx` + seed-yousen.js |
| P2-20 | navigation/footer schema 字段名对齐 | 延后到子项目 5 双语阶段 |
| P2-21 | 阴影值精确对齐 spec | 全局 CSS |

## 8. Stage 4：路由大检查 + 入口规划

### 检查方法

1. Glob 列出所有 `app/**/page.tsx` 路由
2. Playwright 爬取首页 + 所有页面，收集所有 `<a href>` 链接
3. 对比路由清单 vs 链接清单：找出孤儿页面（无入口）
4. 按企业官网标准布局规划导航栏二级菜单

### 标准企业官网导航结构

```
首页
关于我们 ▼
  ├── 学校介绍 (/about)
  ├── 办学理念 (/about/philosophy)
  └── 资质荣誉 (/about/honors)
课程体系 ▼
  ├── 全部课程 (/courses)
  ├── 幼小衔接 (/courses?category=youcheng)
  └── 拼音专项 (/courses?category=pinyin)
校区环境 ▼
  ├── 校区总览 (/campuses)
  └── 各校区详情 (/campuses/[slug])
师资团队 (/teachers)
新闻动态 (/news)
联系我们 ▼
  ├── 预约试听 (/appointment)
  └── 联系方式 (/contact)
```

### 入口规划原则

- 所有页面都能从导航栏或页脚到达（≤3 次点击）
- 孤儿页面（如 `/appointment-success`）通过流程到达即可，不需要导航入口
- 法律页面（用户协议/隐私政策/退款政策）放页脚
- 更新 Strapi navigation 数据，添加二级菜单 children

### 实现步骤

1. 写 Playwright 脚本爬取所有页面链接
2. 生成"路由 vs 入口"对比表
3. 更新 `backend/scripts/seed-yousen.js` 的 navigation 数据，添加 children
4. 重新 seed navigation（--force --only=navigation）
5. E2E 测试验证所有导航链接可达

## 9. Stage 5：页面内容补充

### 关于我们页（/about）

按 phase4 §4.2 通过 Strapi page + sections 补充。在 seed-yousen.js 中添加 about 页面数据：

```
about
├── section.rich-text（学校介绍）
├── section.rich-text（办学理念）
├── section.features（资质荣誉，3 个荣誉卡片）
└── section.advantages（统计数据：8 年 / 3000+ / 6 校区 / 50+）
```

**文案起草**：
- 学校介绍：佑森小课堂成立于 2017 年，专注 3-8 岁儿童幼小衔接教育...
- 办学理念：以儿童为中心，注重习惯养成与能力培养...
- 资质荣誉：武汉市教育局认证 / 3A 级培训机构 / 家长满意度 98%

### 联系页（/contact）

按 phase4 §5.2 补充。在 seed-yousen.js 中更新 contact 页面数据：

```
contact
├── section.rich-text（联系信息卡片：客服热线/邮箱/微信/服务时间）
├── section.rich-text（各校区电话列表）
└── section.contact-form（已存在）
```

**文案起草**：
- 客服热线：400-xxx-xxxx
- 邮箱：service@yousen.com
- 微信客服：yousen_kefu
- 服务时间：周一至周日 9:00-18:00

## 10. Stage 6：全面测试

### 测试矩阵

| 测试类型 | 工具 | 覆盖范围 | 通过标准 |
|---------|------|---------|---------|
| 单元测试 | Vitest | 所有组件 + lib 函数 | 100% 通过 |
| E2E 测试 | Playwright | 所有关键路径 | 100% 通过 |
| 视觉测试 | Playwright 截图 | 所有页面桌面+移动端 | 截图保存供审查 |
| 后端测试数据 | Playwright 操作 Strapi Admin UI | 录入测试数据 | 数据在前端可见 |

### Playwright 视觉测试脚本

新建 `frontend-next/e2e/visual-comprehensive.spec.ts`：
1. 桌面端（1280x720）访问所有页面，截图保存
2. 移动端（375x667）访问所有页面，截图保存
3. 关键交互截图：FAQ 展开、教师手风琴、校区图集切换等

### Strapi Admin UI 自动化录入脚本

新建 `frontend-next/e2e/strapi-admin-seed.spec.ts`：
1. 登录 Strapi Admin（`/admin`，用 admin 凭据）
2. 进入内容管理器 → Appointments
3. 创建 1 条测试预约（childName + parentName + phone + campus + course）
4. 进入 FAQ Items
5. 创建 1 条测试 FAQ（category=policy）
6. 进入 News
7. 创建 1 条测试新闻
8. 验证前端 /appointments-success、/faq、/news 能读取到这些数据

## 11. Stage 7：AI 客服系统完整实现

### 11.1 架构

```
用户 → 前端 FloatingChat → Next.js API Route /api/chat
                              ↓
                          创建/获取 chat-session
                              ↓
                          写入用户 chat-message
                              ↓
                          BullMQ 队列
                              ↓
                          Worker:
                            1. 检测转人工意图（关键词 + LLM）
                            2. pgvector 检索相关文档（top-K=5）
                            3. 通义千问生成回答（system + 检索片段 + 对话历史）
                            4. 写入 AI chat-message
                            5. 检测反哺 FAQ（用户问题 + AI 回答 → faq-item pending）
                              ↓
                          SSE 流式返回给前端
                              ↓
                          前端渲染回答
```

### 11.2 后端 schema（TDD）

**新建 collection types**：

1. `chat-session`：
```json
{
  "kind": "collectionType",
  "collectionName": "chat_sessions",
  "info": { "singularName": "chat-session", "pluralName": "chat-sessions", "displayName": "聊天会话" },
  "attributes": {
    "sessionId": { "type": "string", "required": true, "unique": true },
    "userId": { "type": "string" },
    "status": { "type": "enumeration", "enum": ["active", "transferred", "ended"], "default": "active" },
    "startedAt": { "type": "datetime", "required": true },
    "endedAt": { "type": "datetime" },
    "assignedTo": { "type": "relation", "relation": "manyToOne", "target": "admin::user" },
    "metadata": { "type": "json" }
  }
}
```

2. `chat-message`：
```json
{
  "kind": "collectionType",
  "collectionName": "chat_messages",
  "info": { "singularName": "chat-message", "pluralName": "chat-messages", "displayName": "聊天消息" },
  "attributes": {
    "session": { "type": "relation", "relation": "manyToOne", "target": "api::chat-session.chat-session", "inversedBy": "messages" },
    "role": { "type": "enumeration", "enum": ["user", "assistant", "system"], "required": true },
    "content": { "type": "text", "required": true },
    "tokens": { "type": "integer" },
    "retrievedDocs": { "type": "json" },
    "createdAt": { "type": "datetime" }
  }
}
```

3. `ai-config`（single type）：
```json
{
  "kind": "singleType",
  "collectionName": "ai_configs",
  "info": { "singularName": "ai-config", "pluralName": "ai-configs", "displayName": "AI 配置" },
  "attributes": {
    "provider": { "type": "enumeration", "enum": ["qwen", "openai", "glm", "deepseek"], "default": "qwen" },
    "modelName": { "type": "string", "default": "qwen-plus" },
    "temperature": { "type": "decimal", "default": 0.7 },
    "maxTokens": { "type": "integer", "default": 2048 },
    "systemPrompt": { "type": "text" },
    "enableRAG": { "type": "boolean", "default": true },
    "enableFeedback": { "type": "boolean", "default": true },
    "transferKeywords": { "type": "json" }
  }
}
```

4. `vector-config`（single type）：
```json
{
  "kind": "singleType",
  "collectionName": "vector_configs",
  "info": { "singularName": "vector-config", "pluralName": "vector-configs", "displayName": "向量库配置" },
  "attributes": {
    "provider": { "type": "enumeration", "enum": ["pgvector", "qdrant", "milvus"], "default": "pgvector" },
    "dimension": { "type": "integer", "default": 1536 },
    "indexName": { "type": "string", "default": "yousen_knowledge" },
    "embeddingModel": { "type": "string", "default": "text-embedding-v2" }
  }
}
```

**补全已有 collection**：

5. `knowledge-base` 补字段：`file`（Media）、`sourceUrl`（Text）、`category`（Enumeration）、`uploadedBy`（Relation admin::user）

6. `faq-item` 补字段：`sourceType`（Enumeration: manual/auto-from-chat）、`sourceSession`（Relation chat-session）、`reviewStatus`（Enumeration: pending/approved/rejected）、`vectorSynced`（Boolean）

### 11.3 后端服务（TDD）

**新建服务文件**：

1. `backend/src/api/chat-session/services/chat-session.ts`
   - `createSession(userId)`：创建会话
   - `getMessages(sessionId)`：获取历史消息
   - `addMessage(sessionId, role, content)`：添加消息
   - `transferToHuman(sessionId)`：转人工

2. `backend/src/api/knowledge-base/services/knowledge-base.ts`
   - `uploadDocument(file, metadata)`：上传文档
   - `processDocument(knowledgeBaseId)`：BullMQ 异步处理
   - `vectorizeDocument(text)`：调用通义千问 Embedding API + 写入 pgvector
   - `searchSimilar(query, topK)`：pgvector 相似度搜索

3. `backend/src/services/llm-service.ts`
   - `generateEmbedding(text)`：调用通义千问 text-embedding-v2
   - `chat(messages, systemPrompt)`：调用通义千问 qwen-plus
   - `detectIntent(message)`：检测转人工意图

4. `backend/src/services/rag-service.ts`
   - `retrieve(query, topK)`：pgvector 检索
   - `generateAnswer(query, retrievedDocs, history)`：调用 LLM
   - `feedbackToFaq(question, answer)`：写入 faq-item pending

5. `backend/src/queues/document-processor.ts`
   - BullMQ Worker：处理文档向量化
   - 步骤：文本提取 → 清洗 → 分块（chunk size 500）→ Embedding → 写入 pgvector

**自定义路由**：

- `POST /api/chat/start`：创建会话
- `POST /api/chat/message`：发送消息（SSE 流式返回）
- `POST /api/chat/transfer`：转人工
- `GET /api/chat/history/:sessionId`：获取历史

### 11.4 前端（TDD）

**新建组件**：

1. `frontend-next/components/chat/FloatingChat.tsx`（Client Component）
   - 右下角悬浮按钮（已有 FloatingButton，复用或扩展）
   - 点击展开聊天窗口
   - 消息列表 + 输入框 + 发送按钮
   - SSE 接收流式回答
   - 转人工提示 UI

2. `frontend-next/components/chat/ChatMessage.tsx`
   - 单条消息渲染（user/assistant 区分样式）
   - Markdown 渲染

3. `frontend-next/components/chat/ChatInput.tsx`
   - 输入框 + 发送按钮
   - 回车发送
   - loading 状态

**集成到 layout.tsx**：所有页面右下角显示 FloatingChat

### 11.5 基础设施

**docker-compose.yml 修改**：
- 添加 Redis 服务（BullMQ 用）
- PostgreSQL 镜像改为 `pgvector/pgvector:pg16`（带 pgvector 扩展）
- 后端容器安装 `pgvector` 扩展

**.env 添加**：
```
DASHSCOPE_API_KEY=sk-xxx
REDIS_HOST=redis
REDIS_PORT=6379
VECTOR_DB_PROVIDER=pgvector
EMBEDDING_MODEL=text-embedding-v2
CHAT_MODEL=qwen-plus
```

### 11.6 TDD 流程

1. **Red**：写测试
   - 单元测试：chat-session service CRUD
   - 单元测试：rag-service retrieve + generateAnswer（mock LLM）
   - 单元测试：document-processor pipeline
   - E2E 测试：前端发送消息 → 后端返回回答
   - E2E 测试：上传文档 → 向量化 → 检索

2. **Green**：实现
3. **Refactor**：优化

## 12. Stage 8：最终验证 + 决策报告

### 验证清单

1. `cd frontend-next && npm run test`（Vitest）
2. `cd frontend-next && npm run test:e2e`（Playwright）
3. `cd frontend-next && npm run build`（生产构建）
4. `cd backend && npm run build`
5. `docker compose up --build`（完整栈启动）
6. 浏览器手动访问所有页面（Playwright 截图保存）

### 决策报告

生成 `docs/superpowers/reports/2026-07-13-overnight-execution.md`，包含：
- 已完成项清单
- 跳过项及原因
- 自主决策清单（按 spec 默认执行的）
- 待用户审查项
- 已知问题
- 测试结果汇总

## 13. 自主决策清单

按用户授权"按 spec 默认 + 记录决策"，以下决策会记录到报告中：

| # | 决策项 | 选择 | 理由 |
|---|--------|------|------|
| 1 | Next.js Image 修复方案 | `unoptimized: true` | 最简单可靠，CDN 友好 |
| 2 | 教师详情页内容 | 复用 TeacherDetail + 大头像 + CTA | spec 未详细规定，复用现有组件 |
| 3 | CampusMap 实现 | 直接渲染 mapEmbed iframe HTML | spec §2.3 已规定字段 |
| 4 | FAQ 分类标签 | course→课程咨询 / service→服务相关 / policy→政策规定 | 中文语义化 |
| 5 | Hero 按钮跳转 | 立即预约试听→/contact / 了解课程体系→/courses | spec §4.4.2 |
| 6 | Nunito 字体 | 加载 Nunito | spec §8.2 要求 |
| 7 | 页面顶部 padding | 统一 `pt-[120px]` | spec §8.3 要求 |
| 8 | 通义千问模型 | qwen-plus + text-embedding-v2 | 性价比 + 支持 RAG |
| 9 | pgvector dimension | 1536 | text-embedding-v2 输出维度 |
| 10 | 文档分块大小 | 500 字符 + 50 重叠 | RAG 最佳实践 |
| 11 | 检索 top-K | 5 | RAG 最佳实践 |
| 12 | name 字段迁移 | 保留为 parentName | 数据迁移 |
| 13 | BullMQ 队列名 | document-processing | 语义化 |
| 14 | SSE 流式返回 | 用 ReadableStream | Next.js App Router 推荐 |
| 15 | 测试数据录入 | Playwright 操作 Strapi Admin UI | 用户要求 |

## 14. 跳过项清单

| # | 项目 | 原因 |
|---|------|------|
| 1 | 子项目 5（多语言+SEO/GEO+微信） | 用户指定"再下一步" |
| 2 | 子项目 6（部署+多客户） | 用户指定"再下一步" |
| 3 | navigation/footer schema 字段名对齐 | 涉及全站接口改造，双语阶段一起做 |
| 4 | AI 客服 LLM key 验证 | 用户表示有，执行时检查 .env |

## 15. 待用户审查项

明天用户回来后需审查：

1. 所有自主决策（见 §13）
2. 起草的文案（关于我们、联系页等）
3. 路由入口规划（导航栏二级菜单结构）
4. AI 客服系统 prompt（systemPrompt 内容）
5. 视觉测试截图
6. 决策报告

## 16. 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| 时间不够做不完 | 按 Stage 优先级推进，每 Stage 完成后 commit，保证已交付部分可用 |
| AI 客服外部依赖问题（API key/向量库） | 先做骨架，依赖问题记录到报告，明天用户确认后接通 |
| Strapi schema 修改导致数据丢失 | 修改前备份数据库；新增字段不删旧字段 |
| TDD 增加耗时 | 严格模式但允许"测试覆盖最小化"——只测核心逻辑，不测样式 |
| Playwright Admin UI 录入复杂 | 如果太复杂，降级为 REST API 调用（仍走真实后端） |

## 17. 成功标准

明天早上用户回来时：
1. ✅ 所有 P0-P2 修复完成（除明确跳过项）
2. ✅ 单元测试 + E2E 测试 100% 通过
3. ✅ 视觉测试截图保存供审查
4. ✅ 路由大检查完成，无孤儿页面
5. ✅ 页面内容补充完成（关于我们、联系页）
6. ✅ AI 客服系统完整实现（RAG + 对话 + 转人工 + 反哺 FAQ）
7. ✅ 决策报告生成
8. ⚠️ 如有未完成项，明确记录到报告中
