# Phase 4 内容页面填充设计规格

> **创建日期：** 2026-07-12
> **状态：** 已确认，待实现
> **前置依赖：** 首页 5 区块、导航栏二级菜单、课程详情页已完成

## 概述

Phase 4 内容页面填充，涵盖 5 个页面的设计与实现：

1. **师资团队页面**（/team）— 新前端页面 + Strapi teacher 内容类型
2. **校区总览页**（/campuses）— 新前端页面 + Strapi campus 内容类型
3. **校区详情页**（/campuses/:slug）— 新前端页面
4. **关于我们页面**（/about 等）— 通过 PageRenderer + Strapi page 数据
5. **联系我们页面**（/contact）— 通过 PageRenderer + Strapi page 数据

附带修复：App.tsx `/:slug` 路由 bug（slug 硬编码为空字符串）。

---

## 1. 师资团队页面（/team）

### 1.1 页面结构

```
TeamPage
├── TeamHeader          — Hero 区（标题 + 副标题 + 统计数据条）
├── TeamFilter          — 筛选器（校区 + 科目）
└── TeamGrid            — 教师卡片网格
    ├── TeacherCard     — 单个教师卡片（圆形头像 + 姓名 + 职称 + 标签）
    └── TeacherDetail   — 展开详情面板（整行展开）
```

### 1.2 交互设计

- **筛选器：** 校区（全部 + 8 个校区）+ 科目（全部 + 拼音/数学/英语/综合素养）
- **卡片排列：** 4 列网格，圆形头像居中
- **展开方式：** 手风琴展开 — 点击卡片在当前行下方整行展开详情面板，再次点击收起
- **展开内容：** 大头像 + 教育背景 + 教学特色 + 荣誉成就（badge 标签）
- **悬停效果：** 卡片上浮 4px + 橙色边框

### 1.3 统计数据条

页面顶部展示 4 项统计：
- 50+ 专业教师
- 8 校区覆盖
- 10年+ 平均教龄
- 98% 家长好评

### 1.4 Strapi teacher 内容类型

```json
{
  "kind": "collectionType",
  "collectionName": "teachers",
  "info": { "singularName": "teacher", "pluralName": "teachers", "displayName": "教师" },
  "attributes": {
    "name": { "type": "string", "required": true },
    "slug": { "type": "uid", "targetField": "name", "required": true },
    "title": { "type": "string", "required": true },
    "avatar": { "type": "media", "multiple": false, "allowedTypes": ["images"] },
    "campus": { "type": "relation", "relation": "manyToOne", "target": "api::campus.campus" },
    "subject": { "type": "enumeration", "enum": ["pinyin", "math", "english", "comprehensive"] },
    "teachingYears": { "type": "integer", "default": 0 },
    "education": { "type": "text" },
    "teachingFeatures": { "type": "text" },
    "achievements": { "type": "json" },
    "isFeatured": { "type": "boolean", "default": false },
    "sortOrder": { "type": "integer", "default": 0 }
  }
}
```

### 1.5 API 端点

- `GET /api/teachers?populate=avatar,campus&filters[campus][slug][$eq]=chaoyang&filters[subject][$eq]=pinyin`
- 自定义路由：`GET /teachers/filter` — 支持校区和科目筛选

---

## 2. 校区总览页（/campuses）

### 2.1 页面结构

```
CampusOverviewPage
├── CampusHeader        — Hero 区（标题"八大校区 任您选择" + 副标题）
└── CampusGrid          — 8 个校区卡片网格（4 列 x 2 行）
    └── CampusCard      — 单个校区卡片（图片 + 名称 + 地址 + 电话）
```

### 2.2 校区列表

8 个校区（城八区）：

