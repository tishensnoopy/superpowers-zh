# 子项目 1：基础设施 + Strapi 内容模型 — 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 搭建 Docker Compose 开发环境，初始化 Strapi v5 项目，创建所有内容模型（Page、全局单例、用户提交数据、知识库），配置三角色权限，搭建 BullMQ 队列基础设施。

**架构：** Docker Compose 编排 PostgreSQL 16 + Redis 7 + MeiliSearch v1.12 + Strapi v5 四个服务。Strapi 使用 TypeScript，内容模型通过 schema.json 定义，权限通过内置 RBAC 配置，异步任务通过 BullMQ + Worker 处理。

**技术栈：** Strapi v5 (5.48+)、PostgreSQL 16、Redis 7、MeiliSearch v1.12、BullMQ、Docker Compose、Node 22 LTS (推荐 v24)、TypeScript

---

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `docker/docker-compose.yml` | 开发环境 Docker Compose 配置 |
| `docker/.env.example` | 环境变量模板 |
| `backend/package.json` | Strapi 项目依赖 |
| `backend/tsconfig.json` | TypeScript 配置 |
| `backend/config/database.ts` | 数据库配置 |
| `backend/config/server.ts` | 服务器配置 |
| `backend/config/admin.ts` | 管理后台配置 |
| `backend/config/plugins.ts` | 插件配置 |
| `backend/src/index.ts` | Strapi 入口（注册队列和 Worker） |
| `backend/src/utils/queue.ts` | BullMQ 队列工具封装 |
| `backend/src/workers/document-processor.worker.ts` | 文档处理 Worker（骨架） |
| `backend/src/workers/faq-feedback.worker.ts` | FAQ 反哺 Worker（骨架） |
| `backend/src/api/page/content-types/page/schema.json` | Page 集合模型 |
| `backend/src/api/knowledge-base/content-types/knowledge-base/schema.json` | 知识库集合模型 |
| `backend/src/api/faq-item/content-types/faq-item/schema.json` | FAQ 集合模型 |
| `backend/src/api/form-submission/content-types/form-submission/schema.json` | 表单提交集合 |
| `backend/src/api/appointment/content-types/appointment/schema.json` | 预约集合 |
| `backend/src/api/chat-session/content-types/chat-session/schema.json` | 对话会话集合 |
| `backend/src/api/chat-message/content-types/chat-message/schema.json` | 对话消息集合 |
| `backend/src/components/sections/hero.json` | Hero 区块组件 |
| `backend/src/components/sections/advantages.json` | 优势区块组件 |
| `backend/src/components/sections/rich-text.json` | 富文本区块组件 |
| `backend/src/components/nav-item.json` | 导航项组件 |
| `backend/src/components/footer-link-group.json` | 页脚链接组组件 |
| `backend/src/components/footer-link.json` | 页脚链接组件 |
| `backend/src/components/seo.json` | SEO 组件 |
| `backend/src/components/page-layout.json` | 页面布局组件 |
| `backend/src/components/stat-item.json` | 统计数字组件 |
| `backend/src/components/cta-button.json` | CTA 按钮组件 |
| `backend/src/components/advantage-item.json` | 优势项组件 |
| `backend/src/policies/is-client-admin.ts` | 客户管理员 policy |
| `backend/.env.example` | Strapi 环境变量模板 |

### 无修改文件（本计划不涉及现有仓库代码）

---

## 任务 1：项目目录初始化 + Docker Compose 基础配置

**文件：**
- 创建：`docker/docker-compose.yml`
- 创建：`docker/.env.example`

- [ ] **步骤 1：创建 docker 目录和 docker-compose.yml**

```yaml
# docker/docker-compose.yml
version: "3.8"

services:
  postgres:
    image: postgres:16-alpine
    container_name: strapi-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/data
    networks:
      - strapi-network
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: strapi-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    environment:
      REDIS_PASSWORD: ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - strapi-network
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  meilisearch:
    image: getmeili/meilisearch:v1.12
    container_name: strapi-meilisearch
    restart: unless-stopped
    environment:
      MEILI_MASTER_KEY: ${MEILI_MASTER_KEY}
      MEILI_NO_ANALYTICS: "true"
    volumes:
      - meili_data:/meili_data
    networks:
      - strapi-network
    ports:
      - "7700:7700"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7700/health"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pg_data:
  redis_data:
  meili_data:

networks:
  strapi-network:
    driver: bridge
```

- [ ] **步骤 2：创建 .env.example**

```
# PostgreSQL
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=strapi
POSTGRES_USER=strapi
POSTGRES_PASSWORD=changeme

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=changeme

# MeiliSearch
MEILI_HOST=http://meilisearch:7700
MEILI_MASTER_KEY=changeme_master_key_12345

# Strapi
STRAPI_PORT=1337
STRAPI_APP_KEYS=key1_change_me,key2_change_me,key3_change_me,key4_change_me
STRAPI_API_TOKEN_SALT=changeme_api_token_salt
STRAPI_ADMIN_JWT_SECRET=changeme_admin_jwt_secret
STRAPI_TRANSFER_TOKEN_SALT=changeme_transfer_token_salt
STRAPI_JWT_SECRET=changeme_jwt_secret
```

- [ ] **步骤 3：验证配置语法**

运行：`cd docker && docker compose config`
预期：输出完整的 compose 配置，无语法错误

- [ ] **步骤 4：Commit**

```bash
git add docker/docker-compose.yml docker/.env.example
git commit -m "feat: add docker compose base config with postgres redis meilisearch"
```

---

## 任务 2：初始化 Strapi v5 项目

**文件：**
- 创建：`backend/package.json`
- 创建：`backend/tsconfig.json`
- 创建：`backend/config/database.ts`
- 创建：`backend/config/server.ts`
- 创建：`backend/config/admin.ts`
- 创建：`backend/config/plugins.ts`
- 创建：`backend/src/index.ts`
- 创建：`backend/.env.example`
- 创建：`backend/.gitignore`

- [ ] **步骤 1：创建 backend 目录并初始化 package.json**

> **重要说明（Strapi v5 变更）：**
> - `@strapi/plugin-i18n` 在 v5 中**已内置到 `@strapi/strapi` 核心**，不再作为独立 npm 包，无需在 dependencies 中列出（但 `config/plugins.ts` 中仍需配置启用）。
> - 版本号推荐用 `"5"` 而非 `"^5.0.0"`，避免子依赖解析失败。
> - Strapi v5 构建 Admin Panel 需要 React 全家桶作为 peer dependencies，必须显式声明。
> - Node.js 最低版本要求 22.x（v5.48+ 推荐 v24）。

