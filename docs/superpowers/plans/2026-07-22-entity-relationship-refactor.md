# 实体关系重构（campus ↔ teacher ↔ product）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 campus↔teacher 从 oneToMany 改为显式中间表多对多，并新建 campus↔product、teacher↔product 两组多对多关系，统一支持 status 软删除。

**架构：** 3 张显式 junction collection type（campus-teacher-link / campus-product-link / teacher-product-link），每张含两个 manyToOne 端点 + status/sortOrder/notes 自定义字段。父实体（campus/teacher/product）各加 2 个 oneToMany 指向中间表，删除旧的 campus.teachers 与 teacher.campus。迁移脚本已写好并 dry-run 验证（6 条记录）。

**技术栈：** Strapi v5.50.2 / PostgreSQL 16 / TypeScript / Next.js / vitest

**关键约束：**
- "课程" = product content type（无独立 course 类型，已验证）
- 容器内 lodash/fp 缺失，迁移 execute 用 host 端 pg 直连（不用 createStrapi().load()）
- 本地 development mode 操作，重启自动 ALTER TABLE
- 客户服务器暂不部署

---

## 文件结构

### 新建文件

| 文件 | 职责 |
|------|------|
| `backend/src/api/campus-teacher-link/content-types/campus-teacher-link/schema.json` | campus↔teacher 中间表 schema |
| `backend/src/api/campus-teacher-link/routes/campus-teacher-link.ts` | 路由（默认） |
| `backend/src/api/campus-teacher-link/controllers/campus-teacher-link.ts` | 控制器（默认） |
| `backend/src/api/campus-teacher-link/services/campus-teacher-link.ts` | 服务（默认） |
| `backend/src/api/campus-product-link/content-types/campus-product-link/schema.json` | campus↔product 中间表 schema |
| `backend/src/api/campus-product-link/routes/campus-product-link.ts` | 路由（默认） |
| `backend/src/api/campus-product-link/controllers/campus-product-link.ts` | 控制器（默认） |
| `backend/src/api/campus-product-link/services/campus-product-link.ts` | 服务（默认） |
| `backend/src/api/teacher-product-link/content-types/teacher-product-link/schema.json` | teacher↔product 中间表 schema |
| `backend/src/api/teacher-product-link/routes/teacher-product-link.ts` | 路由（默认） |
| `backend/src/api/teacher-product-link/controllers/teacher-product-link.ts` | 控制器（默认） |
| `backend/src/api/teacher-product-link/services/teacher-product-link.ts` | 服务（默认） |
| `backend/scripts/execute-migration.ts` | host 端 pg 直连迁移执行器（绕过容器 lodash 问题） |

### 修改文件

| 文件 | 改动 |
|------|------|
| `backend/src/api/campus/content-types/campus/schema.json` | 删 `teachers`，加 `teacher_links` + `product_links` |
| `backend/src/api/teacher/content-types/teacher/schema.json` | 删 `campus`，加 `campus_links` + `product_links` |
| `backend/src/api/product/content-types/product/schema.json` | 加 `campus_links` + `teacher_links` |
| `backend/src/api/campus/controllers/campus.ts` | populate 从 `teachers` 改为 `teacher_links` 两层 |
| `backend/src/api/teacher/controllers/teacher.ts` | populate 从 `campus` 改为 `campus_links` 两层；campusSlug 过滤适配 |
| `backend/src/api/product/controllers/product.ts` | PRODUCT_POPULATE / PRODUCT_POPULATE_DETAIL 加 campus_links + teacher_links |
| `frontend-next/lib/api.ts` | populate 参数改两层；加 `extractActiveLinks` helper |
| `frontend-next/components/campus/CampusTeachers.tsx` | 从 teacher_links 映射 + status 过滤 |
| `frontend-next/components/team/TeacherCard.tsx` | 从 campus_links 映射 |
| `frontend-next/components/team/TeacherDetail.tsx` | 从 campus_links 映射 |

---

## 任务 1：创建 campus-teacher-link 中间表 collection type

**文件：**
- 创建：`backend/src/api/campus-teacher-link/content-types/campus-teacher-link/schema.json`
- 创建：`backend/src/api/campus-teacher-link/routes/campus-teacher-link.ts`
- 创建：`backend/src/api/campus-teacher-link/controllers/campus-teacher-link.ts`
- 创建：`backend/src/api/campus-teacher-link/services/campus-teacher-link.ts`

- [ ] **步骤 1：创建 schema.json**

