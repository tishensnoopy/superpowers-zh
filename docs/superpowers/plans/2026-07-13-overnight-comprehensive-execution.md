# 通宵综合执行实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 完成佑森小课堂项目 P0-P2 修复 + 路由大检查 + 页面内容补充 + AI 客服系统完整实现，全部 TDD 严格模式。

**架构：** 分 9 个 Stage 串行推进，每个 Stage 完成后 commit 并验证。Stage 1-3 修复已知问题，Stage 4-5 路由和内容，Stage 6 测试，Stage 7 AI 客服，Stage 8 最终验证。

**技术栈：** Next.js 15 + Strapi v5 + PostgreSQL+pgvector + Redis+BullMQ + 通义千问 + Playwright + Vitest

**规格来源：** `docs/superpowers/specs/2026-07-13-overnight-comprehensive-execution-design.md`

---

## Stage 0：分类提交当前未提交修改

**目标：** 清理工作区，把已完成的修复按类型分类提交，保证 git status clean。

**文件：** 当前所有未提交的修改和未跟踪文件。

### 任务 0.1：分组提交

- [ ] **步骤 1：检查 .env 不被提交**
  - 确认 `.gitignore` 包含 `.env`、`frontend-next/.env`、`backend/.env`
  - 确认 `佑森/` 目录是否应该提交（图片素材，建议提交）

- [ ] **步骤 2：提交 backend/seed 脚本**
  ```bash
  git add backend/scripts/seed-yousen.js backend/scripts/seed-floating-button.js \
          backend/scripts/seed-navigation-full.js backend/scripts/fix-navigation-*.js \
          backend/scripts/check-db.js backend/scripts/check-lnk.js backend/scripts/cleanup-old-data.js
  git commit -m "feat(backend): 添加佑森 seed 脚本和数据库修复工具"
  ```

- [ ] **步骤 3：提交 backend/Docker + controllers**
  ```bash
  git add backend/Dockerfile backend/.dockerignore \
          backend/src/api/footer/controllers/footer.ts \
          backend/src/api/navigation/controllers/navigation.ts \
          backend/src/api/page/controllers/page.ts \
          backend/src/api/product/controllers/product.ts \
          backend/src/api/site-settings/controllers/site-settings.ts
  git commit -m "fix(backend): Dockerfile 优化和 controllers Strapi v5 兼容性修复"
  ```

- [ ] **步骤 4：提交 frontend-next/Docker 配置**
  ```bash
  git add frontend-next/Dockerfile frontend-next/.dockerignore frontend-next/.env.example \
          frontend-next/docker-compose.yml frontend-next/docker-start.sh \
          frontend-next/configure-docker-mirrors.sh
  git commit -m "feat(frontend-next): 添加 Docker 生产构建配置和启动脚本"
  ```

- [ ] **步骤 5：提交 frontend-next/组件修复**
  ```bash
  git add frontend-next/components/campus/CampusHeader.tsx \
          frontend-next/components/campus/__tests__/CampusHeader.test.tsx \
          frontend-next/components/layout/Footer.tsx \
          frontend-next/components/layout/Navigation.tsx \
          frontend-next/components/sections/ContactForm.tsx \
          frontend-next/components/sections/Faq.tsx \
          frontend-next/components/sections/Testimonials.tsx \
          frontend-next/components/team/TeamFilter.tsx \
          frontend-next/components/Seo.tsx
  git commit -m "fix(frontend-next): 组件品牌字样统一和 Strapi v5 字段对齐"
  ```

- [ ] **步骤 6：提交 frontend-next/页面修复 + 删除 + lib**
  ```bash
  git add frontend-next/app/ frontend-next/lib/api.ts frontend-next/lib/seo.ts \
          frontend-next/lib/__tests__/api-url.test.ts
  git rm frontend-next/app/team/page.tsx 2>/dev/null || true
  git commit -m "fix(frontend-next): 页面 SSR URL 分离和 Image URL 修复"
  ```

- [ ] **步骤 7：提交 frontend-next/E2E + 组件测试**
  ```bash
  git add frontend-next/e2e/
  git commit -m "test(frontend-next): 更新 E2E 测试适配新数据"
  ```

- [ ] **步骤 8：提交根目录配置 + 资源**
  ```bash
  # .env 不提交（敏感）
  git add .env.example 佑森/ 2>/dev/null || git add .env.example
  git commit -m "chore: 添加环境变量示例和佑森品牌素材"
  ```

