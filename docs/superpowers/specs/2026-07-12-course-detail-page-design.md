# 课程详情页设计规格

**日期：** 2026-07-12
**阶段：** Phase 4 — 内容页面填充（第一个子项目）
**状态：** 设计已确认，TDD 评估完成，待用户审查

## 背景

首页五大区块（Hero / Advantages / ProductGrid / Team / ContactForm）已完成，导航栏二级菜单已就绪。但"课程体系"下的 4 个课程（语言启蒙、数学思维、英语口语、综合素养）点击后无详情页可看。本规格定义课程详情页的 Strapi 数据模型扩展、页面结构、前端组件和测试策略。

## 决策记录

### 方案选择：B（丰富版）

用户从 3 个布局方案中选择了 B（丰富版），在现有 Strapi `product` 字段基础上扩展 schema，增加学习目标、课程大纲、教学方法、家长评价等区块。

选择理由：课程详情是家长决策的核心内容，丰富的信息能直接提升预约转化率。

## Strapi 数据模型扩展

### 新建 Components

#### 1. `course.objective`（学习目标）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string (maxLength 100) | 是 | 学习目标标题（如"掌握 500+ 词汇量"） |
| description | text | 否 | 目标详细说明 |

#### 2. `course.module`（课程大纲模块）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string (maxLength 100) | 是 | 阶段标题（如"第 1-12 课：基础词汇"） |
| description | text | 否 | 阶段内容描述 |
| lessonCount | integer | 否 | 该阶段课时数 |

#### 3. `course.testimonial`（家长评价）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| parentName | string (maxLength 50) | 是 | 家长称呼（如"张妈妈"） |
| content | text | 是 | 评价内容 |
| rating | integer (min 1, max 5) | 否 | 评分（1-5），默认 5 |

### product 新增字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| teachingMethod | richtext | 否 | 教学方法描述（富文本） |
| objectives | repeatable component (course.objective) | 否 | 学习目标列表 |
| outline | repeatable component (course.module) | 否 | 课程大纲分阶段 |
| testimonials | repeatable component (course.testimonial) | 否 | 家长评价 |

### 不新增的部分（YAGNI）

- **教师关联**：直接用现有 `teacher` collection type 通过 relation 关联，不新建字段类型
- **课程专属 FAQ**：放到后续迭代，先用全局 FAQ 页面
- **图片画廊**：用现有 `images` 字段，不新建

## 页面路由

| 路由 | 页面 | 数据源 |
|------|------|--------|
| `/courses/:slug` | CourseDetail | `getProductBySlug(slug)` |

## 页面结构（从上到下）

1. **课程头部** — icon、课程名、shortDescription、规格标签（年龄/课时/班额/周期）
2. **课程描述** — description（富文本）
3. **学习目标** — objectives 列表，带图标
4. **课程大纲** — outline 时间轴/卡片列表
5. **教学方法** — teachingMethod 富文本
6. **家长评价** — testimonials 卡片列表（不使用轮播，YAGNI）
7. **规格参数** — specValues 网格
8. **价格** — price + originalPrice
9. **预约 CTA** — 页面底部按钮，跳转到预约表单

## 前端组件设计

### 新建组件

| 组件 | 职责 | 输入 |
|------|------|------|
| `CourseDetail` | 页面容器，获取数据并渲染各区块 | `slug` (路由参数) |
| `CourseHeader` | 渲染课程头部（icon/名称/标签） | `product` 对象 |
| `CourseObjectives` | 渲染学习目标列表 | `objectives[]` |
| `CourseOutline` | 渲染课程大纲时间轴 | `outline[]` |
| `CourseTestimonials` | 渲染家长评价卡片 | `testimonials[]` |
| `CourseCTA` | 渲染预约按钮，点击跳转到预约表单 | `courseName` |

### 复用组件

- `SectionRenderer` — 已有，用于通用区块渲染
- `Layout` — 已有，页面外壳（导航栏 + 页脚）

### API 层

- `getProductBySlug(slug)` — 已存在于 `api.ts`，需确认返回数据包含新字段（objectives/outline/teachingMethod/testimonials）