```json
{
  "kind": "collectionType",
  "collectionName": "campus_teacher_links",
  "info": {
    "singularName": "campus-teacher-link",
    "pluralName": "campus-teacher-links",
    "displayName": "校区教师关联",
    "description": "校区↔教师多对多关系中间表（显式，支持 status 软删除）",
    "icon": "Link"
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
    "campus": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::campus.campus",
      "inversedBy": "teacher_links",
      "description": "关联校区"
    },
    "teacher": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::teacher.teacher",
      "inversedBy": "campus_links",
      "description": "关联教师"
    },
    "status": {
      "type": "enumeration",
      "enum": ["active", "inactive"],
      "default": "active",
      "required": true,
      "description": "关系状态：active=当前有效，inactive=历史归档"
    },
    "sortOrder": {
      "type": "integer",
      "default": 0,
      "description": "排序"
    },
    "notes": {
      "type": "text",
      "description": "关系备注（如外聘、主讲等）"
    }
  }
}
```

- [ ] **步骤 2：创建 routes.ts**

```typescript
import { factories } from '@strapi/strapi';

// 校区教师关联路由：CRUD 全量开放（管理后台用），find/findOne 公开只读
export default factories.createCoreRouter('api::campus-teacher-link.campus-teacher-link', {
  only: ['find', 'findOne', 'create', 'update', 'delete'],
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});
```

- [ ] **步骤 3：创建 controllers.ts**

```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::campus-teacher-link.campus-teacher-link');
```

- [ ] **步骤 4：创建 services.ts**

```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::campus-teacher-link.campus-teacher-link');
```

- [ ] **步骤 5：Commit**

```bash
git add backend/src/api/campus-teacher-link/
git commit -m "feat(api): 创建 campus-teacher-link 中间表 content type"
```

---

## 任务 2：创建 campus-product-link 中间表 content type

**文件：**
- 创建：`backend/src/api/campus-product-link/content-types/campus-product-link/schema.json`
- 创建：`backend/src/api/campus-product-link/routes/campus-product-link.ts`
- 创建：`backend/src/api/campus-product-link/controllers/campus-product-link.ts`
- 创建：`backend/src/api/campus-product-link/services/campus-product-link.ts`

- [ ] **步骤 1：创建 schema.json**

```json
{
  "kind": "collectionType",
  "collectionName": "campus_product_links",
  "info": {
    "singularName": "campus-product-link",
    "pluralName": "campus-product-links",
    "displayName": "校区课程关联",
    "description": "校区↔课程(product)多对多关系中间表（显式，支持 status 软删除）",
    "icon": "Link"
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
    "campus": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::campus.campus",
      "inversedBy": "product_links",
      "description": "关联校区"
    },
    "product": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::product.product",
      "inversedBy": "campus_links",
      "description": "关联课程(product)"
    },
    "status": {
      "type": "enumeration",
      "enum": ["active", "inactive"],
      "default": "active",
      "required": true,
      "description": "关系状态：active=当前有效，inactive=历史归档"
    },
    "sortOrder": {
      "type": "integer",
      "default": 0,
      "description": "排序"
    },
    "notes": {
      "type": "text",
      "description": "关系备注"
    }
  }
}
```

- [ ] **步骤 2：创建 routes.ts**

```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::campus-product-link.campus-product-link', {
  only: ['find', 'findOne', 'create', 'update', 'delete'],
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});
```

- [ ] **步骤 3：创建 controllers.ts**

```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::campus-product-link.campus-product-link');
```

- [ ] **步骤 4：创建 services.ts**

```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::campus-product-link.campus-product-link');
```

- [ ] **步骤 5：Commit**

```bash
git add backend/src/api/campus-product-link/
git commit -m "feat(api): 创建 campus-product-link 中间表 content type"
```

---

## 任务 3：创建 teacher-product-link 中间表 content type

**文件：**
- 创建：`backend/src/api/teacher-product-link/content-types/teacher-product-link/schema.json`
- 创建：`backend/src/api/teacher-product-link/routes/teacher-product-link.ts`
- 创建：`backend/src/api/teacher-product-link/controllers/teacher-product-link.ts`
- 创建：`backend/src/api/teacher-product-link/services/teacher-product-link.ts`

- [ ] **步骤 1：创建 schema.json**