- [ ] **步骤 9：验证 git status clean**
  ```bash
  git status
  ```
  预期：`nothing to commit, working tree clean`（除 .env 等被忽略的文件）

---

## Stage 1：P0 修复（TDD 严格模式）

### 任务 1.1：P0-1 Next.js Image Docker 修复

**文件：**
- 修改：`frontend-next/next.config.ts`

- [ ] **步骤 1：写 E2E 测试（Red）**
  - 修改 `frontend-next/e2e/news-campus.spec.ts` 或新建 `e2e/images.spec.ts`
  - 测试访问 `/campuses`，断言页面中 `<img>` 标签的 `src` 直接是 `http://localhost:1337/uploads/...`（非 `/_next/image?url=...`）

- [ ] **步骤 2：运行测试验证失败**
  ```bash
  cd frontend-next && npx playwright test e2e/images.spec.ts
  ```
  预期：FAIL

- [ ] **步骤 3：修改 next.config.ts（Green）**
  ```typescript
  images: {
    unoptimized: true,
    // 保留 remotePatterns 作文档，但 unoptimized 时不会使用
    remotePatterns: [...],
  },
  ```

- [ ] **步骤 4：运行测试验证通过**
  ```bash
  cd frontend-next && npx playwright test e2e/images.spec.ts
  ```
  预期：PASS

- [ ] **步骤 5：Commit**
  ```bash
  git add frontend-next/next.config.ts frontend-next/e2e/images.spec.ts
  git commit -m "fix(frontend-next): Next.js Image 在 Docker 内挂掉 - 改用 unoptimized"
  ```

### 任务 1.2：P0-2 测试数据改武汉 6 校区

**文件：**
- 修改：8 个测试文件的 mock 数据

- [ ] **步骤 1：搜索所有北京校区引用**
  ```bash
  cd frontend-next && grep -rn "朝阳\|海淀\|西城\|丰台\|东城\|石景山\|通州\|昌平\|chaoyang\|haidian" components/ --include="*.test.tsx"
  ```

- [ ] **步骤 2：逐个文件修改 mock 数据**
  - `CampusCard.test.tsx`、`CampusGrid.test.tsx`、`TeamFilter.test.tsx`、`TeamPage.test.tsx`、`TeamGrid.test.tsx` 等
  - 数据映射：朝阳→百步亭、海淀→光谷、西城→中南、丰台→后湖、东城→王家湾、石景山→动物园

- [ ] **步骤 3：运行测试验证通过**
  ```bash
  cd frontend-next && npm test
  ```
  预期：之前失败的 8 个测试现在 PASS

- [ ] **步骤 4：Commit**
  ```bash
  git add frontend-next/components/**/__tests__/
  git commit -m "test(frontend-next): 测试 mock 数据从北京 8 校区改为武汉 6 校区"
  ```

### 任务 1.3：P0-3 教师详情页

**文件：**
- 创建：`frontend-next/app/teachers/[slug]/page.tsx`
- 修改：`frontend-next/lib/api.ts`（添加 `getTeacherBySlug`）

- [ ] **步骤 1：写 E2E 测试（Red）**
  - 新建 `frontend-next/e2e/teacher-detail.spec.ts`
  - 测试：访问 `/teachers/baibuting-teacher-1`（已 seed 的教师 slug），期望 200，页面包含教师姓名

- [ ] **步骤 2：运行测试验证失败**
  ```bash
  cd frontend-next && npx playwright test e2e/teacher-detail.spec.ts
  ```
  预期：FAIL（404）

- [ ] **步骤 3：lib/api.ts 添加 getTeacherBySlug**
  ```typescript
  export async function getTeacherBySlug(slug: string) {
    const res = await fetch(`${getApiBaseUrl({ isServer: true })}/api/teachers?filters[slug][$eq]=${slug}&populate=avatar,campus`);
    if (!res.ok) throw new Error('Teacher not found');
    const json = await res.json();
    return json.data[0];
  }
  ```

- [ ] **步骤 4：创建 app/teachers/[slug]/page.tsx**
  - Server Component，调用 `getTeacherBySlug`
  - 渲染：面包屑 + Hero（大头像+姓名+职称）+ 教育背景 + 教学特色 + 荣誉成就 + 所属校区链接 + CTA
  - 设置 `dynamicParams = false`、`revalidate = 300`

- [ ] **步骤 5：运行测试验证通过**
  ```bash
  cd frontend-next && npx playwright test e2e/teacher-detail.spec.ts
  ```
  预期：PASS