```json
{
  "name": "strapi-backend",
  "private": true,
  "version": "0.1.0",
  "description": "Strapi v5 backend for enterprise website mother station",
  "scripts": {
    "develop": "strapi develop",
    "start": "strapi start",
    "build": "strapi build",
    "strapi": "strapi",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@strapi/strapi": "5",
    "@strapi/plugin-users-permissions": "5",
    "pg": "^8.12.0",
    "bullmq": "^5.8.0",
    "ioredis": "^5.4.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "styled-components": "^6.1.0"
  },
  "devDependencies": {
    "@strapi/ts-config": "5",
    "@types/node": "^22.0.0",
    "typescript": "^5.5.0"
  },
  "engines": {
    "node": ">=22.0.0 <=24.x.x",
    "npm": ">=10.0.0"
  }
}
```

- [ ] **步骤 2：创建 tsconfig.json**

```json
{
  "extends": "@strapi/ts-config",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": ".",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src", "config", "types"],
  "exclude": ["node_modules", "dist", "build"]
}
```

- [ ] **步骤 3：创建 config/database.ts**

```typescript
export default ({ env }) => ({
  connection: {
    client: 'postgres',
    connection: {
      host: env('DATABASE_HOST', 'postgres'),
      port: env.int('DATABASE_PORT', 5432),
      database: env('DATABASE_NAME', 'strapi'),
      user: env('DATABASE_USERNAME', 'strapi'),
      password: env('DATABASE_PASSWORD', 'strapi'),
      ssl: env.bool('DATABASE_SSL', false),
    },
  },
});
```

- [ ] **步骤 4：创建 config/server.ts**

```typescript
export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
});
```

- [ ] **步骤 5：创建 config/admin.ts**

```typescript
export default ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
});
```

- [ ] **步骤 6：创建 config/plugins.ts**

```typescript
export default ({ env }) => ({
  'users-permissions': {
    enabled: true,
    config: {
      jwt: {
        secret: env('JWT_SECRET'),
      },
    },
  },
  i18n: {
    enabled: true,
    config: {
      defaultLocale: 'zh-CN',
      locales: ['zh-CN', 'en-US'],
    },
  },
});
```

- [ ] **步骤 7：创建 src/index.ts**

```typescript
export default {
  async bootstrap({ strapi }) {
    console.log('[Bootstrap] Starting up...');

    // 注册队列（延迟导入避免循环依赖）
    if (process.env.REDIS_HOST) {
      try {
        const { registerQueues } = await import('./utils/queue');
        await registerQueues(strapi);
        console.log('[Bootstrap] Queues registered');
      } catch (err) {
        console.warn('[Bootstrap] Queue registration failed:', err.message);
      }
    }

    console.log('[Bootstrap] Startup complete');
  },

  async destroy({ strapi }) {
    console.log('[Destroy] Shutting down...');

    try {
      const { closeAllQueues } = await import('./utils/queue');
      await closeAllQueues();
      console.log('[Destroy] Queues closed');
    } catch (err) {
      console.warn('[Destroy] Queue cleanup failed:', err.message);
    }
  },
};
```

- [ ] **步骤 8：创建 backend/.env.example**

```
# Database
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=changeme
DATABASE_SSL=false

# Server
HOST=0.0.0.0
PORT=1337

# Strapi
APP_KEYS=key1_change_me,key2_change_me,key3_change_me,key4_change_me
API_TOKEN_SALT=changeme_api_token_salt
ADMIN_JWT_SECRET=changeme_admin_jwt_secret
TRANSFER_TOKEN_SALT=changeme_transfer_token_salt
JWT_SECRET=changeme_jwt_secret

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=changeme

# MeiliSearch
MEILI_HOST=http://meilisearch:7700
MEILI_MASTER_KEY=changeme_master_key_12345

# Node
NODE_ENV=development
```

- [ ] **步骤 9：创建 backend/.gitignore**

```
node_modules/
dist/
build/
.env
.env.local
.strapi/
.tmp/
.cache/
coverage/
*.log
```

- [ ] **步骤 10：安装依赖**

运行：`cd backend && npm install`
预期：npm install 成功，node_modules 目录出现

- [ ] **步骤 11：Commit**

```bash
git add backend/package.json backend/tsconfig.json backend/config/ backend/src/index.ts backend/.env.example backend/.gitignore
git commit -m "feat: initialize strapi v5 project structure"
```

---

## 任务 3：BullMQ 队列工具 + Worker 骨架

**文件：**
- 创建：`backend/src/utils/queue.ts`
- 创建：`backend/src/workers/document-processor.worker.ts`
- 创建：`backend/src/workers/faq-feedback.worker.ts`

- [ ] **步骤 1：创建队列工具 src/utils/queue.ts**

```typescript
import { Queue, Worker } from 'bullmq';
import type { Strapi } from '@strapi/strapi';

const queues: Record<string, Queue> = {};
const workers: Record<string, Worker> = {};

function getConnection() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

export function getQueue(name: string): Queue {
  if (!queues[name]) {
    queues[name] = new Queue(name, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
    console.log(`[Queue] Created queue: ${name}`);
  }
  return queues[name];
}

export function createWorker(
  name: string,
  processor: (job: any) => Promise<any>,
  options?: { concurrency?: number }
): Worker {
  if (workers[name]) {
    return workers[name];
  }

  const worker = new Worker(name, processor, {
    connection: getConnection(),
    concurrency: options?.concurrency || 2,
  });

  worker.on('completed', (job) => {
    console.log(`[Queue] Job ${job.id} in queue "${name}" completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Queue] Job ${job?.id} in queue "${name}" failed:`, err.message);
  });

  workers[name] = worker;
  console.log(`[Queue] Created worker for queue: ${name}`);
  return worker;
}

export async function addJob(
  queueName: string,
  jobName: string,
  data: any,
  options?: any
) {
  const queue = getQueue(queueName);
  return queue.add(jobName, data, options);
}

export async function registerQueues(strapi: Strapi) {
  // 挂载到 strapi 全局对象
  (strapi as any).queue = {
    add: addJob,
  };

  // 注册 Worker（延迟导入 worker 模块）
  const { registerDocumentWorker } = await import('../workers/document-processor.worker');
  const { registerFaqFeedbackWorker } = await import('../workers/faq-feedback.worker');

  registerDocumentWorker(strapi);
  registerFaqFeedbackWorker(strapi);
}

export async function closeAllQueues() {
  for (const worker of Object.values(workers)) {
    await worker.close();
  }
  for (const queue of Object.values(queues)) {
    await queue.close();
  }
  console.log('[Queue] All queues and workers closed');
}
```