```json
{
  "kind": "collectionType",
  "collectionName": "teacher_product_links",
  "info": {
    "singularName": "teacher-product-link",
    "pluralName": "teacher-product-links",
    "displayName": "教师课程关联",
    "description": "教师↔课程(product)多对多关系中间表（显式，支持 status 软删除）",
    "icon": "Link"
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
    "teacher": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::teacher.teacher",
      "inversedBy": "product_links",
      "description": "关联教师"
    },
    "product": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::product.product",
      "inversedBy": "teacher_links",
      "description": "关联课程(product)"
    },
    "status": {
      "type": "enumeration",
      "enum": ["active", "inactive"],
      "default": "active",
      "required": true,
      "description": "关系状态：active=当前有效，inactive=历史归档"
    },
    "sortOrder": {
      "type": "integer",
      "default": 0,
      "description": "排序"
    },
    "notes": {
      "type": "text",
      "description": "关系备注（如主讲、助教等）"
    }
  }
}
```

- [ ] **步骤 2：创建 routes.ts**

```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::teacher-product-link.teacher-product-link', {
  only: ['find', 'findOne', 'create', 'update', 'delete'],
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});
```

- [ ] **步骤 3：创建 controllers.ts**

```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::teacher-product-link.teacher-product-link');
```

- [ ] **步骤 4：创建 services.ts**

```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::teacher-product-link.teacher-product-link');
```

- [ ] **步骤 5：Commit**

```bash
git add backend/src/api/teacher-product-link/
git commit -m "feat(api): 创建 teacher-product-link 中间表 content type"
```

---

## 任务 4：重启 Strapi 验证 3 张中间表已创建

- [ ] **步骤 1：重启 backend 容器**

```bash
docker compose restart backend
# 等待健康
timeout 60 bash -c 'until docker exec yousen-backend wget -qO- http://localhost:1337/_health 2>/dev/null | grep -q ok; do sleep 2; done'
```

- [ ] **步骤 2：验证 3 张表已创建**

运行：

```bash
docker exec yousen-postgres psql -U strapi -d strapi -c "\dt campus_teacher_links; \dt campus_product_links; \dt teacher_product_links;"
```

预期：3 张表都存在，各有 `id, document_id, campus_id/teacher_id/product_id, status, sort_order, notes, created_at, updated_at` 等列。

- [ ] **步骤 3：验证 Strapi 日志无报错**

```bash
docker logs yousen-backend --tail 30 2>&1 | grep -iE "error|warn" | head -10
```

预期：无 relation schema 相关报错。

---

## 任务 5：给父实体 schema 加 oneToMany 字段（暂不删旧字段）

**文件：**
- 修改：`backend/src/api/campus/content-types/campus/schema.json`
- 修改：`backend/src/api/teacher/content-types/teacher/schema.json`
- 修改：`backend/src/api/product/content-types/product/schema.json`

**关键顺序**：先加新字段（指向已存在的中间表），不删旧字段。旧字段保留到迁移完成后才删，避免丢失数据。

- [ ] **步骤 1：campus schema 加 teacher_links + product_links**

在 campus schema.json 的 `attributes` 中，把现有 `teachers` 字段**保留不动**，在其后新增两个字段：

```json
"teacher_links": {
  "type": "relation",
  "relation": "oneToMany",
  "target": "api::campus-teacher-link.campus-teacher-link",
  "mappedBy": "campus",
  "description": "校区↔教师多对多关联（经中间表）"
},
"product_links": {
  "type": "relation",
  "relation": "oneToMany",
  "target": "api::campus-product-link.campus-product-link",
  "mappedBy": "campus",
  "description": "校区↔课程多对多关联（经中间表）"
}
```

- [ ] **步骤 2：teacher schema 加 campus_links + product_links**

在 teacher schema.json 的 `attributes` 中，把现有 `campus` 字段**保留不动**，新增：

```json
"campus_links": {
  "type": "relation",
  "relation": "oneToMany",
  "target": "api::campus-teacher-link.campus-teacher-link",
  "mappedBy": "teacher",
  "description": "教师↔校区多对多关联（经中间表）"
},
"product_links": {
  "type": "relation",
  "relation": "oneToMany",
  "target": "api::teacher-product-link.teacher-product-link",
  "mappedBy": "teacher",
  "description": "教师↔课程多对多关联（经中间表）"
}
```

- [ ] **步骤 3：product schema 加 campus_links + teacher_links**

在 product schema.json 的 `attributes` 中新增：

```json
"campus_links": {
  "type": "relation",
  "relation": "oneToMany",
  "target": "api::campus-product-link.campus-product-link",
  "mappedBy": "product",
  "description": "课程↔校区多对多关联（经中间表）"
},
"teacher_links": {
  "type": "relation",
  "relation": "oneToMany",
  "target": "api::teacher-product-link.teacher-product-link",
  "mappedBy": "product",
  "description": "课程↔教师多对多关联（经中间表）"
}
```