- [ ] **步骤 6：Commit**
  ```bash
  git add frontend-next/app/teachers/[slug]/ frontend-next/lib/api.ts frontend-next/e2e/teacher-detail.spec.ts
  git commit -m "feat(frontend-next): 新增教师详情页 /teachers/[slug]"
  ```

### 任务 1.4：P0-4 预约流程补全（schema + ContactForm + 独立预约页）

**文件：**
- 修改：`backend/src/api/appointment/content-types/appointment/schema.json`
- 修改：`frontend-next/components/sections/ContactForm.tsx`
- 创建：`frontend-next/app/appointment/page.tsx`

- [ ] **步骤 1：修改 appointment schema**
  - 添加字段：`childName`（Text, required）、`parentName`（Text, required）、`preferredDate`（Date）、`assignedTo`（Relation）、`notes`（Textarea）、`sourcePage`（Text）
  - 旧 `name` 字段：保留为 `parentName`（数据迁移时复制）

- [ ] **步骤 2：写 ContactForm 单元测试（Red）**
  - 测试：渲染表单，断言有 `childName` + `parentName` + `preferredDate` 三个字段
  - 测试：提交表单，断言 POST body 包含这三个字段

- [ ] **步骤 3：运行测试验证失败**

- [ ] **步骤 4：修改 ContactForm.tsx**
  - 拆分 `name` 为 `childName` + `parentName`
  - 添加 `preferredDate` 日期选择
  - 更新提交逻辑

- [ ] **步骤 5：创建 app/appointment/page.tsx**
  - 独立预约页，复用 ContactForm section
  - SSR 渲染

- [ ] **步骤 6：写 E2E 测试**
  - 访问 `/appointment`，填写表单，提交，验证跳转 `/appointment-success`
  - 验证 Strapi 后端收到完整数据

- [ ] **步骤 7：运行所有测试验证通过**

- [ ] **步骤 8：Commit**
  ```bash
  git add backend/src/api/appointment/ frontend-next/components/sections/ContactForm.tsx \
          frontend-next/app/appointment/ frontend-next/components/sections/__tests__/ContactForm.test.tsx \
          frontend-next/e2e/appointment.spec.ts
  git commit -m "feat: 预约流程补全 - childName/parentName/preferredDate 字段 + 独立预约页"
  ```

### 任务 1.5：P0-5 FAQ 分类筛选 + 反馈 UI

**文件：**
- 修改：`frontend-next/components/sections/Faq.tsx`
- 创建：`frontend-next/components/sections/CategoryFilter.tsx`（可选独立组件）

- [ ] **步骤 1：写单元测试（Red）**
  - 测试 CategoryFilter 渲染 4 个 pill（全部/课程咨询/服务相关/政策规定）
  - 测试点击 pill 后 filteredFaqs 只包含对应分类
  - 测试 FAQ 展开后显示反馈按钮
  - 测试点击"有用"调用 `submitFaqFeedback(id, { helpful: true })`

- [ ] **步骤 2：运行测试验证失败**

- [ ] **步骤 3：实现 CategoryFilter + 修改 Faq.tsx**
  - 顶部加 pill 组
  - 每条 FAQ 展开后加"有用 👍 / 没用 👎"按钮
  - 调用 `submitFaqFeedback`

- [ ] **步骤 4：运行测试验证通过**

- [ ] **步骤 5：写 E2E 测试**
  - 访问 `/faq`，点击"课程咨询"pill，验证只显示课程类 FAQ
  - 点击"有用"按钮，验证 API 调用

- [ ] **步骤 6：Commit**

### 任务 1.6：P0-6 CampusMap 组件

**文件：**
- 创建：`frontend-next/components/campus/CampusMap.tsx`
- 修改：`frontend-next/app/campuses/[slug]/page.tsx`

- [ ] **步骤 1：写单元测试（Red）**
  - 测试 `mapEmbed` 有值时渲染 iframe
  - 测试 `mapEmbed` 为空时渲染占位 UI

- [ ] **步骤 2：运行测试验证失败**

- [ ] **步骤 3：实现 CampusMap.tsx**
  ```typescript
  export default function CampusMap({ mapEmbed }: { mapEmbed?: string | null }) {
    if (!mapEmbed) {
      return <div className="...">暂无地图信息</div>;
    }
    return <div dangerouslySetInnerHTML={{ __html: mapEmbed }} />;
  }
  ```

- [ ] **步骤 4：插入到 campuses/[slug]/page.tsx**