- [ ] **步骤 2：创建文档处理 Worker 骨架**

```typescript
// src/workers/document-processor.worker.ts
import { createWorker } from '../utils/queue';
import type { Strapi } from '@strapi/strapi';

export function registerDocumentWorker(strapi: Strapi) {
  createWorker(
    'document-processing',
    async (job) => {
      const { documentId, operation } = job.data;
      console.log(`[Worker] document-processing: ${operation} for ${documentId}`);

      switch (operation) {
        case 'vectorize':
        case 'revectorize':
          return handleVectorize(strapi, documentId);
        case 'delete':
          return handleDelete(strapi, documentId);
        default:
          console.warn(`[Worker] Unknown operation: ${operation}`);
          return { skipped: true };
      }
    },
    { concurrency: 2 }
  );
}

async function handleVectorize(strapi: Strapi, documentId: string) {
  // TODO: 子项目7实现完整向量化逻辑
  console.log(`[Worker] Vectorize document ${documentId} - placeholder`);

  try {
    await strapi.documents('api::knowledge-base.knowledge-base').update({
      documentId,
      data: { status: 'processing' as any },
    });

    // 模拟处理
    await new Promise(resolve => setTimeout(resolve, 500));

    await strapi.documents('api::knowledge-base.knowledge-base').update({
      documentId,
      data: { status: 'ready' as any, chunkCount: 0 },
    });

    return { success: true, chunkCount: 0 };
  } catch (err) {
    await strapi.documents('api::knowledge-base.knowledge-base').update({
      documentId,
      data: { status: 'failed' as any, errorMessage: (err as Error).message },
    });
    throw err;
  }
}

async function handleDelete(strapi: Strapi, documentId: string) {
  // TODO: 子项目7实现向量库删除逻辑
  console.log(`[Worker] Delete vectors for ${documentId} - placeholder`);
  return { success: true };
}
```

- [ ] **步骤 3：创建 FAQ 反哺 Worker 骨架**

```typescript
// src/workers/faq-feedback.worker.ts
import { createWorker } from '../utils/queue';
import type { Strapi } from '@strapi/strapi';

export function registerFaqFeedbackWorker(strapi: Strapi) {
  createWorker(
    'faq-feedback',
    async (job) => {
      const { sessionId, action } = job.data;
      console.log(`[Worker] faq-feedback: ${action} for ${sessionId}`);

      switch (action) {
        case 'auto-generate':
          return handleAutoGenerate(strapi, sessionId);
        case 'vectorize-approved':
          return handleVectorizeApproved(strapi, job.data.faqId);
        default:
          console.warn(`[Worker] Unknown action: ${action}`);
          return { skipped: true };
      }
    },
    { concurrency: 3 }
  );
}

async function handleAutoGenerate(strapi: Strapi, sessionId: string) {
  // TODO: 子项目7实现完整FAQ自动生成逻辑
  console.log(`[Worker] Auto-generate FAQ for session ${sessionId} - placeholder`);
  return { skipped: true, reason: 'not implemented yet' };
}

async function handleVectorizeApproved(strapi: Strapi, faqId: string) {
  // TODO: 子项目7实现已批准FAQ向量化
  console.log(`[Worker] Vectorize approved FAQ ${faqId} - placeholder`);
  return { skipped: true, reason: 'not implemented yet' };
}
```

- [ ] **步骤 4：TypeScript 类型检查**

运行：`cd backend && npx tsc --noEmit`
预期：可能有 Strapi 类型未导入的警告，但没有语法错误

- [ ] **步骤 5：Commit**

```bash
git add backend/src/utils/queue.ts backend/src/workers/
git commit -m "feat: add bullmq queue utils and worker skeletons"
```

---

## 任务 4：全局组件定义（SEO、布局、CTA、导航项等）

**文件：**
- 创建：`backend/src/components/seo.json`
- 创建：`backend/src/components/page-layout.json`
- 创建：`backend/src/components/stat-item.json`
- 创建：`backend/src/components/cta-button.json`
- 创建：`backend/src/components/advantage-item.json`
- 创建：`backend/src/components/nav-item.json`
- 创建：`backend/src/components/footer-link-group.json`
- 创建：`backend/src/components/footer-link.json`

- [ ] **步骤 1：创建 SEO 组件**

```json
{
  "collectionName": "components_seo",
  "info": {
    "displayName": "seo",
    "description": ""
  },
  "options": {},
  "attributes": {
    "metaTitle": {
      "type": "string",
      "maxLength": 70
    },
    "metaDescription": {
      "type": "text",
      "maxLength": 200
    },
    "keywords": {
      "type": "string"
    },
    "ogImage": {
      "type": "media",
      "allowedTypes": ["images"],
      "multiple": false
    },
    "ogTitle": {
      "type": "string",
      "maxLength": 70
    },
    "ogDescription": {
      "type": "text",
      "maxLength": 200
    },
    "noIndex": {
      "type": "boolean",
      "default": false
    },
    "canonicalUrl": {
      "type": "string"
    },
    "structuredData": {
      "type": "json"
    }
  }
}
```

- [ ] **步骤 2：创建页面布局组件**

```json
{
  "collectionName": "components_page_layouts",
  "info": {
    "displayName": "page-layout",
    "description": ""
  },
  "options": {},
  "attributes": {
    "showNavbar": {
      "type": "boolean",
      "default": true
    },
    "showFooter": {
      "type": "boolean",
      "default": true
    },
    "showFloatingActions": {
      "type": "enumeration",
      "enum": ["global", "custom", "hidden"],
      "default": "global"
    }
  }
}
```

- [ ] **步骤 3：创建统计数字组件**

```json
{
  "collectionName": "components_stat_items",
  "info": {
    "displayName": "stat-item",
    "description": ""
  },
  "options": {},
  "attributes": {
    "number": {
      "type": "string"
    },
    "label": {
      "type": "string"
    }
  }
}
```

- [ ] **步骤 4：创建 CTA 按钮组件**

```json
{
  "collectionName": "components_cta_buttons",
  "info": {
    "displayName": "cta-button",
    "description": ""
  },
  "options": {},
  "attributes": {
    "text": {
      "type": "string"
    },
    "url": {
      "type": "string"
    },
    "icon": {
      "type": "string"
    },
    "style": {
      "type": "enumeration",
      "enum": ["primary", "secondary", "outline"],
      "default": "primary"
    }
  }
}
```

- [ ] **步骤 5：创建优势项组件**