- [ ] **步骤 4：重启 + 验证父实体新字段生效**

```bash
docker compose restart backend
timeout 60 bash -c 'until docker exec yousen-backend wget -qO- http://localhost:1337/_health 2>/dev/null | grep -q ok; do sleep 2; done'
# 验证 campus 接口返回 teacher_links / product_links 字段（空数组）
curl -s http://localhost:1337/api/campuses?pagination[pageSize]=1 | python3 -m json.tool | grep -E "teacher_links|product_links"
```

预期：响应中可见 `teacher_links` 和 `product_links` 字段（值为空数组，因为还没迁移数据）。

- [ ] **步骤 5：Commit**

```bash
git add backend/src/api/campus/content-types/campus/schema.json \
        backend/src/api/teacher/content-types/teacher/schema.json \
        backend/src/api/product/content-types/product/schema.json
git commit -m "feat(schema): 父实体加 oneToMany 指向中间表（旧字段暂留过渡）"
```

---

## 任务 6：执行数据迁移（campus↔teacher）

**文件：**
- 创建：`backend/scripts/execute-migration.ts`（host 端 pg 直连，绕过容器 lodash 问题）

迁移脚本 `migrate-to-manytomany.ts` 的 `buildMigrationPlan` 已测试通过（8 个单测），dry-run 已验证 24 行 → 6 条唯一记录。本任务创建 host 端执行器并实跑。

- [ ] **步骤 1：创建 host 端执行器**

```typescript
/**
 * Host 端迁移执行器：绕过容器 lodash/fp 缺失，用 pg 直连本地 DB 执行迁移。
 * 运行方式（host，backend 目录下）：
 *   npx tsx scripts/execute-migration.ts
 */
import { Pool } from 'pg';
import { buildMigrationPlan } from './migrate-to-manytomany';

async function main() {
  const pool = new Pool({
    host: '127.0.0.1', port: 5432, database: 'strapi',
    user: 'strapi', password: 'changeme',
  });

  try {
    // 1. 读源数据
    const { rows } = await pool.query(
      `SELECT t.document_id AS teacher_doc_id, t.name AS teacher_name, t.locale,
              c.document_id AS campus_doc_id, c.name AS campus_name
       FROM teachers_campus_lnk l
       JOIN teachers t ON l.teacher_id = t.id
       JOIN campuses c ON l.campus_id = c.id
       ORDER BY c.name, t.name`
    );

    const plan = buildMigrationPlan(rows as any);
    console.log(`迁移计划：${plan.stats.totalLnkRows} 行 → ${plan.stats.uniquePairs} 条唯一记录\n`);

    // 2. 幂等检查
    const { rows: existing } = await pool.query('SELECT count(*)::int AS n FROM campus_teacher_links');
    if (existing[0].n > 0) {
      console.log(`⚠ campus_teacher_links 已有 ${existing[0].n} 条记录，跳过（幂等保护）`);
      return;
    }

    // 3. 写入
    for (const link of plan.campusTeacherLinks) {
      await pool.query(
        `INSERT INTO campus_teacher_links
           (document_id, campus_id, teacher_id, status, sort_order, created_at, updated_at)
         SELECT $1, c.id, t.id, $4, $5, NOW(), NOW()
         FROM campuses c, teachers t
         WHERE c.document_id = $2 AND t.document_id = $3
         LIMIT 1`,
        ['cl_' + Math.random().toString(36).slice(2, 14),
         link.campusDocumentId, link.teacherDocumentId,
         link.status, link.sortOrder]
      );
      console.log(`✓ ${link.teacherName} → ${link.campusName} (sortOrder=${link.sortOrder})`);
    }

    // 4. 验证
    const { rows: result } = await pool.query('SELECT count(*)::int AS n FROM campus_teacher_links');
    console.log(`\n完成：campus_teacher_links 现有 ${result[0].n} 条记录`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => { console.error('迁移异常:', err); process.exit(1); });
```

- [ ] **步骤 2：执行迁移**

```bash
cd backend && npx tsx scripts/execute-migration.ts
```

预期输出：6 行 `✓ <教师> → <校区>` + `完成：campus_teacher_links 现有 6 条记录`。

- [ ] **步骤 3：验证迁移结果**

