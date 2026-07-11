# 首页区块实现设计规格

> **日期**: 2026-07-12
> **状态**: 待审查
> **关联**: 子项目 1 — 基础设施 Strapi 设计（2026-07-11）

## 1. 背景

当前首页只有 Hero 区块已实现并连接到 Strapi 动态数据。原始设计稿 [App.tsx](file:///home/tishensnoopy/project/superpowers-zh/shouye/src/app/App.tsx) 中首页共 6 个 section，本轮实现其中 4 个（跳过"课堂瞬间"照片墙）。

前后端组件脚手架已全部存在（12 个 section schema + 12 个 React 组件），但：
- 数据库中首页只有 Hero 区块数据
- 部分 schema 字段与前端组件期望不一致
- 预约表单的后端 API（appointment）尚未创建

## 2. 需求确认

| 项目 | 内容 |
|------|------|
| **实现区块** | ② 核心优势、③ 课程体系、⑤ 师资团队、⑥ 预约试听表单 |
| **数据来源** | Strapi 动态获取（CMS 驱动） |
| **示例数据** | 补充到数据库，图片用单色背景占位图 + 标明尺寸 |
| **预约表单** | 完整功能（前端 UI + 后端 API + 数据存储 + 管理后台可查看） |
| **测试策略** | TDD（测试驱动开发） |

## 3. 方案选择：方案 C 混合策略

### 3.1 并行/串行划分标准

**可以并行的条件（必须全部满足）：**
1. 不修改同一个文件
2. 无数据依赖
3. 有独立验证方式
4. 复杂度相近
5. 不涉及共享资源变更

**必须串行的情况（任一满足）：**
1. 修改同一个文件
2. 有数据依赖
3. 涉及数据库 schema 变更
4. 复杂度差异大
5. 涉及公共架构变更

### 3.2 三阶段执行流程

```
阶段一（串行）：后端数据填充 + API 验证
    ↓ 验证检查点
阶段二（并行）：3 个展示组件 TDD 实现
    ↓ 验证检查点
阶段三（串行）：预约表单完整实现
    ↓ 验证检查点
完成
```

## 4. 技术设计

### 4.1 区块 ② 核心优势（section.advantages）

**后端 schema 问题**：[common.advantage](file:///home/tishensnoopy/project/superpowers-zh/backend/src/components/common/advantage.json) 缺少 `color` 和 `bgColor` 字段，但前端 [Advantages.tsx](file:///home/tishensnoopy/project/superpowers-zh/frontend/src/components/sections/Advantages.tsx) 期望 `adv.bg` 和 `adv.color`。

**修复方案**：在 `common.advantage` schema 中添加：
- `color` (Text) — 图标颜色，如 `#F5851F`
- `bgColor` (Text) — 图标背景色，如 `#FFF3E5`

**示例数据结构**：
```json
{
  "title": "为什么选择我们",
  "description": "我们深知每位家长对孩子教育的期望与用心，以专业、安全、温暖的教育环境陪伴每一个孩子成长。",
  "advantages": [
    { "title": "专业师资", "description": "8年幼小衔接教学经验...", "icon": "GraduationCap", "color": "#F5851F", "bgColor": "#FFF3E5" },
    { "title": "科学课程", "description": "对标小学课程标准...", "icon": "BookOpen", "color": "#2563EB", "bgColor": "#EFF6FF" },
    { "title": "安全环境", "description": "全程监控、安全防护...", "icon": "Shield", "color": "#059669", "bgColor": "#ECFDF5" },
    { "title": "小班教学", "description": "每班不超过12人...", "icon": "Users", "color": "#7C3AED", "bgColor": "#F5F3FF" }
  ]
}
```

### 4.2 区块 ③ 课程体系（section.product-grid）

**数据模型**：使用 [product-grid](file:///home/tishensnoopy/project/superpowers-zh/backend/src/components/section/product-grid.json) 组件，关联到 [product](file:///home/tishensnoopy/project/superpowers-zh/backend/src/api/product/content-types/product/schema.json) collection。

**依赖**：需要先在数据库中创建 4 个 product 记录（语言启蒙、数学思维、英语口语、综合素养），以及对应的 product-category。

**示例数据**：
- 产品分类：`语言启蒙`、`数学思维`、`英语口语`、`综合素养`
- 每个产品包含：name、shortDescription、description、categories、specs（课时、班额等）
- 占位图：单色背景 + 文字标注尺寸（如 `400x300`）

### 4.3 区块 ⑤ 师资团队（section.team）

**数据模型**：使用 [team](file:///home/tishensnoopy/project/superpowers-zh/backend/src/components/section/team.json) + [common.team-member](file:///home/tishensnoopy/project/superpowers-zh/backend/src/components/common/team-member.json)。

**占位图**：头像使用单色背景 + 标注 `300x300`。

**示例数据**：
```json
{
  "title": "资深教师团队",
  "description": "8年沉淀，打造出一支专业、有爱、懂孩子的教师队伍。",
  "members": [
    { "name": "王老师", "position": "教学总监", "bio": "北京师范大学学前教育硕士...", "avatar": "占位图 300x300" },
    { "name": "李老师", "position": "语言启蒙组组长", "bio": "...", "avatar": "占位图 300x300" },
    { "name": "张老师", "position": "数学思维组组长", "bio": "...", "avatar": "占位图 300x300" },
    { "name": "陈老师", "position": "英语口语组组长", "bio": "...", "avatar": "占位图 300x300" }
  ]
}
```

### 4.4 区块 ⑥ 预约试听表单

这是最复杂的区块，涉及后端 API 创建。

#### 4.4.1 后端：appointment collection type

**需创建**：`api::appointment.appointment`（当前不存在）

参照 [需求文档](file:///home/tishensnoopy/project/superpowers-zh/docs/superpowers/specs/2026-07-11-subproject-1-infrastructure-strapi-design.md#L365-L381) 定义的字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `childName` | Text (required) | 孩子姓名 |
| `parentName` | Text (required) | 家长姓名 |
| `phone` | Text (required) | 联系电话 |
| `age` | Number | 孩子年龄 |
| `course` | Text | 感兴趣的课程 |
| `preferredDate` | Date | 期望日期 |
| `preferredTimeSlot` | Enumeration (morning, afternoon, evening) | 期望时段 |
| `campus` | Text | 期望校区 |
| `message` | Textarea (long) | 备注 |
| `status` | Enumeration (pending, confirmed, completed, cancelled) | 预约状态 |
| `assignedTo` | Relation (admin user) | 跟进人 |
| `ipAddress` | Text | IP 地址（自动采集） |
| `userAgent` | Text | 浏览器信息（自动采集） |

**需创建的文件**：
- `src/api/appointment/content-types/appointment/schema.json`
- `src/api/appointment/controllers/appointment.ts`
- `src/api/appointment/services/appointment.ts`
- `src/api/appointment/routes/appointment.ts`

**API 端点**：
- `POST /api/appointments` — 创建预约（公开访问，无需认证）
- `GET /api/appointments` — 查询预约列表（需管理员认证）
- `GET /api/appointments/:id` — 查询单个预约（需管理员认证）

**安全要求**：
- POST 接口公开访问（无需 token），但需要：
  - 输入验证（phone 格式、必填字段）
  - 频率限制（同一 IP 每小时最多 5 次）
  - 自动采集 ipAddress 和 userAgent
  - status 默认为 `pending`
- GET 接口需要管理员认证

#### 4.4.2 前端：ContactForm 组件

**数据模型**：使用 [contact-form](file:///home/tishensnoopy/project/superpowers-zh/backend/src/components/section/contact-form.json) + [common.form-field](file:///home/tishensnoopy/project/superpowers-zh/backend/src/components/common/form-field.json)。

**前端组件职责**：
1. 从 Strapi 获取表单配置（fields 定义）
2. 根据 fields 配置动态渲染表单
3. 客户端验证（必填、phone 格式）
4. 提交到 `POST /api/appointments`
5. 显示成功/错误反馈

**表单字段配置**（存储在 Strapi contact-form 组件的 fields 中）：
```
- 孩子姓名 (text, required)
- 家长姓名 (text, required)
- 联系电话 (phone, required)
- 孩子年龄 (text, optional)
- 感兴趣的课程 (select, options: 语言启蒙/数学思维/英语口语/综合素养)
- 期望时段 (select, options: 上午/下午/晚上)
- 备注 (textarea, optional)
```

## 5. 阶段详细设计

### 5.1 阶段一：后端数据填充与 API 骨架（串行）

**任务列表**：
1. 修复 `common.advantage` schema — 添加 `color`、`bgColor` 字段
2. 重新构建 Strapi（`npm run build`）使 schema 变更生效
3. 创建 product-category 数据（4 个分类）
4. 创建 product 数据（4 个课程，关联分类 + specs）
5. 创建 appointment API 骨架（schema + controller + service + routes）— 仅基础 CRUD，业务逻辑（验证、频率限制）在阶段三实现
6. 配置 appointment POST 接口的公开访问权限
7. 更新首页 page 记录，添加 4 个 section 区块到 sections 动态区块
8. 验证每个区块的 API 返回格式正确

**说明**：appointment API 的创建放在阶段一（因为涉及 schema 变更需要重启 Strapi），但输入验证、频率限制、IP/UserAgent 采集等业务逻辑在阶段三实现。阶段一只需确保接口可访问。

**验证检查点**：
- `GET /api/pages?populate=sections` 返回首页包含 5 个区块（Hero + 4 个新区块）
- 每个区块的 attributes 数据结构完整
- `POST /api/appointments` 接口可访问（返回 400 而非 404，表示接口存在但缺少必填字段）

### 5.2 阶段二：前端展示组件 TDD（并行）

**可并行的 3 个任务**：

| 任务 | 文件 | 依赖 | 验证方式 |
|------|------|------|----------|
| Advantages 组件 | [Advantages.tsx](file:///home/tishensnoopy/project/superpowers-zh/frontend/src/components/sections/Advantages.tsx) | 阶段一 API | 组件测试 + 浏览器渲染 |
| ProductGrid 组件 | [ProductGrid.tsx](file:///home/tishensnoopy/project/superpowers-zh/frontend/src/components/sections/ProductGrid.tsx) | 阶段一 API | 组件测试 + 浏览器渲染 |
| Team 组件 | [Team.tsx](file:///home/tishensnoopy/project/superpowers-zh/frontend/src/components/sections/Team.tsx) | 阶段一 API | 组件测试 + 浏览器渲染 |

**TDD 流程（每个组件）**：
1. 先写测试：组件渲染测试、数据获取测试、空状态测试
2. 运行测试确认失败（红灯）
3. 实现组件
4. 运行测试确认通过（绿灯）
5. 重构优化

**并行执行方式**：使用 `dispatching-parallel-agents` skill 分发给 3 个独立子代理。

**验证检查点**：
- 3 个组件测试全部通过
- 浏览器访问首页，4 个新区块正确渲染
- 响应式布局正常（桌面/平板/手机）

### 5.3 阶段三：预约表单业务逻辑与集成（串行）

**前提**：阶段一已创建 appointment API 骨架（schema + 基础 CRUD），接口可访问。

**任务列表**：
1. 后端：实现输入验证（phone 格式、必填字段）
2. 后端：实现频率限制（同一 IP 每小时最多 5 次）
3. 后端：实现 IP/UserAgent 自动采集
4. 后端：status 默认值设为 `pending`
5. 前端 TDD：ContactForm 组件测试
6. 前端：实现 ContactForm 组件（动态表单、验证、提交、反馈）
7. 集成测试：端到端表单提交 → 数据存储 → 管理后台可查看
8. 错误处理测试：必填校验、phone 格式、频率限制

**验证检查点**：
- 表单提交成功 → 数据写入 appointment 表 → 管理后台可见
- 必填字段为空 → 显示错误提示
- phone 格式错误 → 显示错误提示
- 同一 IP 超过 5 次/小时 → 返回 429

## 6. 测试策略

### 6.1 后端测试
- API 返回格式验证（每个区块的数据结构）
- appointment API 的 CRUD 测试
- 输入验证测试

### 6.2 前端测试
- 组件渲染测试（正常数据、空数据、错误状态）
- 表单交互测试（输入、验证、提交）
- 响应式布局测试

### 6.3 集成测试
- 端到端：首页加载 → 所有区块渲染 → 表单提交 → 数据存储
- 浏览器验证：桌面/平板/手机三种视口

## 7. 已知风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| `common.advantage` schema 变更需要重启 Strapi | 阶段一阻塞 | 在阶段一最开始处理 |
| product 数据可能需要关联 specs 和 categories | 数据填充复杂 | 先检查现有 product 数据结构 |
| appointment POST 接口公开访问的安全风险 | 垃圾提交 | 频率限制 + 输入验证 |
| 前端组件可能需要修复数据格式适配 | 阶段二返工 | 阶段一验证 API 格式后再开始阶段二 |

## 8. 不在范围内

- ④ 课堂瞬间照片墙（本轮跳过）
- 邮件通知功能（表单提交后不发送邮件）
- 管理后台的自定义预约管理界面（使用 Strapi 默认后台）
- 微信通知
- 多语言支持

## 测试改进与教训记录

### 测试程序不完整的教训
- 问题描述：初版测试只覆盖 {data: [...]} 格式（Strapi v4），未覆盖 Strapi v5 实际返回的直接数组格式，导致"测试通过但生产环境失败"
- 根本原因：测试 mock 数据格式与实际 API 返回格式不一致
- 影响范围：Advantages、Team、ContactForm 三个组件
- 修复方案：补充 Strapi v5 直接数组格式的测试用例

### 测试改进方案
1. 数据格式覆盖原则：涉及外部 API 数据的组件测试，必须同时覆盖文档格式和实际 API 返回格式
2. 边界情况测试：null、undefined、空数组、空对象等边界场景必须覆盖
3. 浏览器视觉验证：验证检查点必须使用 browser_use 子代理进行真实浏览器验证，不能只依赖单元测试
4. 响应式测试：必须覆盖桌面(1280px)、平板(768px)、手机(375px)三种宽度

### 测试用例数量对比
- 修复前：14 个测试（仅 v4 格式）
- 修复后：34 个测试（v4+v5 格式 + 边界情况 + 表单交互）
