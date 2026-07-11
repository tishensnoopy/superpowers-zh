# 首页区块实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现首页 4 个区块（核心优势、课程体系、师资团队、预约试听表单），数据从 Strapi 动态获取，预约表单含完整后端 API。

**架构：** 三阶段混合策略——阶段一串行填充后端数据与 API 骨架；阶段二并行 TDD 实现 3 个展示组件；阶段三串行实现预约表单业务逻辑与集成。

**技术栈：** Strapi v5（后端 CMS）、React 18 + TypeScript + Vite（前端）、SQLite（数据库）、vitest + @testing-library/react（前端测试，需安装）

**规格文档：** [2026-07-12-homepage-sections-design.md](file:///home/tishensnoopy/project/superpowers-zh/docs/superpowers/specs/2026-07-12-homepage-sections-design.md)

---

## 文件结构

### 后端（Strapi）

| 文件 | 操作 | 职责 |
|------|------|------|
| `backend/src/components/common/advantage.json` | 修改 | 添加 color、bgColor 字段 |
| `backend/src/api/appointment/content-types/appointment/schema.json` | 创建 | 预约数据模型 |
| `backend/src/api/appointment/controllers/appointment.ts` | 创建 | 预约控制器（含验证、频率限制） |
| `backend/src/api/appointment/services/appointment.ts` | 创建 | 预约服务层 |
| `backend/src/api/appointment/routes/appointment.ts` | 创建 | 预约路由 |
| `backend/scripts/seed-homepage-sections.js` | 创建 | 填充示例数据的脚本 |

### 前端（React）

| 文件 | 操作 | 职责 |
|------|------|------|
| `frontend/package.json` | 修改 | 添加 vitest、@testing-library/react 测试依赖 |
| `frontend/vitest.config.ts` | 创建 | vitest 配置 |
| `frontend/src/test/setup.ts` | 创建 | 测试环境配置 |
| `frontend/src/components/sections/Advantages.tsx` | 修改 | 核心优势组件（TDD） |
| `frontend/src/components/sections/ProductGrid.tsx` | 修改 | 课程体系组件（TDD） |
| `frontend/src/components/sections/Team.tsx` | 修改 | 师资团队组件（TDD） |
| `frontend/src/components/sections/ContactForm.tsx` | 修改 | 预约表单组件（TDD） |
| `frontend/src/components/sections/__tests__/Advantages.test.tsx` | 创建 | 核心优势组件测试 |
| `frontend/src/components/sections/__tests__/ProductGrid.test.tsx` | 创建 | 课程体系组件测试 |
| `frontend/src/components/sections/__tests__/Team.test.tsx` | 创建 | 师资团队组件测试 |
| `frontend/src/components/sections/__tests__/ContactForm.test.tsx` | 创建 | 预约表单组件测试 |
| `frontend/src/lib/api.ts` | 修改 | 添加 createAppointment 函数 |

---

## 阶段一：后端数据填充与 API 骨架（串行）

### 任务 1：修复 common.advantage schema

**文件：**
- 修改：`backend/src/components/common/advantage.json`

- [ ] **步骤 1：添加 color 和 bgColor 字段**

将 `backend/src/components/common/advantage.json` 的 `attributes` 部分修改为：

```json
{
  "attributes": {
    "title": {
      "type": "string",
      "required": true,
      "maxLength": 200,
      "description": "Advantage title"
    },
    "description": {
      "type": "string",
      "maxLength": 500,
      "description": "Advantage description"
    },
    "icon": {
      "type": "string",
      "maxLength": 100,
      "description": "Icon name"
    },
    "color": {
      "type": "string",
      "maxLength": 20,
      "description": "Icon color (hex)",
      "default": "#F5851F"
    },
    "bgColor": {
      "type": "string",
      "maxLength": 20,
      "description": "Icon background color (hex)",
      "default": "#FFF3E5"
    }
  }
}
```

- [ ] **步骤 2：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add backend/src/components/common/advantage.json
git commit -m "feat(backend): 添加 advantage 组件 color/bgColor 字段"
```

---

### 任务 2：重新构建 Strapi 使 schema 变更生效

- [ ] **步骤 1：构建后端**

运行：
```bash
cd /home/tishensnoopy/project/superpowers-zh/backend && npm run build
```
预期：构建成功，无错误。

- [ ] **步骤 2：重启后端服务**

如果后端正在运行，先停止（Ctrl+C），然后重新启动：
```bash
cd /home/tishensnoopy/project/superpowers-zh/backend && npm run develop
```
预期：Strapi 启动成功，日志中无 schema 错误。

---

### 任务 3：创建 appointment API 骨架

**文件：**
- 创建：`backend/src/api/appointment/content-types/appointment/schema.json`
- 创建：`backend/src/api/appointment/controllers/appointment.ts`
- 创建：`backend/src/api/appointment/services/appointment.ts`
- 创建：`backend/src/api/appointment/routes/appointment.ts`

- [ ] **步骤 1：创建 appointment schema**

创建 `backend/src/api/appointment/content-types/appointment/schema.json`：

```json
{
  "kind": "contentType",
  "collectionName": "appointments",
  "info": {
    "singularName": "appointment",
    "pluralName": "appointments",
    "displayName": "预约试听",
    "description": "预约试听表单提交",
    "icon": "Calendar"
  },
  "options": {
    "draftAndPublish": false
  },
  "attributes": {
    "childName": {
      "type": "string",
      "required": true,
      "maxLength": 100,
      "description": "孩子姓名"
    },
    "parentName": {
      "type": "string",
      "required": true,
      "maxLength": 100,
      "description": "家长姓名"
    },
    "phone": {
      "type": "string",
      "required": true,
      "maxLength": 20,
      "description": "联系电话"
    },
    "age": {
      "type": "integer",
      "description": "孩子年龄"
    },
    "course": {
      "type": "string",
      "maxLength": 100,
      "description": "感兴趣的课程"
    },
    "preferredDate": {
      "type": "date",
      "description": "期望日期"
    },
    "preferredTimeSlot": {
      "type": "enumeration",
      "enum": ["morning", "afternoon", "evening"],
      "description": "期望时段"
    },
    "campus": {
      "type": "string",
      "maxLength": 100,
      "description": "期望校区"
    },
    "message": {
      "type": "text",
      "description": "备注"
    },
    "status": {
      "type": "enumeration",
      "enum": ["pending", "confirmed", "completed", "cancelled"],
      "default": "pending",
      "description": "预约状态"
    },
    "ipAddress": {
      "type": "string",
      "maxLength": 45,
      "description": "提交者 IP 地址"
    },
    "userAgent": {
      "type": "string",
      "maxLength": 500,
      "description": "提交者浏览器信息"
    }
  }
}
```

- [ ] **步骤 2：创建 controller**

创建 `backend/src/api/appointment/controllers/appointment.ts`：

```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::appointment.appointment', ({ strapi }) => ({
  async create(ctx) {
    console.log('[Appointment] create() called');

    const { childName, parentName, phone } = ctx.request.body.data || {};

    if (!childName || !parentName || !phone) {
      return ctx.badRequest('Missing required fields: childName, parentName, phone');
    }

    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return ctx.badRequest('Invalid phone number format');
    }

    const clientIp = ctx.request.client?.ip || ctx.request.ip || 'unknown';
    const userAgent = ctx.request.headers['user-agent'] || 'unknown';

    const recentCount = await strapi.db.query('api::appointment.appointment').count({
      where: {
        ipAddress: clientIp,
        createdAt: { $gte: new Date(Date.now() - 3600000) },
      },
    });

    if (recentCount >= 5) {
      return ctx.tooManyRequests('Rate limit exceeded: max 5 submissions per hour');
    }

    ctx.request.body.data = {
      ...ctx.request.body.data,
      status: 'pending',
      ipAddress: clientIp,
      userAgent: userAgent,
    };

    const result = await super.create(ctx);
    console.log('[Appointment] create() completed, id:', result.data?.id);
    return result;
  },

  async find(ctx) {
    console.log('[Appointment] find() called');
    return super.find(ctx);
  },

  async findOne(ctx) {
    console.log('[Appointment] findOne() called, id:', ctx.params.id);
    return super.findOne(ctx);
  },
}));
```

- [ ] **步骤 3：创建 service**

创建 `backend/src/api/appointment/services/appointment.ts`：

```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::appointment.appointment');
```

- [ ] **步骤 4：创建 routes**

创建 `backend/src/api/appointment/routes/appointment.ts`：

```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::appointment.appointment', {
  config: {
    create: {
      auth: false,
      policies: [],
      middlewares: [],
    },
    find: {
      auth: true,
    },
    findOne: {
      auth: true,
    },
  },
  only: ['create', 'find', 'findOne'],
});
```

- [ ] **步骤 5：重新构建并重启 Strapi**

```bash
cd /home/tishensnoopy/project/superpowers-zh/backend && npm run build
```
然后重启 `npm run develop`。

- [ ] **步骤 6：验证接口可访问**

运行：
```bash
curl -s -X POST http://localhost:1337/api/appointments \
  -H "Content-Type: application/json" \
  -d '{"data":{}}'