```bash
docker exec yousen-postgres psql -U strapi -d strapi -c "
SELECT c.name AS campus, t.name AS teacher, l.status, l.sort_order
FROM campus_teacher_links l
JOIN campuses c ON l.campus_id = c.id
JOIN teachers t ON l.teacher_id = t.id
WHERE t.locale = 'zh-CN'
ORDER BY l.sort_order;
"
```

预期：6 行，王老师→百步亭、张老师→动物园、赵老师→沌口、李老师→三阳路、刘老师→四新、陈老师→钟家村，status 全 active。

- [ ] **步骤 4：通过 API 验证**

```bash
curl -s "http://localhost:1337/api/campuses?populate[teacher_links][populate][teacher][populate][avatar]=true&filters[slug]=baiting&pagination[pageSize]=1" | python3 -m json.tool | grep -A2 teacher_links
```

预期：某校区的 `teacher_links` 数组含已迁移的 teacher 关联。

- [ ] **步骤 5：Commit 执行器**

```bash
git add backend/scripts/execute-migration.ts
git commit -m "feat(scripts): host 端 pg 直连迁移执行器 + 执行 campus↔teacher 迁移"
```

---

## 任务 7：删除旧关系字段 + 重启

**文件：**
- 修改：`backend/src/api/campus/content-types/campus/schema.json`（删 `teachers`）
- 修改：`backend/src/api/teacher/content-types/teacher/schema.json`（删 `campus`）

**前置条件**：任务 6 迁移已完成并验证，数据已在新中间表中。

- [ ] **步骤 1：campus schema 删除 teachers 字段**

删除 campus schema.json 中的整个 `teachers` 属性块：

```json
"teachers": {
  "type": "relation",
  "relation": "oneToMany",
  "target": "api::teacher.teacher",
  "mappedBy": "campus",
  "description": "校区教师"
},
```

保留新增的 `teacher_links` 和 `product_links`。

- [ ] **步骤 2：teacher schema 删除 campus 字段**

删除 teacher schema.json 中的整个 `campus` 属性块：

```json
"campus": {
  "type": "relation",
  "relation": "manyToOne",
  "target": "api::campus.campus",
  "inversedBy": "teachers",
  "description": "所属校区"
},
```

保留新增的 `campus_links` 和 `product_links`。

- [ ] **步骤 3：重启 + 验证旧表已删除**

```bash
docker compose restart backend
timeout 60 bash -c 'until docker exec yousen-backend wget -qO- http://localhost:1337/_health 2>/dev/null | grep -q ok; do sleep 2; done'
# 旧关系表应已删除
docker exec yousen-postgres psql -U strapi -d strapi -c "\dt teachers_campus_lnk"
```

预期：`Did not find any relation named 'teachers_campus_lnk'`（表已随字段删除而 drop）。

- [ ] **步骤 4：验证新中间表数据仍在**

```bash
docker exec yousen-postgres psql -U strapi -d strapi -c "SELECT count(*) FROM campus_teacher_links;"
```

预期：仍为 6（迁移数据未受影响）。

- [ ] **步骤 5：Commit**

```bash
git add backend/src/api/campus/content-types/campus/schema.json \
        backend/src/api/teacher/content-types/teacher/schema.json
git commit -m "refactor(schema): 删除 campus.teachers + teacher.campus 旧 oneToMany（已迁移）"
```

---

## 任务 8：更新 campus controller（teachers → teacher_links 两层 populate）

**文件：**
- 修改：`backend/src/api/campus/controllers/campus.ts`

campus controller 的 `find` 和 `findOne` 硬编码了 `populate: { teachers: { populate: { avatar: true } } }`，需改为经中间表两层 populate + status 过滤。

- [ ] **步骤 1：修改 find 方法的 populate**

把 campus controller `find` 方法中的 populate 块：

```typescript
populate: {
  coverImage: true,
  gallery: true,
  teachers: {
    populate: { avatar: true },
  },
  seo: true,
},
```

替换为：

```typescript
populate: {
  coverImage: true,
  gallery: true,
  teacher_links: {
    populate: {
      teacher: { populate: { avatar: true } },
    },
    filters: { status: 'active' },
    sort: { sortOrder: 'asc' },
  },
  product_links: {
    populate: {
      product: { populate: { thumbnail: true } },
    },
    filters: { status: 'active' },
    sort: { sortOrder: 'asc' },
  },
  seo: true,
},
```

- [ ] **步骤 2：修改 findOne 方法的 populate**

同样把 `findOne` 方法中的 `teachers` populate 块替换为上方相同的 `teacher_links` + `product_links` 两层 populate。

- [ ] **步骤 3：重启 + 验证 API 返回两层结构**