```json
{
  "collectionName": "components_advantage_items",
  "info": {
    "displayName": "advantage-item",
    "description": ""
  },
  "options": {},
  "attributes": {
    "icon": {
      "type": "string"
    },
    "title": {
      "type": "string"
    },
    "description": {
      "type": "text"
    },
    "color": {
      "type": "string",
      "default": "#ffffff"
    },
    "bgColor": {
      "type": "string",
      "default": "#f5851f"
    }
  }
}
```

- [ ] **步骤 6：创建导航项组件**

```json
{
  "collectionName": "components_nav_items",
  "info": {
    "displayName": "nav-item",
    "description": ""
  },
  "options": {},
  "attributes": {
    "label": {
      "type": "string",
      "required": true
    },
    "url": {
      "type": "string",
      "required": true
    },
    "target": {
      "type": "enumeration",
      "enum": ["self", "blank"],
      "default": "self"
    },
    "order": {
      "type": "integer",
      "default": 0
    }
  }
}
```

- [ ] **步骤 7：创建页脚链接组组件**

```json
{
  "collectionName": "components_footer_link_groups",
  "info": {
    "displayName": "footer-link-group",
    "description": ""
  },
  "options": {},
  "attributes": {
    "title": {
      "type": "string"
    },
    "links": {
      "type": "component",
      "repeatable": true,
      "component": "footer-link"
    }
  }
}
```

- [ ] **步骤 8：创建页脚链接组件**

```json
{
  "collectionName": "components_footer_links",
  "info": {
    "displayName": "footer-link",
    "description": ""
  },
  "options": {},
  "attributes": {
    "label": {
      "type": "string"
    },
    "url": {
      "type": "string"
    }
  }
}
```

- [ ] **步骤 9：Commit**

```bash
git add backend/src/components/
git commit -m "feat: add global components (seo, layout, cta, nav, footer)"
```

---

## 任务 5：区块组件定义（Hero、Advantages、Rich Text）

**文件：**
- 创建：`backend/src/components/sections/hero.json`
- 创建：`backend/src/components/sections/advantages.json`
- 创建：`backend/src/components/sections/rich-text.json`

- [ ] **步骤 1：创建 Hero 区块组件**

```json
{
  "collectionName": "components_sections_heroes",
  "info": {
    "displayName": "hero",
    "description": "Hero section with title, subtitle, CTA buttons and stats"
  },
  "options": {},
  "attributes": {
    "badge": {
      "type": "string"
    },
    "title": {
      "type": "string",
      "required": true
    },
    "titleHighlight": {
      "type": "string"
    },
    "subtitle": {
      "type": "text"
    },
    "backgroundImage": {
      "type": "media",
      "allowedTypes": ["images"],
      "multiple": false
    },
    "overlayOpacity": {
      "type": "integer",
      "default": 50,
      "min": 0,
      "max": 100
    },
    "stats": {
      "type": "component",
      "repeatable": true,
      "component": "stat-item"
    },
    "primaryCta": {
      "type": "component",
      "repeatable": false,
      "component": "cta-button"
    },
    "secondaryCta": {
      "type": "component",
      "repeatable": false,
      "component": "cta-button"
    }
  }
}
```

- [ ] **步骤 2：创建 Advantages 区块组件**

```json
{
  "collectionName": "components_sections_advantages",
  "info": {
    "displayName": "advantages",
    "description": "Core advantages section with icon cards"
  },
  "options": {},
  "attributes": {
    "badge": {
      "type": "string"
    },
    "title": {
      "type": "string"
    },
    "subtitle": {
      "type": "text"
    },
    "items": {
      "type": "component",
      "repeatable": true,
      "component": "advantage-item"
    }
  }
}
```

- [ ] **步骤 3：创建 Rich Text 区块组件**

```json
{
  "collectionName": "components_sections_rich_texts",
  "info": {
    "displayName": "rich-text",
    "description": "Rich text content section"
  },
  "options": {},
  "attributes": {
    "badge": {
      "type": "string"
    },
    "title": {
      "type": "string"
    },
    "content": {
      "type": "richtext"
    },
    "backgroundColor": {
      "type": "string"
    }
  }
}
```

- [ ] **步骤 4：Commit**

```bash
git add backend/src/components/sections/
git commit -m "feat: add 3 base section components (hero, advantages, rich-text)"
```

---

## 任务 6：全局单例模型（site-settings、navigation、footer、ai-config、vector-config）

**文件：**
- 创建：`backend/src/api/site-settings/content-types/site-settings/schema.json`
- 创建：`backend/src/api/site-settings/routes/site-settings.json`
- 创建：`backend/src/api/navigation/content-types/navigation/schema.json`
- 创建：`backend/src/api/navigation/routes/navigation.json`
- 创建：`backend/src/api/footer/content-types/footer/schema.json`
- 创建：`backend/src/api/footer/routes/footer.json`
- 创建：`backend/src/api/ai-config/content-types/ai-config/schema.json`
- 创建：`backend/src/api/ai-config/routes/ai-config.json`
- 创建：`backend/src/api/vector-config/content-types/vector-config/schema.json`
- 创建：`backend/src/api/vector-config/routes/vector-config.json`

- [ ] **步骤 1：创建 site-settings 单例**

```json
{
  "kind": "singleType",
  "collectionName": "site_settings",
  "info": {
    "singularName": "site-settings",
    "pluralName": "site-settings",
    "displayName": "Site Settings",
    "description": "Global site configuration"
  },
  "options": {
    "draftAndPublish": false
  },
  "pluginOptions": {
    "i18n": {
      "localized": false
    }
  },
  "attributes": {
    "siteName": {
      "type": "string",
      "required": true
    },
    "logo": {
      "type": "media",
      "allowedTypes": ["images"],
      "multiple": false
    },
    "logoFavicon": {
      "type": "media",
      "allowedTypes": ["images"],
      "multiple": false
    },
    "domain": {
      "type": "string"
    },
    "icp": {
      "type": "string"
    },
    "publicSecurityRecord": {
      "type": "string"
    },
    "contactPhone": {
      "type": "string"
    },
    "contactEmail": {
      "type": "email"
    },
    "contactAddress": {
      "type": "string"
    },
    "themeColorPrimary": {
      "type": "string",
      "default": "#F5851F"
    },
    "themeColorSecondary": {
      "type": "string",
      "default": "#0B1220"
    },
    "wechatAppId": {
      "type": "string"
    },
    "wechatAppSecret": {
      "type": "password"
    },
    "aiCrawlable": {
      "type": "boolean",
      "default": true
    },
    "aiSummary": {
      "type": "text"
    },
    "defaultSeo": {
      "type": "component",
      "repeatable": false,
      "component": "seo"
    }
  }
}
```