```
预期：返回 400 错误（缺少必填字段），不是 404。

- [ ] **步骤 7：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add backend/src/api/appointment/
git commit -m "feat(backend): 创建 appointment API 骨架与验证逻辑"
```

---

### 任务 4：创建示例数据填充脚本

**文件：**
- 创建：`backend/scripts/seed-homepage-sections.js`

- [ ] **步骤 1：创建数据填充脚本**

创建 `backend/scripts/seed-homepage-sections.js`。这个脚本通过 better-sqlite3 直接操作数据库，填充：
- 4 个 product-category
- 4 个 product（关联分类）
- 4 个 product-spec
- 首页 page 记录添加 4 个 section 区块（advantages、product-grid、team、contact-form）

```javascript
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../.tmp/data.db');
const db = new Database(dbPath);

console.log('=== 开始填充首页区块数据 ===\n');

// 生成 documentId
function genDocId() {
  return 'doc_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// 1. 创建 product-categories
console.log('1. 创建 product-categories...');
const catNames = ['语言启蒙', '数学思维', '英语口语', '综合素养'];
const catIds = [];
for (const name of catNames) {
  const docId = genDocId();
  db.prepare(`INSERT INTO product_categories (document_id, name, slug, created_at, updated_at, published_at)
    VALUES (?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`).run(docId, name, name);
  const row = db.prepare('SELECT id FROM product_categories WHERE document_id = ?').get(docId);
  catIds.push(row.id);
  console.log(`   ✓ ${name} (id: ${row.id})`);
}

// 2. 创建 product-specs
console.log('\n2. 创建 product-specs...');
const specsData = [
  { name: '课时', value: '48课时' },
  { name: '班额', value: '小班12人' },
  { name: '适合年龄', value: '4-6岁' },
  { name: '课程周期', value: '6个月' },
];
const specIds = [];
for (const spec of specsData) {
  const docId = genDocId();
  db.prepare(`INSERT INTO product_specs (document_id, name, value, created_at, updated_at, published_at)
    VALUES (?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`).run(docId, spec.name, spec.value);
  const row = db.prepare('SELECT id FROM product_specs WHERE document_id = ?').get(docId);
  specIds.push(row.id);
  console.log(`   ✓ ${spec.name}: ${spec.value} (id: ${row.id})`);
}

// 3. 创建 products
console.log('\n3. 创建 products...');
const productsData = [
  { name: '语言启蒙', slug: 'language', sku: 'LANG001', shortDesc: '培养孩子语言表达能力与阅读兴趣', desc: '通过绘本阅读、儿歌律动、故事讲述等方式，系统培养孩子的语言表达能力、阅读兴趣和前书写能力。', catIdx: 0 },
  { name: '数学思维', slug: 'math', sku: 'MATH001', shortDesc: '建立数学概念与逻辑推理能力', desc: '通过操作教具、游戏互动、生活情境等方式，帮助孩子建立数、量、形、空间等数学概念。', catIdx: 1 },
  { name: '英语口语', slug: 'english', sku: 'ENG001', shortDesc: '浸泡式英语环境培养语感', desc: '通过英文儿歌、情景对话、绘本故事等沉浸式教学方式，培养孩子英语语感和口语表达自信。', catIdx: 2 },
  { name: '综合素养', slug: 'comprehensive', sku: 'COMP001', shortDesc: '全面发展社交与生活能力', desc: '通过社交游戏、生活实践、艺术创作等多元化活动，培养孩子的社交能力、生活自理能力和创造力。', catIdx: 3 },
];
const productIds = [];
for (const p of productsData) {
  const docId = genDocId();
  db.prepare(`INSERT INTO products (document_id, name, slug, sku, short_description, description, is_in_stock, is_featured, stock, created_at, updated_at, published_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, 0, 100, datetime('now'), datetime('now'), datetime('now'))`).run(
    docId, p.name, p.slug, p.sku, p.shortDesc, p.desc
  );
  const row = db.prepare('SELECT id FROM products WHERE document_id = ?').get(docId);
  productIds.push(row.id);
  console.log(`   ✓ ${p.name} (id: ${row.id})`);

  // 关联分类
  db.prepare(`INSERT INTO products_product_categories_links (product_id, product_category_id)
    VALUES (?, ?)`).run(row.id, catIds[p.catIdx]);

  // 关联所有 specs
  for (const specId of specIds) {
    db.prepare(`INSERT INTO products_product_specs_links (product_id, product_spec_id)
      VALUES (?, ?)`).run(row.id, specId);
  }
}

// 4. 更新首页 — 添加 section 区块
console.log('\n4. 更新首页 sections...');

// 查找首页 page
const homepage = db.prepare('SELECT id, document_id FROM pages WHERE is_homepage = 1 LIMIT 1').get();
if (!homepage) {
  console.error('   ✗ 未找到首页 page 记录');
  process.exit(1);
}
console.log(`   首页 page: id=${homepage.id}, documentId=${homepage.document_id}`);

// 4a. 创建 advantages section
console.log('   创建 advantages section...');
const advDocId = genDocId();
db.prepare(`INSERT INTO components_section_advantages (document_id, title, description, created_at, updated_at, published_at)
  VALUES (?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`).run(
  advDocId,
  '4大核心优势，给孩子最好的起点',
  '我们深知每位家长对孩子教育的期望与用心，以专业、安全、温暖的教育环境陪伴每一个孩子成长。'
);
const advSectionId = db.prepare('SELECT id FROM components_section_advantages WHERE document_id = ?').get(advDocId).id;

// 创建 4 个 advantage items
const advantagesData = [
  { title: '专业师资', desc: '8年幼小衔接教学经验，所有教师均持证上岗，定期培训提升教学水平。', icon: 'GraduationCap', color: '#F5851F', bgColor: '#FFF3E5' },
  { title: '科学课程', desc: '对标小学课程标准，由资深教研团队研发，让孩子学得快乐、学得扎实。', icon: 'BookOpen', color: '#2563EB', bgColor: '#EFF6FF' },
  { title: '安全环境', desc: '全程监控覆盖，安全防护到位，每班配备两名教师确保孩子安全。', icon: 'Shield', color: '#059669', bgColor: '#ECFDF5' },
  { title: '小班教学', desc: '每班不超过12人，确保每个孩子都能得到充分关注和个性化指导。', icon: 'Users', color: '#7C3AED', bgColor: '#F5F3FF' },
];
for (const adv of advantagesData) {
  const itemDocId = genDocId();
  db.prepare(`INSERT INTO components_common_advantages (document_id, title, description, icon, color, bg_color, created_at, updated_at, published_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`).run(
    itemDocId, adv.title, adv.desc, adv.icon, adv.color, adv.bgColor
  );
  const itemId = db.prepare('SELECT id FROM components_common_advantages WHERE document_id = ?').get(itemDocId).id;
  // 关联到 advantages section
  db.prepare(`INSERT INTO components_section_advantages_advantages_links (advantage_id, section_advantage_id, section_advantage_order)
    VALUES (?, ?, ?)`).run(itemId, advSectionId, advantagesData.indexOf(adv));
}
console.log(`   ✓ advantages section (id: ${advSectionId})`);

// 4b. 创建 team section
console.log('   创建 team section...');
const teamDocId = genDocId();
db.prepare(`INSERT INTO components_section_teams (document_id, title, description, created_at, updated_at, published_at)
  VALUES (?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`).run(
  teamDocId,
  '资深教师团队',
  '8年沉淀，打造出一支专业、有爱、懂孩子的教师队伍。'
);
const teamSectionId = db.prepare('SELECT id FROM components_section_teams WHERE document_id = ?').get(teamDocId).id;

const membersData = [
  { name: '王老师', position: '教学总监', bio: '北京师范大学学前教育硕士，12年幼教经验，专注幼小衔接课程研发。' },
  { name: '李老师', position: '语言启蒙组组长', bio: '华东师范大学汉语言文学专业，8年儿童语言教学经验。' },
  { name: '张老师', position: '数学思维组组长', bio: '南京师范大学数学教育专业，擅长将抽象概念游戏化。' },
  { name: '陈老师', position: '英语口语组组长', bio: '上海外国语大学英语教育硕士，TESOL认证教师。' },
];
for (const m of membersData) {
  const itemDocId = genDocId();
  db.prepare(`INSERT INTO components_common_team_members (document_id, name, position, bio, created_at, updated_at, published_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`).run(
    itemDocId, m.name, m.position, m.bio
  );
  const itemId = db.prepare('SELECT id FROM components_common_team_members WHERE document_id = ?').get(itemDocId).id;
  db.prepare(`INSERT INTO components_section_teams_members_links (team_member_id, section_team_id, section_team_order)
    VALUES (?, ?, ?)`).run(itemId, teamSectionId, membersData.indexOf(m));
}
console.log(`   ✓ team section (id: ${teamSectionId})`);

// 4c. 创建 contact-form section
console.log('   创建 contact-form section...');
const cfDocId = genDocId();
db.prepare(`INSERT INTO components_section_contact_forms (document_id, title, description, submit_text, success_message, created_at, updated_at, published_at)
  VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`).run(
  cfDocId,
  '预约免费试听',
  '填写下方表单，我们将尽快联系您安排试听课程',
  '立即预约',
  '预约成功！我们将在24小时内联系您确认时间。'
);
const cfSectionId = db.prepare('SELECT id FROM components_section_contact_forms WHERE document_id = ?').get(cfDocId).id;

const fieldsData = [
  { label: '孩子姓名', name: 'childName', type: 'text', required: true, placeholder: '请输入孩子姓名', options: null },
  { label: '家长姓名', name: 'parentName', type: 'text', required: true, placeholder: '请输入家长姓名', options: null },
  { label: '联系电话', name: 'phone', type: 'phone', required: true, placeholder: '请输入手机号码', options: null },
  { label: '孩子年龄', name: 'age', type: 'text', required: false, placeholder: '请输入孩子年龄', options: null },
  { label: '感兴趣的课程', name: 'course', type: 'select', required: false, placeholder: '请选择课程', options: JSON.stringify(['语言启蒙', '数学思维', '英语口语', '综合素养']) },
  { label: '期望时段', name: 'preferredTimeSlot', type: 'select', required: false, placeholder: '请选择时段', options: JSON.stringify([{value:'morning',label:'上午'},{value:'afternoon',label:'下午'},{value:'evening',label:'晚上'}]) },
  { label: '备注', name: 'message', type: 'textarea', required: false, placeholder: '其他需要说明的事项', options: null },
];
for (const f of fieldsData) {
  const itemDocId = genDocId();
  db.prepare(`INSERT INTO components_common_form_fields (document_id, label, name, type, required, placeholder, options, created_at, updated_at, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`).run(
    itemDocId, f.label, f.name, f.type, f.required ? 1 : 0, f.placeholder, f.options
  );
  const itemId = db.prepare('SELECT id FROM components_common_form_fields WHERE document_id = ?').get(itemDocId).id;
  db.prepare(`INSERT INTO components_section_contact_forms_fields_links (form_field_id, section_contact_form_id, section_contact_form_order)
    VALUES (?, ?, ?)`).run(itemId, cfSectionId, fieldsData.indexOf(f));
}
console.log(`   ✓ contact-form section (id: ${cfSectionId})`);

// 4d. 将 sections 添加到首页 page 的 dynamic zone
console.log('   将 sections 关联到首页...');

// 查询现有的 sections
const existingSections = db.prepare(`
  SELECT component_type, component_id, `order` FROM pages_sections_links WHERE entity_id = ?
`).all(homepage.id);
console.log(`   现有 sections: ${existingSections.length} 个`);

// 添加 advantages section
const nextOrder = existingSections.length;
db.prepare(`INSERT INTO pages_sections_links (entity_id, component_type, component_id, `order`)
  VALUES (?, 'section.advantages', ?, ?)`).run(homepage.id, advSectionId, nextOrder);

// 添加 product-grid section — 需要先创建 product-grid component 记录
const pgDocId = genDocId();
db.prepare(`INSERT INTO components_section_product_grids (document_id, title, description, columns, show_filter, created_at, updated_at, published_at)
  VALUES (?, ?, ?, '3', 0, datetime('now'), datetime('now'), datetime('now'))`).run(
  pgDocId, '精品课程体系', '由资深教研团队研发，严格对标小学课程标准，让孩子学得快乐、学得扎实。'
);
const pgSectionId = db.prepare('SELECT id FROM components_section_product_grids WHERE document_id = ?').get(pgDocId).id;

// 关联 4 个 products 到 product-grid
for (const pid of productIds) {
  db.prepare(`INSERT INTO components_section_product_grids_products_links (product_id, section_product_grid_id)
    VALUES (?, ?)`).run(pid, pgSectionId);
}
db.prepare(`INSERT INTO pages_sections_links (entity_id, component_type, component_id, `order`)
  VALUES (?, 'section.product-grid', ?, ?)`).run(homepage.id, pgSectionId, nextOrder + 1);

// 添加 team section
db.prepare(`INSERT INTO pages_sections_links (entity_id, component_type, component_id, `order`)
  VALUES (?, 'section.team', ?, ?)`).run(homepage.id, teamSectionId, nextOrder + 2);

// 添加 contact-form section
db.prepare(`INSERT INTO pages_sections_links (entity_id, component_type, component_id, `order`)
  VALUES (?, 'section.contact-form', ?, ?)`).run(homepage.id, cfSectionId, nextOrder + 3);

console.log(`   ✓ 已添加 4 个 section 到首页`);

// 5. 验证
console.log('\n5. 验证数据...');
const finalSections = db.prepare(`
  SELECT component_type, component_id, `order` FROM pages_sections_links WHERE entity_id = ? ORDER BY `order`
`).all(homepage.id);
console.log(`   首页 sections: ${finalSections.length} 个`);
for (const s of finalSections) {
  console.log(`   ${s.order}: ${s.component_type} (id: ${s.component_id})`);
}

console.log('\n=== 数据填充完成 ===');
db.close();
```

- [ ] **步骤 2：运行脚本**

```bash
cd /home/tishensnoopy/project/superpowers-zh/backend && node scripts/seed-homepage-sections.js
```
预期：输出显示创建了 4 个分类、4 个规格、4 个产品、4 个 section 区块，并关联到首页。

- [ ] **步骤 3：验证 API 返回**

```bash
curl -s http://localhost:1337/api/pages?populate[sections][populate]=* | python3 -c "
import json, sys
data = json.load(sys.stdin)
for page in data['data']:
    if page.get('attributes', {}).get('isHomepage'):
        sections = page['attributes'].get('sections', [])
        print(f'首页 sections: {len(sections)} 个')
        for s in sections:
            print(f'  - {s.__component}')
"
```
预期：显示 5 个 section（hero + advantages + product-grid + team + contact-form）。

- [ ] **步骤 4：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add backend/scripts/seed-homepage-sections.js
git commit -m "feat(backend): 创建首页区块示例数据填充脚本"
```

---

### 任务 5：阶段一验证检查点

- [ ] **步骤 1：验证所有区块 API 返回格式正确**

```bash
curl -s http://localhost:1337/api/pages?populate[sections][populate]=* | python3 -c "
import json, sys
data = json.load(sys.stdin)
for page in data['data']:
    if page.get('attributes', {}).get('isHomepage'):
        sections = page['attributes'].get('sections', [])
        for s in sections:
            comp = s.__component
            attrs = {k:v for k,v in s.items() if k not in ['id','__component']}
            print(f'{comp}: keys={list(attrs.keys())}')
"
```
预期输出包含：
- `section.hero`: keys 含 title, subtitle, description 等
- `section.advantages`: keys 含 title, description, advantages
- `section.product-grid`: keys 含 title, description, products
- `section.team`: keys 含 title, description, members
- `section.contact-form`: keys 含 title, description, fields, submitText

- [ ] **步骤 2：验证 appointment 接口**

```bash
curl -s -X POST http://localhost:1337/api/appointments \
  -H "Content-Type: application/json" \
  -d '{"data":{"childName":"测试","parentName":"测试","phone":"13800138000"}}' | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin), indent=2))"
```
预期：返回成功创建的 appointment 记录，包含 id 和 status=pending。

```bash
curl -s -X POST http://localhost:1337/api/appointments \
  -H "Content-Type: application/json" \
  -d '{"data":{}}' | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin), indent=2))"
```
预期：返回 400 错误，提示缺少必填字段。

---

## 阶段二：前端展示组件 TDD（并行）

### 任务 6：安装前端测试框架（串行前置）

**文件：**
- 修改：`frontend/package.json`
- 创建：`frontend/vitest.config.ts`
- 创建：`frontend/src/test/setup.ts`

- [ ] **步骤 1：安装测试依赖**

```bash
cd /home/tishensnoopy/project/superpowers-zh/frontend && npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **步骤 2：创建 vitest 配置**

创建 `frontend/vitest.config.ts`：

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **步骤 3：创建测试 setup**

创建 `frontend/src/test/setup.ts`：

```typescript
import '@testing-library/jest-dom';
```

- [ ] **步骤 4：添加 test script 到 package.json**

在 `frontend/package.json` 的 `scripts` 中添加：
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **步骤 5：验证测试框架可运行**

```bash
cd /home/tishensnoopy/project/superpowers-zh/frontend && npx vitest run --passWithNoTests
```
预期：无错误，输出 "No test files found"。

- [ ] **步骤 6：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend/package.json frontend/vitest.config.ts frontend/src/test/setup.ts
git commit -m "chore(frontend): 安装 vitest 测试框架"
```

---

### 任务 7、8、9：并行实现 3 个展示组件（TDD）

> **并行执行说明：** 这三个任务满足并行条件——各自修改独立的组件文件、无数据依赖、复杂度相近、有独立验证方式。使用 `dispatching-parallel-agents` skill 分发给 3 个子代理执行。

> **✅ 阶段二完成（2026-07-12）：** 三个组件 TDD 全部完成，14 个测试通过。修复了 Strapi v5 repeatable component 返回直接数组格式（非 `{data: [...]}`）的兼容性问题。浏览器验证 5 个区块全部正常渲染。

---

### 任务 7：Advantages 组件 TDD（并行）

**文件：**
- 创建：`frontend/src/components/sections/__tests__/Advantages.test.tsx`
- 修改：`frontend/src/components/sections/Advantages.tsx`

- [ ] **步骤 1：编写失败的测试**

创建 `frontend/src/components/sections/__tests__/Advantages.test.tsx`：

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Advantages from '../Advantages';

const mockSection = {
  __component: 'section.advantages',
  id: 1,
  title: '为什么选择我们',
  description: '我们深知每位家长对孩子教育的期望与用心',
  advantages: {
    data: [
      { id: 1, attributes: { title: '专业师资', description: '8年幼小衔接教学经验', icon: 'GraduationCap', color: '#F5851F', bgColor: '#FFF3E5' } },
      { id: 2, attributes: { title: '科学课程', description: '对标小学课程标准', icon: 'BookOpen', color: '#2563EB', bgColor: '#EFF6FF' } },
      { id: 3, attributes: { title: '安全环境', description: '全程监控覆盖', icon: 'Shield', color: '#059669', bgColor: '#ECFDF5' } },
      { id: 4, attributes: { title: '小班教学', description: '每班不超过12人', icon: 'Users', color: '#7C3AED', bgColor: '#F5F3FF' } },
    ],
  },
};

describe('Advantages 组件', () => {
  it('渲染区块标题', () => {
    render(<Advantages section={mockSection} />);
    expect(screen.getByText('为什么选择我们')).toBeInTheDocument();
  });

  it('渲染区块描述', () => {
    render(<Advantages section={mockSection} />);
    expect(screen.getByText(/我们深知每位家长/)).toBeInTheDocument();
  });

  it('渲染所有优势项', () => {
    render(<Advantages section={mockSection} />);
    expect(screen.getByText('专业师资')).toBeInTheDocument();
    expect(screen.getByText('科学课程')).toBeInTheDocument();
    expect(screen.getByText('安全环境')).toBeInTheDocument();
    expect(screen.getByText('小班教学')).toBeInTheDocument();
  });

  it('空数据时显示默认内容', () => {
    const emptySection = { __component: 'section.advantages', id: 2, title: '', description: '', advantages: { data: [] } };
    render(<Advantages section={emptySection} />);
    expect(screen.getByText('为什么选择我们')).toBeInTheDocument();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd /home/tishensnoopy/project/superpowers-zh/frontend && npx vitest run src/components/sections/__tests__/Advantages.test.tsx
```
预期：FAIL（因为现有组件的标题是硬编码的 "4大核心优势"，不是从 section.title 读取）。

- [ ] **步骤 3：修复 Advantages 组件**

修改 `frontend/src/components/sections/Advantages.tsx`，将硬编码标题改为从 section 读取：

```tsx
import { Award, BookOpen, ChevronRight, GraduationCap, Shield, Users } from 'lucide-react';
import type { Section } from '../../lib/api';

const iconMap: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  GraduationCap,
  Users,
  BookOpen,
  Shield,
};

export default function Advantages({ section }: { section: Section }) {
  const { title, description, advantages } = section;

  return (
    <section className="py-24 bg-background">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFF3E5] text-[#F5851F] text-sm font-medium mb-5">
            <Award size={14} />
            为什么选择我们
          </div>
          <h2
            className="text-[#1C2B3A] mb-4"
            style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif", fontSize: '2.25rem', fontWeight: 800 }}
          >
            {title || '4大核心优势，给孩子最好的起点'}
          </h2>
          <p className="text-muted-foreground text-base max-w-[560px] mx-auto leading-relaxed">
            {description || '我们深知每位家长对孩子教育的期望与用心，以专业、安全、温暖的教育环境陪伴每一个孩子成长。'}
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {(advantages?.data || []).map((adv: any) => {
            const advAttrs = adv.attributes || adv;
            const Icon = iconMap[advAttrs.icon] || Award;
            return (
              <div key={adv.id} className="col-span-12 sm:col-span-6 lg:col-span-3 group">
                <div className="h-full bg-card rounded-2xl p-8 border border-border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110"
                    style={{ background: advAttrs.bgColor || '#FFF3E5' }}
                  >
                    <Icon size={26} style={{ color: advAttrs.color || '#F5851F' }} />
                  </div>
                  <h3
                    className="text-xl font-bold text-[#1C2B3A] mb-3"
                    style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
                  >
                    {advAttrs.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed flex-1">{advAttrs.description}</p>
                  <div
                    className="mt-6 flex items-center gap-1 text-sm font-medium transition-colors duration-200"
                    style={{ color: advAttrs.color || '#F5851F' }}
                  >
                    了解详情 <ChevronRight size={15} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd /home/tishensnoopy/project/superpowers-zh/frontend && npx vitest run src/components/sections/__tests__/Advantages.test.tsx
```
预期：4 个测试全部 PASS。

- [ ] **步骤 5：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend/src/components/sections/Advantages.tsx frontend/src/components/sections/__tests__/Advantages.test.tsx
git commit -m "feat(frontend): Advantages 组件 TDD 实现"
```

---

### 任务 8：ProductGrid 组件 TDD（并行）

**文件：**
- 创建：`frontend/src/components/sections/__tests__/ProductGrid.test.tsx`
- 修改：`frontend/src/components/sections/ProductGrid.tsx`

- [ ] **步骤 1：编写失败的测试**

创建 `frontend/src/components/sections/__tests__/ProductGrid.test.tsx`：

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProductGrid from '../ProductGrid';

const mockSection = {
  __component: 'section.product-grid',
  id: 1,
  title: '精品课程体系',
  description: '由资深教研团队研发',
  products: {
    data: [
      {
        id: 1,
        attributes: {
          name: '语言启蒙',
          shortDescription: '培养语言表达能力',
          description: '通过绘本阅读培养语言能力',
          categories: { data: [{ id: 1, attributes: { name: '语言启蒙' } }] },
          specs: {
            data: [
              { id: 1, attributes: { name: '课时', value: '48课时' } },
              { id: 2, attributes: { name: '班额', value: '小班12人' } },
            ],
          },
        },
      },
      {
        id: 2,
        attributes: {
          name: '数学思维',
          shortDescription: '建立数学概念',
          description: '通过操作教具建立数学概念',
          categories: { data: [{ id: 2, attributes: { name: '数学思维' } }] },
          specs: { data: [] },
        },
      },
    ],
  },
};

describe('ProductGrid 组件', () => {
  it('渲染区块标题', () => {
    render(<ProductGrid section={mockSection} />);
    expect(screen.getByText('精品课程体系')).toBeInTheDocument();
  });

  it('渲染产品名称', () => {
    render(<ProductGrid section={mockSection} />);
    expect(screen.getByText('语言启蒙')).toBeInTheDocument();
    expect(screen.getByText('数学思维')).toBeInTheDocument();
  });

  it('渲染产品简短描述', () => {
    render(<ProductGrid section={mockSection} />);
    expect(screen.getByText('培养语言表达能力')).toBeInTheDocument();
  });

  it('渲染产品规格', () => {
    render(<ProductGrid section={mockSection} />);
    expect(screen.getByText(/48课时/)).toBeInTheDocument();
    expect(screen.getByText(/小班12人/)).toBeInTheDocument();
  });

  it('空数据时显示默认内容', () => {
    const emptySection = { __component: 'section.product-grid', id: 2, title: '', description: '', products: { data: [] } };
    render(<ProductGrid section={emptySection} />);
    expect(screen.getByText('科学课程，全面衔接小学学习')).toBeInTheDocument();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd /home/tishensnoopy/project/superpowers-zh/frontend && npx vitest run src/components/sections/__tests__/ProductGrid.test.tsx
```
预期：FAIL（现有组件标题读取方式与测试期望不一致）。

- [ ] **步骤 3：修复 ProductGrid 组件**

修改 `frontend/src/components/sections/ProductGrid.tsx`：

```tsx
import { BookOpen, CheckCircle, Clock } from 'lucide-react';
import type { Section } from '../../lib/api';

export default function ProductGrid({ section }: { section: Section }) {
  const { title, description, products } = section;

  return (
    <section className="py-24" style={{ background: 'linear-gradient(180deg, #F8F9FF 0%, #FFFCF8 100%)' }}>
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EFF6FF] text-[#2563EB] text-sm font-medium mb-5">
            <BookOpen size={14} />
            精品课程体系
          </div>
          <h2
            className="text-[#1C2B3A] mb-4"
            style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif", fontSize: '2.25rem', fontWeight: 800 }}
          >
            {title || '科学课程，全面衔接小学学习'}
          </h2>
          <p className="text-muted-foreground text-base max-w-[560px] mx-auto leading-relaxed">
            {description || '由资深教研团队研发，严格对标小学课程标准，让孩子学得快乐、学得扎实。'}
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {(products?.data || []).map((product: any) => {
            const p = product.attributes || product;
            const category = p.categories?.data?.[0];
            const catAttrs = category ? (category.attributes || category) : null;
            return (
              <div key={product.id} className="col-span-12 sm:col-span-6 lg:col-span-3">
                <div className="h-full bg-card rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col">
                  <div className="p-6 border-b border-border" style={{ background: '#EFF6FF' }}>
                    <div className="text-4xl mb-4">📚</div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold text-[#1C2B3A]" style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}>
                        {p.name}
                      </h3>
                    </div>
                    {catAttrs && (
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ color: '#2563EB', background: 'rgba(37,99,235,0.1)' }}>
                        {catAttrs.name}
                      </span>
                    )}
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                      {p.shortDescription || p.description}
                    </p>
                    {p.specs?.data && p.specs.data.length > 0 && (
                      <ul className="space-y-2 flex-1">
                        {p.specs.data.map((spec: any) => {
                          const s = spec.attributes || spec;
                          return (
                            <li key={spec.id} className="flex items-center gap-2 text-sm text-[#4A5568]">
                              <CheckCircle size={14} style={{ color: '#2563EB' }} className="shrink-0" />
                              {s.name}: {s.value}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <div className="mt-6 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock size={12} /> 查看详情
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd /home/tishensnoopy/project/superpowers-zh/frontend && npx vitest run src/components/sections/__tests__/ProductGrid.test.tsx
```
预期：5 个测试全部 PASS。

- [ ] **步骤 5：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend/src/components/sections/ProductGrid.tsx frontend/src/components/sections/__tests__/ProductGrid.test.tsx
git commit -m "feat(frontend): ProductGrid 组件 TDD 实现"
```

---

### 任务 9：Team 组件 TDD（并行）

**文件：**
- 创建：`frontend/src/components/sections/__tests__/Team.test.tsx`
- 修改：`frontend/src/components/sections/Team.tsx`

- [ ] **步骤 1：编写失败的测试**

创建 `frontend/src/components/sections/__tests__/Team.test.tsx`：

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Team from '../Team';

const mockSection = {
  __component: 'section.team',
  id: 1,
  title: '资深教师团队',
  description: '8年沉淀，打造出一支专业教师队伍',
  members: {
    data: [
      { id: 1, attributes: { name: '王老师', position: '教学总监', bio: '北京师范大学学前教育硕士' } },
      { id: 2, attributes: { name: '李老师', position: '语言启蒙组组长', bio: '8年儿童语言教学经验' } },
    ],
  },
};

describe('Team 组件', () => {
  it('渲染区块标题', () => {
    render(<Team section={mockSection} />);
    expect(screen.getByText('资深教师团队')).toBeInTheDocument();
  });

  it('渲染成员姓名', () => {
    render(<Team section={mockSection} />);
    expect(screen.getByText('王老师')).toBeInTheDocument();
    expect(screen.getByText('李老师')).toBeInTheDocument();
  });

  it('渲染成员职位', () => {
    render(<Team section={mockSection} />);
    expect(screen.getByText('教学总监')).toBeInTheDocument();
    expect(screen.getByText('语言启蒙组组长')).toBeInTheDocument();
  });

  it('渲染成员简介', () => {
    render(<Team section={mockSection} />);
    expect(screen.getByText(/北京师范大学/)).toBeInTheDocument();
  });

  it('空数据时显示默认内容', () => {
    const emptySection = { __component: 'section.team', id: 2, title: '', description: '', members: { data: [] } };
    render(<Team section={emptySection} />);
    expect(screen.getByText('资深教师团队')).toBeInTheDocument();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd /home/tishensnoopy/project/superpowers-zh/frontend && npx vitest run src/components/sections/__tests__/Team.test.tsx
```
预期：FAIL（需要检查现有 Team.tsx 实现）。

- [ ] **步骤 3：实现/修复 Team 组件**

先读取现有 `frontend/src/components/sections/Team.tsx`，然后修改确保它从 `section.members.data` 读取数据，并支持 `attributes` 嵌套格式。关键逻辑：

```tsx
import { Heart, User } from 'lucide-react';
import type { Section } from '../../lib/api';

export default function Team({ section }: { section: Section }) {
  const { title, description, members } = section;

  return (
    <section className="py-24 bg-background">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#ECFDF5] text-[#059669] text-sm font-medium mb-5">
            <Heart size={14} />
            师资团队
          </div>
          <h2 className="text-[#1C2B3A] mb-4" style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif", fontSize: '2.25rem', fontWeight: 800 }}>
            {title || '资深教师团队'}
          </h2>
          <p className="text-muted-foreground text-base max-w-[480px] mx-auto">
            {description || '8年沉淀，打造出一支专业、有爱、懂孩子的教师队伍。'}
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {(members?.data || []).map((member: any) => {
            const m = member.attributes || member;
            return (
              <div key={member.id} className="col-span-12 sm:col-span-6 lg:col-span-3">
                <div className="h-full bg-card rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <div className="aspect-square bg-[#F5F3FF] flex items-center justify-center relative">
                    {m.avatar ? (
                      <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center">
                        <User size={48} className="text-[#7C3AED]" />
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-[#1C2B3A] mb-1" style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}>
                      {m.name}
                    </h3>
                    <p className="text-[#7C3AED] text-sm font-medium mb-3">{m.position}</p>
                    <p className="text-muted-foreground text-sm leading-relaxed">{m.bio}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd /home/tishensnoopy/project/superpowers-zh/frontend && npx vitest run src/components/sections/__tests__/Team.test.tsx
```
预期：5 个测试全部 PASS。

- [ ] **步骤 5：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend/src/components/sections/Team.tsx frontend/src/components/sections/__tests__/Team.test.tsx
git commit -m "feat(frontend): Team 组件 TDD 实现"
```

---

### 任务 10：阶段二验证检查点

- [ ] **步骤 1：运行所有前端测试**

```bash
cd /home/tishensnoopy/project/superpowers-zh/frontend && npx vitest run
```
预期：所有测试 PASS。

- [ ] **步骤 2：浏览器验证首页渲染**

访问 http://localhost:5173，确认：
- Hero 区块正常显示
- 核心优势区块显示 4 个优势卡片
- 课程体系区块显示 4 个课程卡片
- 师资团队区块显示 4 个老师卡片
- 预约表单区块显示表单（此阶段可能还未完全实现）

- [ ] **步骤 3：响应式验证**

在浏览器中切换不同视口：
- 桌面（1280px+）：4 列布局
- 平板（768-1024px）：2 列布局
- 手机（<768px）：1 列布局

---

## 阶段三：预约表单业务逻辑与集成（串行）

### 任务 11：添加 createAppointment API 函数

**文件：**
- 修改：`frontend/src/lib/api.ts`

- [ ] **步骤 1：在 api.ts 末尾添加 createAppointment 函数**

在 `frontend/src/lib/api.ts` 末尾添加：

```typescript
export async function createAppointment(data: {
  childName: string;
  parentName: string;
  phone: string;
  age?: string;
  course?: string;
  preferredTimeSlot?: string;
  message?: string;
}) {
  console.log(`${LOG_PREFIX} Creating appointment...`);
  return fetchApi<{ data: any }>('/api/appointments', {
    method: 'POST',
    body: JSON.stringify({ data }),
  });
}
```

- [ ] **步骤 2：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend/src/lib/api.ts
git commit -m "feat(frontend): 添加 createAppointment API 函数"
```

---

### 任务 12：ContactForm 组件 TDD

**文件：**
- 创建：`frontend/src/components/sections/__tests__/ContactForm.test.tsx`
- 修改：`frontend/src/components/sections/ContactForm.tsx`

- [ ] **步骤 1：编写失败的测试**

创建 `frontend/src/components/sections/__tests__/ContactForm.test.tsx`：

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContactForm from '../ContactForm';

vi.mock('../../../lib/api', () => ({
  createAppointment: vi.fn().mockResolvedValue({ data: { id: 1 } }),
}));

import { createAppointment } from '../../../lib/api';

const mockSection = {
  __component: 'section.contact-form',
  id: 1,
  title: '预约免费试听',
  description: '填写下方表单，我们将尽快联系您',
  submitText: '立即预约',
  successMessage: '预约成功！',
  fields: {
    data: [
      { id: 1, attributes: { label: '孩子姓名', name: 'childName', type: 'text', required: true, placeholder: '请输入孩子姓名', options: null } },
      { id: 2, attributes: { label: '家长姓名', name: 'parentName', type: 'text', required: true, placeholder: '请输入家长姓名', options: null } },
      { id: 3, attributes: { label: '联系电话', name: 'phone', type: 'phone', required: true, placeholder: '请输入手机号码', options: null } },
      { id: 4, attributes: { label: '感兴趣的课程', name: 'course', type: 'select', required: false, placeholder: '请选择', options: JSON.stringify(['语言启蒙', '数学思维']) } },
    ],
  },
};

describe('ContactForm 组件', () => {
  it('渲染表单标题', () => {
    render(<ContactForm section={mockSection} />);
    expect(screen.getByText('预约免费试听')).toBeInTheDocument();
  });

  it('渲染所有表单字段', () => {
    render(<ContactForm section={mockSection} />);
    expect(screen.getByLabelText(/孩子姓名/)).toBeInTheDocument();
    expect(screen.getByLabelText(/家长姓名/)).toBeInTheDocument();
    expect(screen.getByLabelText(/联系电话/)).toBeInTheDocument();
    expect(screen.getByLabelText(/感兴趣的课程/)).toBeInTheDocument();
  });

  it('渲染提交按钮', () => {
    render(<ContactForm section={mockSection} />);
    expect(screen.getByRole('button', { name: '立即预约' })).toBeInTheDocument();
  });

  it('必填字段为空时显示错误', async () => {
    const user = userEvent.setup();
    render(<ContactForm section={mockSection} />);
    await user.click(screen.getByRole('button', { name: '立即预约' }));
    expect(await screen.findByText(/请输入孩子姓名/)).toBeInTheDocument();
  });

  it('提交成功后显示成功消息', async () => {
    const user = userEvent.setup();
    render(<ContactForm section={mockSection} />);
    await user.type(screen.getByLabelText(/孩子姓名/), '小明');
    await user.type(screen.getByLabelText(/家长姓名/), '王先生');
    await user.type(screen.getByLabelText(/联系电话/), '13800138000');
    await user.click(screen.getByRole('button', { name: '立即预约' }));
    expect(await screen.findByText('预约成功！')).toBeInTheDocument();
    expect(createAppointment).toHaveBeenCalledWith({
      childName: '小明',
      parentName: '王先生',
      phone: '13800138000',
      course: '',
    });
  });

  it('手机号格式错误时显示错误', async () => {
    const user = userEvent.setup();
    render(<ContactForm section={mockSection} />);
    await user.type(screen.getByLabelText(/孩子姓名/), '小明');
    await user.type(screen.getByLabelText(/家长姓名/), '王先生');
    await user.type(screen.getByLabelText(/联系电话/), '123');
    await user.click(screen.getByRole('button', { name: '立即预约' }));
    expect(await screen.findByText(/手机号格式不正确/)).toBeInTheDocument();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd /home/tishensnoopy/project/superpowers-zh/frontend && npx vitest run src/components/sections/__tests__/ContactForm.test.tsx
```
预期：FAIL（现有 ContactForm 组件未实现动态表单逻辑）。

- [ ] **步骤 3：实现 ContactForm 组件**

修改 `frontend/src/components/sections/ContactForm.tsx`：

```tsx
import { useState } from 'react';
import { Calendar, Send } from 'lucide-react';
import type { Section } from '../../lib/api';
import { createAppointment } from '../../lib/api';

export default function ContactForm({ section }: { section: Section }) {
  const { title, description, submitText, successMessage, fields } = section;
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleFieldChange = (name: string, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => { const next = { ...prev }; delete next[name]; return next; });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    let valid = true;

    (fields?.data || []).forEach((field: any) => {
      const f = field.attributes || field;
      const value = values[f.name] || '';
      if (f.required && !value) {
        newErrors[f.name] = `请输入${f.label}`;
        valid = false;
      }
      if (f.type === 'phone' && value) {
        if (!/^1[3-9]\d{9}$/.test(value)) {
          newErrors[f.name] = '手机号格式不正确';
          valid = false;
        }
      }
    });

    setErrors(newErrors);
    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSuccess(false);
    try {
      await createAppointment({
        childName: values.childName || '',
        parentName: values.parentName || '',
        phone: values.phone || '',
        age: values.age,
        course: values.course,
        preferredTimeSlot: values.preferredTimeSlot,
        message: values.message,
      });
      setSuccess(true);
      setValues({});
    } catch (err) {
      setErrors({ submit: '提交失败，请稍后重试' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-[#1C2B3A]">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(28,43,58,0.96) 0%, rgba(245,133,31,0.3) 100%)' }} />
      </div>
      <div className="relative max-w-[800px] mx-auto px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-sm mb-6">
            <Calendar size={14} />
            预约试听
          </div>
          <h2 className="text-white mb-4" style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif", fontSize: '2.25rem', fontWeight: 800 }}>
            {title || '预约免费试听'}
          </h2>
          <p className="text-white/70 text-base">{description || '填写下方表单，我们将尽快联系您'}</p>
        </div>

        {success ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center border border-white/20">
            <div className="w-16 h-16 rounded-full bg-[#F5851F] flex items-center justify-center mx-auto mb-4">
              <Send size={28} className="text-white" />
            </div>
            <p className="text-white text-lg font-semibold">{successMessage || '预约成功！'}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(fields?.data || []).map((field: any) => {
                const f = field.attributes || field;
                const error = errors[f.name];
                const options = f.options ? (typeof f.options === 'string' ? JSON.parse(f.options) : f.options) : [];

                return (
                  <div key={field.id} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
                    <label htmlFor={f.name} className="block text-white/80 text-sm mb-2">
                      {f.label}
                      {f.required && <span className="text-[#F5851F] ml-1">*</span>}
                    </label>
                    {f.type === 'select' ? (
                      <select
                        id={f.name}
                        value={values[f.name] || ''}
                        onChange={(e) => handleFieldChange(f.name, e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border bg-[#F8F9FF] text-sm focus:outline-none focus:border-[#F5851F] transition-colors"
                        style={{ borderColor: error ? '#DC2626' : 'rgba(255,255,255,0.2)' }}
                      >
                        <option value="">{f.placeholder || '请选择'}</option>
                        {Array.isArray(options) && options.map((opt: any, i: number) => {
                          const val = typeof opt === 'string' ? opt : opt.value;
                          const label = typeof opt === 'string' ? opt : opt.label;
                          return <option key={i} value={val}>{label}</option>;
                        })}
                      </select>
                    ) : f.type === 'textarea' ? (
                      <textarea
                        id={f.name}
                        value={values[f.name] || ''}
                        onChange={(e) => handleFieldChange(f.name, e.target.value)}
                        placeholder={f.placeholder}
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl border bg-[#F8F9FF] text-sm focus:outline-none focus:border-[#F5851F] transition-colors"
                        style={{ borderColor: error ? '#DC2626' : 'rgba(255,255,255,0.2)' }}
                      />
                    ) : (
                      <input
                        id={f.name}
                        type={f.type === 'phone' ? 'tel' : 'text'}
                        value={values[f.name] || ''}
                        onChange={(e) => handleFieldChange(f.name, e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full px-4 py-3 rounded-xl border bg-[#F8F9FF] text-sm focus:outline-none focus:border-[#F5851F] transition-colors"
                        style={{ borderColor: error ? '#DC2626' : 'rgba(255,255,255,0.2)' }}
                      />
                    )}
                    {error && <p className="text-[#FF6B6B] text-xs mt-1">{error}</p>}
                  </div>
                );
              })}
            </div>

            {errors.submit && <p className="text-[#FF6B6B] text-sm mt-4 text-center">{errors.submit}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-6 py-4 rounded-xl text-white font-bold text-base shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
            >
              {submitting ? '提交中...' : (submitText || '立即预约')}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd /home/tishensnoopy/project/superpowers-zh/frontend && npx vitest run src/components/sections/__tests__/ContactForm.test.tsx
```
预期：6 个测试全部 PASS。

- [ ] **步骤 5：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend/src/components/sections/ContactForm.tsx frontend/src/components/sections/__tests__/ContactForm.test.tsx frontend/src/lib/api.ts
git commit -m "feat(frontend): ContactForm 组件 TDD 实现含表单验证与提交"
```

---

### 任务 13：端到端集成验证

- [ ] **步骤 1：运行所有测试**

```bash
cd /home/tishensnoopy/project/superpowers-zh/frontend && npx vitest run
```
预期：所有测试 PASS。

- [ ] **步骤 2：浏览器端到端验证**

访问 http://localhost:5173，完成以下检查：

1. **首页加载** — 5 个区块全部渲染
2. **核心优势** — 4 个卡片，图标颜色正确
3. **课程体系** — 4 个课程卡片，含分类标签和规格列表
4. **师资团队** — 4 个老师卡片，含头像占位符和简介
5. **预约表单** — 7 个字段正确渲染

- [ ] **步骤 3：表单提交端到端测试**

1. 填写表单：孩子姓名"测试"、家长姓名"测试"、手机号"13800138000"
2. 点击"立即预约"
3. 确认显示成功消息"预约成功！"
4. 在 Strapi 管理后台（http://localhost:1337/admin）查看 appointment 记录

- [ ] **步骤 4：错误处理验证**

1. 必填字段为空 → 显示"请输入XXX"错误
2. 手机号输入"123" → 显示"手机号格式不正确"
3. 同一 IP 提交 6 次 → 第 6 次返回频率限制错误

- [ ] **步骤 5：响应式布局验证**

- 桌面（1280px+）：表单 2 列布局
- 平板（768-1024px）：表单 2 列布局
- 手机（<768px）：表单 1 列布局

- [ ] **步骤 6：最终 Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add -A
git commit -m "test: 端到端集成验证完成"
```

---

## 自检结果

### 1. 规格覆盖度

| 规格需求 | 对应任务 |
|----------|----------|
| 修复 common.advantage schema | 任务 1 |
| 重建 Strapi | 任务 2 |
| 创建 appointment API | 任务 3 |
| 填充示例数据 | 任务 4 |
| API 验证 | 任务 5 |
| Advantages 组件 TDD | 任务 7 |
| ProductGrid 组件 TDD | 任务 8 |
| Team 组件 TDD | 任务 9 |
| 阶段二验证 | 任务 10 |
| createAppointment 函数 | 任务 11 |
| ContactForm 组件 TDD | 任务 12 |
| 端到端集成 | 任务 13 |

### 2. 占位符扫描

- 无 TODO、待定、模糊描述
- 所有代码步骤包含完整代码块
- 所有命令包含预期输出

### 3. 类型一致性

- `createAppointment` 函数签名在任务 11（api.ts）和任务 12（ContactForm 调用）中一致
- `Section` 类型在所有组件中统一引用自 `../../lib/api`
- appointment schema 字段名（childName、parentName、phone 等）在前端 API 调用和后端 schema 中一致