```bash
docker compose restart backend
timeout 60 bash -c 'until docker exec yousen-backend wget -qO- http://localhost:1337/_health 2>/dev/null | grep -q ok; do sleep 2; done'
curl -s http://localhost:1337/api/campuses | python3 -m json.tool | grep -A5 teacher_links
```

预期：`teacher_links` 数组内含 `{ teacher: { ... }, status: "active", sortOrder: 0 }` 结构。

- [ ] **步骤 4：Commit**

```bash
git add backend/src/api/campus/controllers/campus.ts
git commit -m "refactor(campus): controller populate 从 teachers 改为 teacher_links 两层"
```

---

## 任务 9：更新 teacher controller（campus → campus_links 两层 + campusSlug 过滤适配）

**文件：**
- 修改：`backend/src/api/teacher/controllers/teacher.ts`

teacher controller 现有 `populate: { campus: true, avatar: true, seo: true }` 和 `campusSlug` 过滤逻辑（`filters?.campus?.slug` + `entityFilters.campus = { slug: { $eq } }`），都需适配中间表。

- [ ] **步骤 1：修改 find/findOne 的 populate**

把 `populate: { campus: true, avatar: true, seo: true }` 替换为：

```typescript
populate: {
  avatar: true,
  seo: true,
  campus_links: {
    populate: {
      campus: { populate: { coverImage: true } },
    },
    filters: { status: 'active' },
    sort: { sortOrder: 'asc' },
  },
  product_links: {
    populate: {
      product: { populate: { thumbnail: true } },
    },
    filters: { status: 'active' },
    sort: { sortOrder: 'asc' },
  },
},
```

- [ ] **步骤 2：适配 campusSlug 过滤**

原逻辑：

```typescript
const campusSlug = filters?.campus?.slug?.$eq || filters?.campusSlug;
if (campusSlug) {
  entityFilters.campus = { slug: { $eq: campusSlug } };
}
```

改为经中间表过滤（查询属于某校区的教师）：

```typescript
const campusSlug = filters?.campus?.slug?.$eq || filters?.campusSlug;
if (campusSlug) {
  // 经 campus_teacher_links 中间表过滤：该教师有 active 关联指向 slug 校区
  entityFilters.campus_links = {
    campus: { slug: { $eq: campusSlug } },
    status: 'active',
  };
}
```

- [ ] **步骤 3：重启 + 验证**

```bash
docker compose restart backend
timeout 60 bash -c 'until docker exec yousen-backend wget -qO- http://localhost:1337/_health 2>/dev/null | grep -q ok; do sleep 2; done'
# 验证按校区筛选教师仍可用
curl -s "http://localhost:1337/api/teachers?filters[campus][slug]=baiting" | python3 -m json.tool | grep -E "name|campus_links" | head -10
```

预期：返回属于百步亭校区的教师（经中间表过滤），`campus_links` 含校区信息。

- [ ] **步骤 4：Commit**

```bash
git add backend/src/api/teacher/controllers/teacher.ts
git commit -m "refactor(teacher): controller populate + campusSlug 过滤改为经中间表"
```

---

## 任务 10：更新 product controller（加 campus_links + teacher_links populate）

**文件：**
- 修改：`backend/src/api/product/controllers/product.ts`

product controller 用 `PRODUCT_POPULATE` 和 `PRODUCT_POPULATE_DETAIL` 常量。需加 campus_links + teacher_links。

- [ ] **步骤 1：找到 PRODUCT_POPULATE / PRODUCT_POPULATE_DETAIL 定义**

运行：

```bash
grep -n "PRODUCT_POPULATE" backend/src/api/product/controllers/product.ts | head -5
```

定位常量定义行号。

- [ ] **步骤 2：在两个常量里加 campus_links + teacher_links**

把 `PRODUCT_POPULATE`（列表用）和 `PRODUCT_POPULATE_DETAIL`（详情用）常量里加入：

```typescript
campus_links: {
  populate: {
    campus: { populate: { coverImage: true } },
  },
  filters: { status: 'active' },
  sort: { sortOrder: 'asc' },
},
teacher_links: {
  populate: {
    teacher: { populate: { avatar: true } },
  },
  filters: { status: 'active' },
  sort: { sortOrder: 'asc' },
},
```

- [ ] **步骤 3：重启 + 验证**

```bash
docker compose restart backend
timeout 60 bash -c 'until docker exec yousen-backend wget -qO- http://localhost:1337/_health 2>/dev/null | grep -q ok; do sleep 2; done'
curl -s "http://localhost:1337/api/products?pagination[pageSize]=1" | python3 -m json.tool | grep -E "campus_links|teacher_links"
```