- [ ] **步骤 5：运行测试验证通过**

- [ ] **步骤 6：Commit**

---

## Stage 2：P1 修复（TDD）

### 任务 2.1：P1-7 课程详情页 specValues 网格 + 价格独立区块

- [ ] 修改 `app/courses/[slug]/page.tsx`，在 CourseHeader 下方添加 specValues 网格区块和价格区块
- [ ] TDD：单元测试断言 specValues 网格渲染所有规格
- [ ] Commit

### 任务 2.2：P1-8 联系页补信息卡片 + 校区电话列表

- [ ] 修改 `app/contact/page.tsx`，添加联系信息卡片（客服热线/邮箱/微信/服务时间）和各校区电话列表
- [ ] 数据从 site-settings + campuses 获取
- [ ] Commit

### 任务 2.3：P1-9/10 Hero 按钮 + CourseCTA 锚点修正

- [ ] 修改 `Hero.tsx`：立即预约试听→`/contact`、了解课程体系→`/courses`（用 Next.js Link）
- [ ] 修改 `CourseCTA.tsx`：锚点 `#appointment` 改为 `/contact`
- [ ] TDD：E2E 测试点击 Hero 按钮跳转
- [ ] Commit

### 任务 2.4：P1-11 TeamHeader 统计数据 8→6

- [ ] 修改 `TeamHeader.tsx`："8 校区覆盖"→"6 校区覆盖"
- [ ] TDD：单元测试断言文本
- [ ] Commit

### 任务 2.5：P1-12 加载 Nunito 字体

- [ ] 修改 `app/layout.tsx`：next/font 加载 Nunito + Noto Sans SC
- [ ] Commit

### 任务 2.6：P1-13 统一页面顶部 padding

- [ ] 修改 `app/page.tsx`、`app/news/page.tsx`、`app/faq/page.tsx`、`app/contact/page.tsx` 等：`pt-[72px]` → `pt-[120px]`
- [ ] Commit

### 任务 2.7：P1-14 Hero Unsplash 图片换 Strapi 媒体

- [ ] 在 seed-yousen.js 中给 hero section 添加 Strapi 媒体字段
- [ ] 重新 seed
- [ ] 修改 Hero.tsx 使用 Strapi 图片
- [ ] Commit

---

## Stage 3：P2 修复（TDD，除 AI 客服部分）

### 任务 3.1：P2-16 新闻列表分页

- [ ] 修改 `app/news/page.tsx` 添加 Pagination 组件
- [ ] TDD：E2E 测试分页交互
- [ ] Commit

### 任务 3.2：P2-17 ContactForm 字段动态从 Strapi 加载

- [ ] 在 Strapi 创建 contact-form component schema（fields 配置）
- [ ] 修改 ContactForm.tsx 从 Strapi 加载字段配置
- [ ] Commit

### 任务 3.3：P2-18 404 页面主色调改回橙色渐变

- [ ] 修改 `app/not-found.tsx`：使用 `linear-gradient(135deg, #F5851F, #FF6B35)`
- [ ] Commit

### 任务 3.4：P2-19 Footer quickLinks 补"用户协议"

- [ ] 修改 `Footer.tsx` + seed-yousen.js
- [ ] Commit

### 任务 3.5：P2-21 阴影值精确对齐 spec

- [ ] 修改 `tailwind.config.ts` 或全局 CSS
- [ ] Commit

---

## Stage 4：路由大检查 + 入口规划

### 任务 4.1：写路由爬取脚本

- [ ] 新建 `frontend-next/e2e/route-audit.spec.ts`
- [ ] Playwright 爬取首页和所有已知页面，收集所有 `<a href>`
- [ ] 对比 `app/**/page.tsx` 路由清单
- [ ] 输出"路由 vs 入口"对比表到 `docs/superpowers/reports/2026-07-13-route-audit.md`

### 任务 4.2：更新 navigation 数据添加二级菜单

- [ ] 修改 `backend/scripts/seed-yousen.js` 的 navigation 数据
- [ ] 按设计规格 §8 的标准企业官网导航结构添加 children
- [ ] 重新 seed navigation（`--force --only=navigation`）

### 任务 4.3：E2E 验证所有导航链接可达

- [ ] 运行 `npx playwright test e2e/route-audit.spec.ts`
- [ ] 验证所有二级菜单 dropdown 能展开
- [ ] Commit

---

## Stage 5：页面内容补充

### 任务 5.1：关于我们页内容补充