| 校区 | slug | 占位地址 | 占位电话 |
|------|------|---------|---------|
| 朝阳校区 | chaoyang | 建国路88号 SOHO现代城A座3层 | 010-8888-0001 |
| 海淀校区 | haidian | 中关村大街1号 海龙大厦5层 | 010-8888-0002 |
| 西城校区 | xicheng | 西单北大街110号 西单大悦城6层 | 010-8888-0003 |
| 丰台校区 | fengtai | 南三环西路16号 首地大峡谷4层 | 010-8888-0004 |
| 东城校区 | dongcheng | 东直门外大街42号 东方银座3层 | 010-8888-0005 |
| 石景山校区 | shijingshan | 石景山路22号 万达广场4层 | 010-8888-0006 |
| 通州校区 | tongzhou | 新华西街58号 万达广场C座3层 | 010-8888-0007 |
| 昌平校区 | changping | 回龙观西大街18号 华联商厦3层 | 010-8888-0008 |

### 2.3 Strapi campus 内容类型

```json
{
  "kind": "collectionType",
  "collectionName": "campuses",
  "info": { "singularName": "campus", "pluralName": "campuses", "displayName": "校区" },
  "attributes": {
    "name": { "type": "string", "required": true },
    "slug": { "type": "uid", "targetField": "name", "required": true },
    "coverImage": { "type": "media", "multiple": false, "allowedTypes": ["images"] },
    "gallery": { "type": "media", "multiple": true, "allowedTypes": ["images"] },
    "address": { "type": "string", "required": true },
    "phone": { "type": "string" },
    "businessHours": { "type": "string" },
    "transportation": { "type": "text" },
    "area": { "type": "string" },
    "description": { "type": "text" },
    "mapEmbed": { "type": "text" },
    "sortOrder": { "type": "integer", "default": 0 },
    "teachers": { "type": "relation", "relation": "oneToMany", "target": "api::teacher.teacher", "mappedBy": "campus" }
  }
}
```

---

## 3. 校区详情页（/campuses/:slug）

### 3.1 页面结构

```
CampusDetailPage
├── CampusDetailHeader    — 面包屑 + Hero 区（校区名 + 简介）
├── CampusDetailContent   — 两列布局
│   ├── CampusGallery     — 环境图集（大图 + 小图网格）
│   └── CampusInfoCard     — 信息卡片（地址/电话/时间/交通/面积）
├── CampusMap             — 地图嵌入区域
└── CampusTeachers        — 本校教师列表（4 列迷你卡片）
```

### 3.2 信息卡片字段

- 📍 地址
- 📞 联系电话
- 🕐 营业时间
- 🚇 交通信息
- 📐 教学面积

### 3.3 路由

```
/campuses          → CampusOverviewPage
/campuses/:slug    → CampusDetailPage
```

---

## 4. 关于我们页面

### 4.1 实现方式

通过现有 PageRenderer + Strapi page 内容类型渲染，**无需新前端组件**。

### 4.2 页面内容

- **统计数据：** 8年教育经验 / 3000+ 毕业学员 / 4 直营校区 / 50+ 专业教师
- **学校介绍：** RichText section
- **资质荣誉：** Features section（3 个荣誉卡片）

### 4.3 Strapi page 数据

在 Strapi 后台创建 3 个 page 条目：
- `about-school` — 学校介绍
- `about-philosophy` — 办学理念
- `about-honors` — 资质荣誉

每个 page 的 sections Dynamic Zone 配置对应的 section 组件。

---

## 5. 联系我们页面

### 5.1 实现方式

通过现有 PageRenderer + Strapi page 内容类型渲染，**无需新前端组件**。

### 5.2 页面内容

- **联系信息卡片：** 客服热线 / 邮箱 / 微信客服 / 服务时间（RichText section）
- **各校区电话列表：** 8 个校区名称 + 电话 + 地址
- **预约表单：** ContactForm section（孩子姓名/联系电话/选择校区/孩子年龄/备注）

### 5.3 Strapi page 数据

在 Strapi 后台创建 page 条目：
- `contact` — 联系我们

sections 配置：RichText + ContactForm。

---

## 6. App.tsx 路由修复

### 6.1 当前 bug

```tsx
// App.tsx 第 12 行 — slug 硬编码为空字符串
<Route path="/:slug" element={<Layout><PageRenderer slug={''} /></Layout>} />
```

所有 `/:slug` 页面都渲染首页内容。

### 6.2 修复方案

```tsx
<Route path="/:slug" element={<Layout><PageRendererWithSlug /></Layout>} />
```

创建 `PageRendererWithSlug` 组件，用 `useParams` 获取 slug：