预期：`campus_links` 和 `teacher_links` 字段出现（初始为空数组，因为还没在 admin 里建立 product↔campus/teacher 关联）。

- [ ] **步骤 4：Commit**

```bash
git add backend/src/api/product/controllers/product.ts
git commit -m "feat(product): controller populate 加 campus_links + teacher_links"
```

---

## 任务 11：前端 api.ts + extractActiveLinks helper

**文件：**
- 修改：`frontend-next/lib/api.ts`

- [ ] **步骤 1：添加 extractActiveLinks helper**

在 api.ts 顶部（类型定义区后）加：

```typescript
/**
 * 从中间表 links 数组提取 active 状态的目标实体（按 sortOrder 排序）。
 * 适用于 campus_teacher_links / campus_product_links / teacher_product_links。
 */
export function extractActiveLinks<T>(
  links: any[] | undefined,
  targetField: string
): T[] {
  if (!Array.isArray(links)) return [];
  return links
    .filter((l) => l?.status === 'active')
    .sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0))
    .map((l) => l?.[targetField])
    .filter((v): v is T => v != null);
}
```

- [ ] **步骤 2：更新 Campus / Teacher / Product TypeScript 接口**

把 `Campus` 接口里的 `teachers?: Teacher[]` 改为：

```typescript
teacher_links?: Array<{
  status: 'active' | 'inactive';
  sortOrder: number;
  notes?: string;
  teacher: Teacher;
}>;
product_links?: Array<{
  status: 'active' | 'inactive';
  sortOrder: number;
  notes?: string;
  product: Product;
}>;
```

把 `Teacher` 接口里的 `campus?: Campus` 改为：

```typescript
campus_links?: Array<{
  status: 'active' | 'inactive';
  sortOrder: number;
  notes?: string;
  campus: Campus;
}>;
product_links?: Array<{
  status: 'active' | 'inactive';
  sortOrder: number;
  notes?: string;
  product: Product;
}>;
```

把 `Product` 接口加：

```typescript
campus_links?: Array<{
  status: 'active' | 'inactive';
  sortOrder: number;
  notes?: string;
  campus: Campus;
}>;
teacher_links?: Array<{
  status: 'active' | 'inactive';
  sortOrder: number;
  notes?: string;
  teacher: Teacher;
}>;
```

- [ ] **步骤 3：更新 getCampuses / getTeachers / getProducts 的 populate**

在 api.ts 中，找到 `getCampuses`、`getTeachers`/`getTeacher`、`getProducts`/`getProduct` 的 populate 调用，把 `populate=teachers`、`populate=campus` 等单层改为两层。例如 getCampuses 的 populate 参数改为：

```typescript
const query = qs.stringify(
  {
    fields: ['name', 'slug', 'address', 'phone', 'contactPerson', 'businessHours', 'latitude', 'longitude', 'sortOrder'],
    populate: {
      coverImage: true,
      gallery: true,
      teacher_links: {
        populate: { teacher: { populate: { avatar: true } } },
        filters: { status: 'active' },
        sort: { sortOrder: 'asc' },
      },
      product_links: {
        populate: { product: { populate: { thumbnail: true } } },
        filters: { status: 'active' },
        sort: { sortOrder: 'asc' },
      },
      seo: true,
    },
    locale,
    pagination: { pageSize: 100 },
  },
  { encodeValuesOnly: true }
);
```

- [ ] **步骤 4：Commit**

```bash
git add frontend-next/lib/api.ts
git commit -m "feat(frontend): api.ts 加 extractActiveLinks helper + 两层 populate"
```

---

## 任务 12：前端 CampusTeachers 组件适配

**文件：**
- 修改：`frontend-next/components/campus/CampusTeachers.tsx`

- [ ] **步骤 1：读取现有组件，定位 teachers 数据消费处**

```bash
grep -n "teachers\|campus\.teachers" frontend-next/components/campus/CampusTeachers.tsx
```

- [ ] **步骤 2：改用 extractActiveLinks 提取教师**

把组件中 `campus.teachers` 的直接引用改为：

```typescript
import { extractActiveLinks } from '@/lib/api';

// 在组件内
const teachers = extractActiveLinks<Teacher>(campus.teacher_links, 'teacher');
```

后续渲染逻辑（map teachers）不变。

- [ ] **步骤 3：本地验证**