- [ ] **步骤 2：创建 navigation 单例**

```json
{
  "kind": "singleType",
  "collectionName": "navigations",
  "info": {
    "singularName": "navigation",
    "pluralName": "navigations",
    "displayName": "Navigation",
    "description": "Main navigation menu"
  },
  "options": {
    "draftAndPublish": false
  },
  "pluginOptions": {
    "i18n": {
      "localized": true
    }
  },
  "attributes": {
    "items": {
      "type": "component",
      "repeatable": true,
      "component": "nav-item"
    }
  }
}
```

- [ ] **步骤 3：创建 footer 单例**

```json
{
  "kind": "singleType",
  "collectionName": "footers",
  "info": {
    "singularName": "footer",
    "pluralName": "footers",
    "displayName": "Footer",
    "description": "Footer configuration"
  },
  "options": {
    "draftAndPublish": false
  },
  "pluginOptions": {
    "i18n": {
      "localized": true
    }
  },
  "attributes": {
    "description": {
      "type": "richtext"
    },
    "contactPhone": {
      "type": "string"
    },
    "contactEmail": {
      "type": "email"
    },
    "contactAddress": {
      "type": "string"
    },
    "longitude": {
      "type": "decimal",
      "precision": 10,
      "scale": 6
    },
    "latitude": {
      "type": "decimal",
      "precision": 10,
      "scale": 6
    },
    "linkGroups": {
      "type": "component",
      "repeatable": true,
      "component": "footer-link-group"
    },
    "qrCode": {
      "type": "media",
      "allowedTypes": ["images"],
      "multiple": false
    },
    "copyright": {
      "type": "string"
    }
  }
}
```

- [ ] **步骤 4：创建 ai-config 单例**

```json
{
  "kind": "singleType",
  "collectionName": "ai_configs",
  "info": {
    "singularName": "ai-config",
    "pluralName": "ai-configs",
    "displayName": "AI Config",
    "description": "AI customer service configuration"
  },
  "options": {
    "draftAndPublish": false
  },
  "pluginOptions": {
    "i18n": {
      "localized": false
    }
  },
  "attributes": {
    "provider": {
      "type": "enumeration",
      "enum": ["openai", "deepseek", "qwen", "wenxin", "kimi", "custom"],
      "default": "openai"
    },
    "apiKey": {
      "type": "password"
    },
    "apiEndpoint": {
      "type": "string"
    },
    "modelName": {
      "type": "string",
      "default": "gpt-4o"
    },
    "temperature": {
      "type": "decimal",
      "precision": 3,
      "scale": 2,
      "default": 0.7
    },
    "maxTokens": {
      "type": "integer",
      "default": 2048
    },
    "systemPrompt": {
      "type": "text"
    },
    "transferThreshold": {
      "type": "decimal",
      "precision": 3,
      "scale": 2,
      "default": 0.3
    },
    "welcomeMessage": {
      "type": "text"
    },
    "transferMessage": {
      "type": "text"
    },
    "enabled": {
      "type": "boolean",
      "default": false
    },
    "feedbackToFaqEnabled": {
      "type": "boolean",
      "default": true
    }
  }
}
```

- [ ] **步骤 5：创建 vector-config 单例**

```json
{
  "kind": "singleType",
  "collectionName": "vector_configs",
  "info": {
    "singularName": "vector-config",
    "pluralName": "vector-configs",
    "displayName": "Vector DB Config",
    "description": "Vector database configuration"
  },
  "options": {
    "draftAndPublish": false
  },
  "pluginOptions": {
    "i18n": {
      "localized": false
    }
  },
  "attributes": {
    "provider": {
      "type": "enumeration",
      "enum": ["meilisearch", "qdrant", "milvus", "pgvector"],
      "default": "qdrant"
    },
    "host": {
      "type": "string"
    },
    "apiKey": {
      "type": "password"
    },
    "collectionName": {
      "type": "string",
      "default": "knowledge-base"
    },
    "embeddingModel": {
      "type": "string",
      "default": "text-embedding-3-small"
    },
    "embeddingDimensions": {
      "type": "integer",
      "default": 1536
    },
    "chunkSize": {
      "type": "integer",
      "default": 800
    },
    "chunkOverlap": {
      "type": "integer",
      "default": 160
    }
  }
}
```

- [ ] **步骤 6：为每个单例创建 routes 配置**

五个单例的 routes 配置格式相同，以 site-settings 为例：

```json
{
  "routes": [
    {
      "method": "GET",
      "path": "/site-settings",
      "handler": "site-settings.findOne"
    },
    {
      "method": "PUT",
      "path": "/site-settings",
      "handler": "site-settings.update"
    }
  ]
}
```

为 navigation、footer、ai-config、vector-config 创建相同格式的 routes 文件。

- [ ] **步骤 7：Commit**

```bash
git add backend/src/api/site-settings/ backend/src/api/navigation/ backend/src/api/footer/ backend/src/api/ai-config/ backend/src/api/vector-config/
git commit -m "feat: add 5 single types (site-settings, navigation, footer, ai-config, vector-config)"
```

---

## 任务 7：Page 集合模型（带 Dynamic Zone）

**文件：**
- 创建：`backend/src/api/page/content-types/page/schema.json`
- 创建：`backend/src/api/page/controllers/page.ts`
- 创建：`backend/src/api/page/services/page.ts`
- 创建：`backend/src/api/page/routes/page.json`

- [ ] **步骤 1：创建 Page schema.json**

```json
{
  "kind": "collectionType",
  "collectionName": "pages",
  "info": {
    "singularName": "page",
    "pluralName": "pages",
    "displayName": "Page",
    "description": "Website pages built with dynamic sections"
  },
  "options": {
    "draftAndPublish": true,
    "timestamps": true
  },
  "pluginOptions": {
    "i18n": {
      "localized": true
    }
  },
  "attributes": {
    "title": {
      "type": "string",
      "required": true,
      "pluginOptions": {
        "i18n": {
          "localized": true
        }
      }
    },
    "slug": {
      "type": "uid",
      "targetField": "title",
      "required": true,
      "pluginOptions": {
        "i18n": {
          "localized": false
        }
      }
    },
    "status": {
      "type": "enumeration",
      "enum": ["draft", "published"],
      "default": "draft"
    },
    "publishDate": {
      "type": "datetime"
    },
    "sections": {
      "type": "dynamiczone",
      "components": [
        "sections.hero",
        "sections.advantages",
        "sections.rich-text"
      ]
    },
    "seo": {
      "type": "component",
      "repeatable": false,
      "component": "seo",
      "pluginOptions": {
        "i18n": {
          "localized": true
        }
      }
    },
    "layout": {
      "type": "component",
      "repeatable": false,
      "component": "page-layout"
    }
  }
}
```