- [ ] 修改 `seed-yousen.js` 添加 about 页面 sections 数据：
  - section.rich-text（学校介绍）— 文案起草
  - section.rich-text（办学理念）— 文案起草
  - section.features（资质荣誉，3 个卡片）
  - section.advantages（统计数据：8 年 / 3000+ / 6 校区 / 50+）
- [ ] 重新 seed（`--force --only=pages`）
- [ ] 视觉验证 `/about` 页面
- [ ] Commit

### 任务 5.2：联系页内容补充

- [ ] 修改 `seed-yousen.js` 更新 contact 页面 sections：
  - section.rich-text（联系信息卡片）— 客服热线/邮箱/微信/服务时间
  - section.rich-text（各校区电话列表）— 从 campuses 数据动态生成
- [ ] 重新 seed
- [ ] 视觉验证 `/contact`
- [ ] Commit

---

## Stage 6：全面视觉测试 + E2E 测试

### 任务 6.1：Playwright 视觉测试脚本

- [ ] 新建 `frontend-next/e2e/visual-comprehensive.spec.ts`
- [ ] 桌面端（1280x720）访问所有页面，截图保存到 `e2e/screenshots/desktop/`
- [ ] 移动端（375x667）访问所有页面，截图保存到 `e2e/screenshots/mobile/`
- [ ] 关键交互截图：FAQ 展开、教师手风琴、校区图集切换、导航 dropdown

### 任务 6.2：Strapi Admin UI 自动化录入脚本

- [ ] 新建 `frontend-next/e2e/strapi-admin-seed.spec.ts`
- [ ] 登录 Strapi Admin（`http://localhost:1337/admin`）
- [ ] 创建 1 条测试预约（通过 Admin UI 表单）
- [ ] 创建 1 条测试 FAQ（category=policy）
- [ ] 创建 1 条测试新闻
- [ ] 验证前端能读取到这些数据
- [ ] 如果 Admin UI 自动化太复杂，降级为通过 REST API 创建（仍走真实后端）

### 任务 6.3：运行完整测试套件

- [ ] `cd frontend-next && npm test`（Vitest）
- [ ] `cd frontend-next && npx playwright test`（Playwright E2E）
- [ ] `cd frontend-next && npm run build`（生产构建）
- [ ] 记录测试结果到决策报告

---

## Stage 7：AI 客服系统完整实现（TDD）

### 任务 7.1：基础设施 - Redis + pgvector

- [ ] 修改根目录 `docker-compose.yml`：
  - 添加 Redis 服务
  - PostgreSQL 镜像改为 `pgvector/pgvector:pg16`