```bash
cd frontend-next && npm run build 2>&1 | tail -5
```

预期：构建成功无类型错误。

- [ ] **步骤 4：Commit**

```bash
git add frontend-next/components/campus/CampusTeachers.tsx
git commit -m "refactor(frontend): CampusTeachers 改用 extractActiveLinks 经中间表取教师"
```

---

## 任务 13：前端 TeacherCard + TeacherDetail 组件适配

**文件：**
- 修改：`frontend-next/components/team/TeacherCard.tsx`
- 修改：`frontend-next/components/team/TeacherDetail.tsx`

- [ ] **步骤 1：TeacherCard 改用 campus_links**

把 `teacher.campus` 的直接引用改为：

```typescript
import { extractActiveLinks } from '@/lib/api';

const campuses = extractActiveLinks<Campus>(teacher.campus_links, 'campus');
const campusName = campuses[0]?.name || '';
```

- [ ] **步骤 2：TeacherDetail 同理**

TeacherDetail 若展示单个 campus，改为取 `campuses[0]`；若展示多个校区，改为 map。

- [ ] **步骤 3：本地验证 + Commit**

```bash
cd frontend-next && npm run build 2>&1 | tail -5
```

```bash
git add frontend-next/components/team/TeacherCard.tsx frontend-next/components/team/TeacherDetail.tsx
git commit -m "refactor(frontend): TeacherCard/TeacherDetail 改用 campus_links 经中间表"
```

---

## 任务 14：本地全量验证 + 推送

- [ ] **步骤 1：后端测试全量通过**

```bash
cd backend && npx vitest run 2>&1 | tail -10
```

预期：所有测试通过（含迁移脚本 8 个单测）。

- [ ] **步骤 2：前端构建成功**

```bash
cd frontend-next && npm run build 2>&1 | tail -5
```

预期：构建成功。

- [ ] **步骤 3：端到端验证（本地 docker）**

```bash
# 校区列表含教师
curl -s http://localhost:1337/api/campuses | python3 -m json.tool | grep -c teacher_links
# 教师按校区筛选
curl -s "http://localhost:1337/api/teachers?filters[campus][slug]=baiting" | python3 -m json.tool | grep name
# 前端首页可达
curl -s http://localhost:3000/ | head -1
```

- [ ] **步骤 4：推送**

```bash
git push origin main
```

- [ ] **步骤 5：更新 topics.md**

记录 Phase 1 完成状态。

---

## 自检

### 1. 规格覆盖度

逐节对照设计文档 `2026-07-22-entity-relationship-refactor-design.md`：

| 设计文档章节 | 实现任务 | 状态 |
|------------|---------|------|
| 3.1 三张显式中间表 | 任务 1-3（创建 3 个 content type） | ✅ |
| 3.2 中间表统一 Schema（status/sortOrder/notes） | 任务 1-3 schema.json 含全部字段 | ✅ |
| 3.4 父实体字段调整（删旧+加新） | 任务 5（加新）+ 任务 7（删旧） | ✅ |
| 4. 数据迁移 | 任务 6（执行迁移 + 验证） | ✅ |
| 4.3 单元测试 | 已完成（8 个单测，commit a0fbef8） | ✅ |
| 5.1 populate 两层 | 任务 8-10（后端）+ 任务 11-13（前端） | ✅ |
| 5.3 extractActive helper | 任务 11 步骤 1 | ✅ |
| 6. ER 图 | 已在设计文档中（mermaid） | ✅ |
| 7. 部署策略 | 任务 14（本地验证 + push）；客户服务器暂不部署 | ✅ |
| 8. 范围边界 YAGNI | 不做拖拽 UI/冲突检测/effectiveDate | ✅ 符合 |

无遗漏。

### 2. 占位符扫描

无 "TODO"、"待定"、"类似任务 N"。"步骤 1：找到...定义"（任务 10）用 grep 命令定位，非占位符——给出精确命令。✅

### 3. 类型一致性

- `campus_teacher_links`（表名）在任务 1 schema、任务 6 迁移、任务 7 验证中一致 ✅
- `teacher_links` / `campus_links` / `product_links`（字段名）在任务 5 加字段、任务 8-10 controller、任务 11-13 前端中一致 ✅
- `status: 'active'` 在迁移脚本、controller filters、前端 helper 中一致 ✅
- `sortOrder` 字段名（schema 用 camelCase `sortOrder`，DB 列 `sort_order`）一致 ✅
- `extractActiveLinks` 函数名在任务 11 定义、任务 12-13 引用中一致 ✅