## 测试策略

### TDD 原则

遵循 test-driven-development 技能：先写测试，再写实现。

### TDD 合规评估

对本设计的 TDD 合规性逐层评估：

| 层级 | 能否 TDD | 原因 | 测试先行？ |
|------|---------|------|-----------|
| Strapi schema 迁移 | ❌ 不能 | schema 是数据模型定义，不是逻辑代码。无法对 JSON schema 文件写失败测试。 | 否，但需验证迁移后 API 返回新字段 |
| API 层（getProductBySlug） | ✅ 能 | 可以写测试验证返回数据包含 objectives/outline/teachingMethod/testimonials 字段 | **是**，先写 API 测试 |
| 前端组件（6 个） | ✅ 能 | 每个组件有明确的 props 和渲染输出，适合 TDD | **是**，先写组件测试 |
| 页面集成（CourseDetail） | ✅ 能 | 可以写测试验证路由跳转、数据加载、404 处理 | **是**，先写页面测试 |
| 视觉验证 | ❌ 不能 | 视觉效果无法用自动化测试断言 | 否，用 TRAE 内建浏览器手动验证 |

### TDD 实施顺序（修正后）

```
1. Strapi schema 迁移（基础设施，无测试）
   ├── 创建 3 个 component 文件
   └── 更新 product schema.json 添加 4 个字段

2. API 层 TDD
   ├── 先写测试：验证 getProductBySlug 返回新字段（失败）
   ├── 修改 api.ts 的 populate 配置（如果需要）
   └── 运行测试（通过）

3. 组件 TDD（按依赖顺序）
   ├── CourseHeader：先写测试 → 实现
   ├── CourseObjectives：先写测试 → 实现
   ├── CourseOutline：先写测试 → 实现
   ├── CourseTestimonials：先写测试 → 实现
   ├── CourseCTA：先写测试 → 实现
   └── CourseDetail：先写测试 → 实现

4. 集成与路由
   ├── 注册 /courses/:slug 路由
   ├── 修复 ProductGrid 的"查看详情"链接
   └── 运行全部测试

5. 视觉验证
   └── TRAE 内建浏览器验证页面布局和交互
```

### 测试分层

| 层级 | 工具 | 覆盖内容 |
|------|------|---------|
| 单元测试 | Vitest + Testing Library | 各组件渲染、props 传递、边界情况 |
| 集成测试 | Vitest + MSW | API 调用、数据流转、路由跳转 |
| 视觉验证 | TRAE 内建浏览器 | 页面布局、响应式、交互效果 |

### 关键测试用例（先行）

1. **CourseDetail** — slug 存在时渲染页面，slug 不存在时显示 404
2. **CourseHeader** — 渲染课程名/标签，缺失字段时显示默认值
3. **CourseObjectives** — 渲染目标列表，空数组时隐藏区块
4. **CourseOutline** — 渲染大纲模块，lessonCount 为 0 时不显示课时数
5. **CourseTestimonials** — 渲染评价卡片，rating 转换为星星显示
6. **CourseCTA** — 点击按钮跳转到 `/` 预约表单（携带课程名参数）

## 风险与约束

1. **Strapi v5 repeatable component 格式**：返回直接数组 `[{id:1,...}]` 而非 `{data:[...]}`，前端需 `Array.isArray()` 兼容（已在 Advantages/Team 组件中处理过）
2. **富文本渲染**：Strapi richtext 字段返回 markdown 或 HTML，需确认格式并选择渲染方式
3. **图片优化**：images 字段需确认 Strapi v5 的图片 URL 格式和缩略图机制

## 实施顺序（待 writing-plans 细化）

1. Strapi schema 迁移（创建 components + 扩展 product 字段）
2. 后端 API 验证（确认新字段在 GET 响应中返回）
3. 前端 API 层更新（确认 getProductBySlug 包含新字段）
4. TDD：先写组件测试用例
5. 实现组件（CourseHeader → CourseObjectives → CourseOutline → CourseTestimonials → CourseCTA）
6. 集成到 CourseDetail 页面
7. 路由注册
8. 视觉验证（TRAE 内建浏览器）