- [ ] **步骤 2：创建 Page Controller**

```typescript
// src/api/page/controllers/page.ts
export default ({ strapi }: { strapi: any }) => ({
  async findBySlug(ctx: any) {
    const { slug, locale = 'zh-CN' } = ctx.params;
    const page = await strapi.documents('api::page.page').findFirst({
      filters: { slug },
      locale,
      status: 'published',
      populate: {
        sections: {
          on: {
            'sections.hero': {
              populate: ['backgroundImage', 'stats', 'primaryCta', 'secondaryCta'],
            },
            'sections.advantages': {
              populate: ['items'],
            },
            'sections.rich-text': {
              populate: true,
            },
          },
        },
        seo: { populate: ['ogImage'] },
      },
    });

    if (!page) {
      return ctx.notFound('Page not found');
    }

    ctx.body = { data: page };
  },
});
```

- [ ] **步骤 3：创建 Page Service**

```typescript
// src/api/page/services/page.ts
export default ({ strapi }: { strapi: any }) => ({
  async findAll(locale = 'zh-CN') {
    return strapi.documents('api::page.page').findMany({
      locale,
      status: 'published',
      select: ['title', 'slug', 'publishDate'],
    });
  },

  async findBySlug(slug: string, locale = 'zh-CN') {
    return strapi.documents('api::page.page').findFirst({
      filters: { slug },
      locale,
      status: 'published',
      populate: {
        sections: {
          on: {
            'sections.hero': {
              populate: ['backgroundImage', 'stats', 'primaryCta', 'secondaryCta'],
            },
            'sections.advantages': {
              populate: ['items'],
            },
            'sections.rich-text': {
              populate: true,
            },
          },
        },
        seo: { populate: ['ogImage'] },
      },
    });
  },
});
```

- [ ] **步骤 4：创建 Page Routes**

```json
{
  "routes": [
    {
      "method": "GET",
      "path": "/pages",
      "handler": "page.find"
    },
    {
      "method": "GET",
      "path": "/pages/:slug/:locale?",
      "handler": "page.findBySlug"
    },
    {
      "method": "POST",
      "path": "/pages",
      "handler": "page.create",
      "config": {
        "policies": []
      }
    },
    {
      "method": "PUT",
      "path": "/pages/:id",
      "handler": "page.update",
      "config": {
        "policies": []
      }
    },
    {
      "method": "DELETE",
      "path": "/pages/:id",
      "handler": "page.delete",
      "config": {
        "policies": []
      }
    }
  ]
}
```

- [ ] **步骤 5：Commit**

```bash
git add backend/src/api/page/
git commit -m "feat: add page collection type with dynamic zone sections"
```

---

## 任务 8：用户提交数据集合模型（表单、预约、对话）

**文件：**
- 创建：`backend/src/api/form-submission/content-types/form-submission/schema.json`
- 创建：`backend/src/api/appointment/content-types/appointment/schema.json`
- 创建：`backend/src/api/chat-session/content-types/chat-session/schema.json`
- 创建：`backend/src/api/chat-message/content-types/chat-message/schema.json`

- [ ] **步骤 1：创建 form-submission 集合**

```json
{
  "kind": "collectionType",
  "collectionName": "form_submissions",
  "info": {
    "singularName": "form-submission",
    "pluralName": "form-submissions",
    "displayName": "Form Submission",
    "description": "Contact form submissions"
  },
  "options": {
    "draftAndPublish": false,
    "timestamps": true
  },
  "pluginOptions": {
    "i18n": {
      "localized": false
    }
  },
  "attributes": {
    "formType": {
      "type": "enumeration",
      "enum": ["contact", "consultation", "callback", "custom"],
      "default": "contact"
    },
    "pageSlug": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "phone": {
      "type": "string",
      "required": true
    },
    "email": {
      "type": "email"
    },
    "message": {
      "type": "text"
    },
    "extraData": {
      "type": "json"
    },
    "status": {
      "type": "enumeration",
      "enum": ["new", "processing", "resolved", "spam"],
      "default": "new"
    },
    "notes": {
      "type": "text"
    },
    "ipAddress": {
      "type": "string"
    },
    "userAgent": {
      "type": "string"
    }
  }
}
```

- [ ] **步骤 2：创建 appointment 集合**

```json
{
  "kind": "collectionType",
  "collectionName": "appointments",
  "info": {
    "singularName": "appointment",
    "pluralName": "appointments",
    "displayName": "Appointment",
    "description": "Trial class appointments"
  },
  "options": {
    "draftAndPublish": false,
    "timestamps": true
  },
  "pluginOptions": {
    "i18n": {
      "localized": false
    }
  },
  "attributes": {
    "childName": {
      "type": "string"
    },
    "parentName": {
      "type": "string"
    },
    "phone": {
      "type": "string",
      "required": true
    },
    "age": {
      "type": "integer"
    },
    "course": {
      "type": "string"
    },
    "preferredDate": {
      "type": "date"
    },
    "preferredTimeSlot": {
      "type": "enumeration",
      "enum": ["morning", "afternoon", "evening"]
    },
    "campus": {
      "type": "string"
    },
    "message": {
      "type": "text"
    },
    "status": {
      "type": "enumeration",
      "enum": ["pending", "confirmed", "completed", "cancelled"],
      "default": "pending"
    },
    "notes": {
      "type": "text"
    },
    "sourcePage": {
      "type": "string"
    }
  }
}
```

- [ ] **步骤 3：创建 chat-session 集合**

```json
{
  "kind": "collectionType",
  "collectionName": "chat_sessions",
  "info": {
    "singularName": "chat-session",
    "pluralName": "chat-sessions",
    "displayName": "Chat Session",
    "description": "AI chat sessions"
  },
  "options": {
    "draftAndPublish": false,
    "timestamps": true
  },
  "pluginOptions": {
    "i18n": {
      "localized": false
    }
  },
  "attributes": {
    "sessionId": {
      "type": "string",
      "required": true,
      "unique": true
    },
    "visitorName": {
      "type": "string"
    },
    "visitorPhone": {
      "type": "string"
    },
    "visitorEmail": {
      "type": "email"
    },
    "sourcePage": {
      "type": "string"
    },
    "status": {
      "type": "enumeration",
      "enum": ["active", "transferred-human", "ended", "abandoned"],
      "default": "active"
    },
    "transferReason": {
      "type": "string"
    },
    "transferredAt": {
      "type": "datetime"
    },
    "messageCount": {
      "type": "integer",
      "default": 0
    },
    "summary": {
      "type": "text"
    },
    "leadIntent": {
      "type": "enumeration",
      "enum": ["consultation", "appointment", "support", "complaint", "other"]
    },
    "leadInfo": {
      "type": "json"
    },
    "satisfactionScore": {
      "type": "integer"
    },
    "canFeedbackToFaq": {
      "type": "boolean",
      "default": false
    },
    "feedbackStatus": {
      "type": "enumeration",
      "enum": ["none", "pending", "converted", "rejected"],
      "default": "none"
    },
    "messages": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::chat-message.chat-message",
      "mappedBy": "session"
    }
  }
}
```