- [ ] 添加 `.env.example`：`DASHSCOPE_API_KEY`、`REDIS_HOST`、`REDIS_PORT` 等
- [ ] 验证 `docker compose up -d` 启动 Redis + PostgreSQL(pgvector)
- [ ] 在 PostgreSQL 创建 pgvector 扩展：`CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] 创建知识库向量表 schema
- [ ] Commit

### 任务 7.2：后端 schema - chat-session + chat-message + ai-config + vector-config

- [ ] 创建 `backend/src/api/chat-session/content-types/chat-session/schema.json`
- [ ] 创建 `backend/src/api/chat-message/content-types/chat-message/schema.json`
- [ ] 创建 `backend/src/api/ai-config/content-types/ai-config/schema.json`
- [ ] 创建 `backend/src/api/vector-config/content-types/vector-config/schema.json`
- [ ] 创建对应的 controllers/routes/services
- [ ] 补全 knowledge-base schema（file/sourceUrl/category/uploadedBy）
- [ ] 补全 faq-item schema（sourceType/sourceSession/reviewStatus/vectorSynced）
- [ ] TDD：单元测试 schema CRUD
- [ ] Commit

### 任务 7.3：后端服务 - LLM 服务

- [ ] 创建 `backend/src/services/llm-service.ts`
- [ ] 实现 `generateEmbedding(text)`：调用通义千问 text-embedding-v2 API
- [ ] 实现 `chat(messages, systemPrompt)`：调用通义千问 qwen-plus API
- [ ] 实现 `detectIntent(message)`：转人工意图检测（关键词 + LLM）
- [ ] TDD：单元测试（mock fetch）
- [ ] Commit

### 任务 7.4：后端服务 - RAG 服务

- [ ] 创建 `backend/src/services/rag-service.ts`
- [ ] 实现 `retrieve(query, topK=5)`：pgvector 相似度搜索
- [ ] 实现 `generateAnswer(query, retrievedDocs, history)`：调用 LLM 生成回答
- [ ] 实现 `feedbackToFaq(question, answer)`：写入 faq-item pending
- [ ] TDD：单元测试（mock LLM + 测试数据库）
- [ ] Commit

### 任务 7.5：后端服务 - 文档处理队列

- [ ] 创建 `backend/src/queues/document-processor.ts`
- [ ] BullMQ Worker：文本提取 → 清洗 → 分块（500 字符 + 50 重叠）→ Embedding → 写入 pgvector
- [ ] 修改 knowledge-base controller：上传文档时入队
- [ ] TDD：单元测试 pipeline（mock LLM）
- [ ] Commit

### 任务 7.6：后端 API 路由

- [ ] `POST /api/chat/start` - 创建会话
- [ ] `POST /api/chat/message` - 发送消息（SSE 流式返回）
- [ ] `POST /api/chat/transfer` - 转人工
- [ ] `GET /api/chat/history/:sessionId` - 获取历史
- [ ] TDD：API 集成测试
- [ ] Commit

### 任务 7.7：前端 - FloatingChat 组件

- [ ] 创建 `frontend-next/components/chat/FloatingChat.tsx`（Client Component）
- [ ] 创建 `frontend-next/components/chat/ChatMessage.tsx`
- [ ] 创建 `frontend-next/components/chat/ChatInput.tsx`
- [ ] 集成到 `app/layout.tsx`
- [ ] TDD：单元测试 + E2E 测试
- [ ] Commit

### 任务 7.8：前端 - Next.js API Route（SSE 代理）

- [ ] 创建 `frontend-next/app/api/chat/route.ts`
- [ ] 代理到后端 `/api/chat/message`
- [ ] SSE 流式返回
- [ ] TDD：集成测试
- [ ] Commit

### 任务 7.9：AI 客服 E2E 测试

- [ ] 写 E2E 测试：打开聊天窗口 → 发送消息 → 验证收到回答
- [ ] 测试转人工流程
- [ ] 测试知识库上传 → 向量化 → 检索
- [ ] Commit

---

## Stage 8：最终验证 + 决策报告

### 任务 8.1：运行完整测试套件

- [ ] `cd frontend-next && npm test`
- [ ] `cd frontend-next && npx playwright test`
- [ ] `cd frontend-next && npm run build`
- [ ] `cd backend && npm run build`
- [ ] `docker compose up --build` 完整栈启动
- [ ] 浏览器访问所有页面验证

### 任务 8.2：生成决策报告

- [ ] 创建 `docs/superpowers/reports/2026-07-13-overnight-execution.md`
- [ ] 包含：已完成项、跳过项、自主决策清单、待审查项、已知问题、测试结果
- [ ] Commit

### 任务 8.3：更新 project_memory

- [ ] 更新 `/home/tishensnoopy/.trae-cn/memory/projects/-home-tishensnoopy-project-superpowers-zh/project_memory.md`
- [ ] 记录本次通宵执行的关键决策和学到的教训

---

## 自检

### 1. 规格覆盖度
- ✅ Stage 0：分类提交（规格 §4）
- ✅ Stage 1：P0 修复 6 项（规格 §5）
- ✅ Stage 2：P1 修复 9 项（规格 §6）
- ✅ Stage 3：P2 修复 5 项（规格 §7，跳过子项目 5/6 范围）
- ✅ Stage 4：路由大检查（规格 §8）
- ✅ Stage 5：页面内容补充（规格 §9）
- ✅ Stage 6：全面测试（规格 §10）
- ✅ Stage 7：AI 客服系统（规格 §11）
- ✅ Stage 8：最终验证 + 报告（规格 §12）

### 2. 占位符扫描
- 无 TODO/待定
- 文案部分明确标注"起草"，会在执行时生成具体文案

### 3. 类型一致性
- `getTeacherBySlug` 在任务 1.3 定义，后续无引用冲突
- `childName`/`parentName`/`preferredDate` 在任务 1.4 定义，后续无冲突
- AI 客服 schema 字段在任务 7.2 定义，7.3-7.6 引用一致

---

## 执行交接

**计划已完成并保存到 `docs/superpowers/plans/2026-07-13-overnight-comprehensive-execution.md`。**

由于用户已预先批准并离开电脑旁，我直接开始执行，采用**内联执行**模式（用户不在无法做子代理间审查）。

**执行方式：** 内联执行 + 每 Stage 完成后 commit + 关键节点运行测试验证