```tsx
import { useParams } from 'react-router-dom';
import PageRenderer from './PageRenderer';

export default function PageRendererWithSlug() {
  const { slug } = useParams<{ slug: string }>();
  return <PageRenderer slug={slug} />;
}
```

### 6.3 新增路由

```tsx
<Route path="/team" element={<Layout><TeamPage /></Layout>} />
<Route path="/campuses" element={<Layout><CampusOverviewPage /></Layout>} />
<Route path="/campuses/:slug" element={<Layout><CampusDetailPage /></Layout>} />
```

---

## 7. 响应式断点

所有页面共用以下断点：

| 断点 | 宽度 | 师资网格 | 校区网格 | 筛选器 | 统计条 |
|------|------|---------|---------|--------|--------|
| 桌面 | >1024px | 4 列 | 4 列 | 水平排列 | 水平排列 |
| 平板 | ≤1024px | 3 列 | 3 列 | 水平排列 | 换行排列 |
| 小平板 | ≤768px | 2 列 | 2 列 | 垂直排列 | 紧凑排列 |
| 手机 | ≤480px | 1 列 | 1 列 | 垂直排列 | 垂直排列 |

额外响应式调整：
- ≤768px：隐藏导航栏菜单（用移动端汉堡菜单）
- ≤768px：详情面板改为单列（头像居中 + 信息在下方）
- ≤480px：页面标题缩小（2.5rem → 1.5rem）
- ≤480px：卡片内边距缩小

---

## 8. 设计规范一致性

### 8.1 主色调

| 用途 | 颜色 |
|------|------|
| 主色 | #F5851F |
| 渐变结束色 | #FF6B35 |
| 浅色背景 | #FFF3E5 |
| 深色文字 | #1C2B3A |
| 灰色文字 | #4A5568 / #6b7280 |
| 边框 | #e5e7eb |
| 页脚背景 | #111827 |

### 8.2 字体

- 标题：'Nunito', 'Noto Sans SC', sans-serif
- 正文：'Noto Sans SC', sans-serif

### 8.3 间距

- 导航栏高度：72px（fixed）
- 页面顶部 padding：120px（72px 导航栏 + 48px 呼吸空间）
- 页面最大宽度：1400px
- 页面水平 padding：32px（桌面）/ 16px（移动端）

### 8.4 组件风格

- 圆角：16px（卡片）/ 12px（按钮/输入框）/ 50%（头像）
- 阴影：`0 2px 8px rgba(0,0,0,0.04)`（默认）/ `0 8px 24px rgba(0,0,0,0.1)`（悬停）
- 渐变按钮：`linear-gradient(135deg, #F5851F, #FF6B35)`

---

## 9. 并行开发任务分解

3 个并行任务：

### 任务 A：师资团队页面
- 创建 Strapi teacher 内容类型 schema
- 创建 TeamPage / TeamHeader / TeamFilter / TeamGrid / TeacherCard / TeacherDetail 组件
- TDD 测试
- 注册路由 /team

### 任务 B：校区页面（总览 + 详情）
- 创建 Strapi campus 内容类型 schema
- 创建 CampusOverviewPage / CampusCard / CampusDetailPage / CampusGallery / CampusInfoCard 组件
- TDD 测试
- 注册路由 /campuses 和 /campuses/:slug

### 任务 C：路由修复 + 关于我们/联系我们数据
- 修复 App.tsx `/:slug` 路由 bug
- 创建 Strapi page 数据（about-school / about-philosophy / about-honors / contact）
- 更新导航栏二级菜单链接
- 验证 PageRenderer 渲染

---

## 10. Strapi v5 踩坑记录（已固化）

1. **自定义路由 path 不要加 `/api` 前缀** — Strapi v5 自动添加，会导致 `/api/api/...` 双重前缀
2. **自定义控制器要手动包装 `attributes` 字段** — 前端期望 `{ data: { id, attributes: {...} } }` 格式
3. **`--open false` 而非 `--no-open`** — Strapi v5 CLI 不识别 `--no-open`
4. **repeatable component 返回直接数组** — 需用 `Array.isArray()` 兼容性检查