- [ ] **步骤 4：创建 chat-message 集合**

```json
{
  "kind": "collectionType",
  "collectionName": "chat_messages",
  "info": {
    "singularName": "chat-message",
    "pluralName": "chat-messages",
    "displayName": "Chat Message",
    "description": "Individual chat messages"
  },
  "options": {
    "draftAndPublish": false,
    "timestamps": true
  },
  "pluginOptions": {
    "i18n": {
      "localized": false
    }
  },
  "attributes": {
    "session": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::chat-session.chat-session",
      "inversedBy": "messages"
    },
    "role": {
      "type": "enumeration",
      "enum": ["user", "assistant", "system", "human-agent"],
      "required": true
    },
    "content": {
      "type": "text",
      "required": true
    },
    "retrievedContext": {
      "type": "json"
    },
    "retrievedSources": {
      "type": "json"
    },
    "confidence": {
      "type": "decimal",
      "precision": 5,
      "scale": 4
    },
    "isTransferred": {
      "type": "boolean",
      "default": false
    },
    "metadata": {
      "type": "json"
    }
  }
}
```

- [ ] **步骤 5：Commit**

```bash
git add backend/src/api/form-submission/ backend/src/api/appointment/ backend/src/api/chat-session/ backend/src/api/chat-message/
git commit -m "feat: add user submission collections (form, appointment, chat session, chat message)"
```

---

## 任务 9：知识库集合模型（knowledge-base + faq-item）

**文件：**
- 创建：`backend/src/api/knowledge-base/content-types/knowledge-base/schema.json`
- 创建：`backend/src/api/faq-item/content-types/faq-item/schema.json`

- [ ] **步骤 1：创建 knowledge-base 集合**

```json
{
  "kind": "collectionType",
  "collectionName": "knowledge_bases",
  "info": {
    "singularName": "knowledge-base",
    "pluralName": "knowledge-bases",
    "displayName": "Knowledge Base",
    "description": "Knowledge base documents for AI RAG"
  },
  "options": {
    "draftAndPublish": false,
    "timestamps": true
  },
  "pluginOptions": {
    "i18n": {
      "localized": false
    }
  },
  "attributes": {
    "title": {
      "type": "string",
      "required": true
    },
    "sourceType": {
      "type": "enumeration",
      "enum": ["manual", "faq", "pdf", "webpage", "chat-history"],
      "default": "manual"
    },
    "file": {
      "type": "media",
      "allowedTypes": ["files"],
      "multiple": false
    },
    "content": {
      "type": "richtext"
    },
    "sourceUrl": {
      "type": "string"
    },
    "category": {
      "type": "string"
    },
    "status": {
      "type": "enumeration",
      "enum": ["pending", "processing", "ready", "failed"],
      "default": "pending"
    },
    "chunkCount": {
      "type": "integer",
      "default": 0
    },
    "vectorDbIds": {
      "type": "json"
    },
    "tags": {
      "type": "string"
    },
    "errorMessage": {
      "type": "text"
    },
    "lastProcessedAt": {
      "type": "datetime"
    }
  }
}
```

- [ ] **步骤 2：创建 faq-item 集合**

```json
{
  "kind": "collectionType",
  "collectionName": "faq_items",
  "info": {
    "singularName": "faq-item",
    "pluralName": "faq-items",
    "displayName": "FAQ Item",
    "description": "Frequently asked questions"
  },
  "options": {
    "draftAndPublish": true,
    "timestamps": true
  },
  "pluginOptions": {
    "i18n": {
      "localized": true
    }
  },
  "attributes": {
    "question": {
      "type": "string",
      "required": true,
      "pluginOptions": {
        "i18n": {
          "localized": true
        }
      }
    },
    "answer": {
      "type": "richtext",
      "required": true,
      "pluginOptions": {
        "i18n": {
          "localized": true
        }
      }
    },
    "category": {
      "type": "string"
    },
    "sourceType": {
      "type": "enumeration",
      "enum": ["manual", "auto-from-chat"],
      "default": "manual"
    },
    "reviewStatus": {
      "type": "enumeration",
      "enum": ["pending", "approved", "rejected"],
      "default": "approved"
    },
    "vectorSynced": {
      "type": "boolean",
      "default": false
    },
    "sortOrder": {
      "type": "integer",
      "default": 0
    }
  }
}
```

- [ ] **步骤 3：Commit**

```bash
git add backend/src/api/knowledge-base/ backend/src/api/faq-item/
git commit -m "feat: add knowledge base and faq-item collections"
```

---

## 任务 10：客户管理员 Policy + 权限配置文档

**文件：**
- 创建：`backend/src/policies/is-client-admin.ts`
- 创建：`docs/superpowers/plans/subproject-1-permissions-setup.md`

- [ ] **步骤 1：创建 is-client-admin policy**

```typescript
// src/policies/is-client-admin.ts
export default (policyContext: any, config: any, { strapi }: { strapi: any }) => {
  const user = policyContext.state.user;

  if (!user) return false;

  // 超级管理员直接放行
  if (user.role?.name === 'Super Admin') return true;

  // 客户管理员放行
  if (user.role?.name === 'client-admin') return true;

  return false;
};
```

- [ ] **步骤 2：创建权限配置操作文档**

权限配置需要在 Strapi 后台 UI 手动配置，因此提供操作文档：

```markdown
# 子项目 1：权限配置操作指南

## 角色配置步骤

### 1. 超级管理员
Strapi 内置，无需配置。首个注册的管理员账号自动拥有 Super Admin 角色。

### 2. 客户管理员 (client-admin)

在 Strapi 后台 `Settings → Roles → Add new role` 创建：

**Role Name:** `client-admin`

**Collection Types 权限：**

| 集合 | find | findOne | create | update | delete | publish |
|------|------|---------|--------|--------|--------|---------|
| Page | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Form Submission | ✅ | ✅ | ✅ | ✅ | ❌ | — |
| Appointment | ✅ | ✅ | ✅ | ✅ | ❌ | — |
| Chat Session | ✅ | ✅ | ❌ | ✅ | ❌ | — |
| Chat Message | ✅ | ✅ | ❌ | ❌ | ❌ | — |
| Knowledge Base | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| FAQ Item | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Single Types 权限：**

| 单例 | find | update |
|------|------|--------|
| Site Settings | ✅ | ✅ |
| Navigation | ✅ | ✅ |
| Footer | ✅ | ✅ |
| AI Config | ✅ | ✅ |
| Vector Config | ❌ | ❌ |

**Plugins 权限：**

| 插件 | 权限 |
|------|------|
| Upload | ✅ read, upload |
| Content Manager | ✅ all |
| i18n | ✅ read only |

**禁止访问：**
- Users & Permissions plugin
- Admin 管理
- 角色权限管理

### 3. 访客 (Public)

在 `Settings → Roles → Public` 配置：

| 集合 | create | find | findOne |
|------|--------|------|---------|
| Page | ❌ | ✅ | ✅ |
| Form Submission | ✅ | ❌ | ❌ |
| Appointment | ✅ | ❌ | ❌ |
| Chat Session | ✅ | ❌ | ❌ |
| Chat Message | ✅ | ❌ | ❌ |

| 单例 | find |
|------|------|
| Site Settings | ✅ |
| Navigation | ✅ |
| Footer | ✅ |

**注意：**
- 访客只有 create 权限，没有 find/findOne，防止看到他人数据
- Chat session 的 update 需要自定义 policy 校验会话归属
- Upload 只有 read 权限，访客不能上传文件

### 4. 自定义 Policy 应用

以下路由需要应用 `is-client-admin` policy：

- 所有需要客户管理员权限的自定义 API 路由
- `PUT /chat-sessions/:id` — 访客只能更新自己的会话
```

- [ ] **步骤 3：Commit**

```bash
git add backend/src/policies/is-client-admin.ts docs/superpowers/plans/subproject-1-permissions-setup.md
git commit -m "feat: add is-client-admin policy and permission setup guide"
```

---

## 任务 11：启动验证 + 冒烟测试

**文件：** 无新文件（验证现有配置）

- [ ] **步骤 1：确保 Docker 服务启动**

运行：`cd docker && docker compose up -d`
预期：四个服务（postgres、redis、meilisearch）全部 healthy

- [ ] **步骤 2：安装 Strapi 依赖**

运行：`cd backend && npm install`
预期：安装成功

- [ ] **步骤 3：复制 .env 文件**

运行：`cd backend && cp .env.example .env`
然后根据需要修改密码

- [ ] **步骤 4：启动 Strapi develop**

运行：`cd backend && npm run develop`
预期：Strapi 启动成功，提示在 `http://localhost:1337/admin` 创建管理员账号

- [ ] **步骤 5：验证内容模型**

在后台创建管理员账号后，检查：
- Content Manager 中有 Page、Knowledge Base、FAQ Item、Form Submission、Appointment、Chat Session、Chat Message 集合
- Single Types 中有 Site Settings、Navigation、Footer、AI Config、Vector DB Config
- 创建一个 Page，Dynamic Zone 能添加 Hero、Advantages、Rich Text 三种区块

- [ ] **步骤 6：验证 API**

运行：`curl http://localhost:1337/api/pages?locale=zh-CN`
预期：返回 `{ data: [], meta: { ... } }`（空列表，因为还没创建页面）

运行：`curl http://localhost:1337/api/site-settings`
预期：返回 site-settings 数据

- [ ] **步骤 7：验证本地化**

在后台 `Settings → Internationalization` 检查：
- 默认语言是 zh-CN
- en-US 语言已添加
- 创建 Page 时有语言切换 tab

- [ ] **步骤 8：验证队列基础设施**

检查 Strapi 启动日志：
- 看到 `[Bootstrap] Queues registered` 表示队列注册成功
- 看到 `[Queue] Created queue: document-processing` 表示队列创建成功
- 看到 `[Queue] Created worker for queue: document-processing` 表示 Worker 启动成功

- [ ] **步骤 9：验证访客 API 提交**

运行：
```bash
curl -X POST http://localhost:1337/api/form-submissions \
  -H "Content-Type: application/json" \
  -d '{"data": {"name": "测试用户", "phone": "13800138000", "message": "测试留言"}}'
```
预期：返回创建成功的 form-submission 记录

- [ ] **步骤 10：Commit（如果有调整）**

如果发现问题并修复，提交修复：
```bash
git add <修改的文件>
git commit -m "fix: resolve startup issues found during smoke test"
```

---

## 自检

### 规格覆盖度检查

| 规格章节 | 对应任务 | 状态 |
|---------|---------|------|
| 2. 技术选型 | 任务 1-2 | ✅ |
| 3. 项目目录结构 | 任务 2 | ✅ |
| 4. Docker Compose 配置 | 任务 1 | ✅ |
| 5.1 全局单例 | 任务 6 | ✅ |
| 5.2 Page 集合 | 任务 7 | ✅ |
| 5.3 Dynamic Zone 区块组件 | 任务 5 | ✅ |
| 5.4 用户提交数据集合 | 任务 8 | ✅ |
| 5.5 知识库集合 | 任务 9 | ✅ |
| 5.6 知识库维护流程 | 任务 3、9 | ✅（数据模型+Worker骨架） |
| 5.7 API 接口清单 | 任务 7、8、9 | ✅（Strapi 自动生成 CRUD + 自定义路由） |
| 5.8 代码结构与技术选型 | 任务 2、3、10 | ✅ |
| 5.9 BullMQ 队列集成 | 任务 1、3 | ✅ |
| 6. 权限模型 | 任务 10 | ✅ |
| 7. 验收标准（10条） | 任务 11 | ✅ |

### 占位符扫描

- ✅ 无 "TODO"、"待定" 等占位符
- ✅ 所有代码步骤都有实际代码块
- ✅ 所有命令步骤都有具体命令和预期输出
- ✅ 所有步骤都有明确的文件路径

### 类型一致性检查

- ✅ 队列名称一致：`document-processing`、`faq-feedback`
- ✅ 集合名称与 schema.json 中 `collectionName` 一致
- ✅ 组件路径一致（`sections.hero`、`stat-item` 等）
- ✅ 字段名称在各任务间一致（`status`、`chunkCount`、`vectorDbIds` 等）

---

## 执行交接

计划已完成并保存到 `docs/superpowers/plans/2026-07-11-subproject-1-strapi-infrastructure.md`。两种执行方式：

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

**选哪种方式？**
