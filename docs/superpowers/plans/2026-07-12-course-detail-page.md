# 课程详情页实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 4 个课程（语言启蒙/数学思维/英语口语/综合素养）创建丰富的详情页，展示学习目标、课程大纲、教学方法、家长评价等信息。

**架构：** 后端添加 `/api/products/slug/:slug` 自定义路由（含 populate），前端新增 6 个 React 组件（CourseHeader / CourseObjectives / CourseOutline / CourseTestimonials / CourseCTA / CourseDetail），注册 `/courses/:slug` 路由。

**技术栈：** Strapi v5（后端）、React 18 + TypeScript + Tailwind CSS（前端）、Vitest + Testing Library（测试）、TRAE 内建浏览器（视觉验证）

---

## 文件结构

### 后端修改

| 文件 | 操作 | 职责 |
|------|------|------|
| `backend/src/api/product/routes/custom.ts` | 修改 | 添加 `/api/products/slug/:slug` 路由 |
| `backend/src/api/product/controllers/product.ts` | 修改 | 添加 `findBySlug` 方法，populate 新字段 |

### 前端修改

| 文件 | 操作 | 职责 |
|------|------|------|
| `frontend/src/lib/api.ts` | 修改 | 更新 Product 接口，添加新字段类型 |
| `frontend/src/components/course/CourseHeader.tsx` | 创建 | 课程头部（icon/名称/标签） |
| `frontend/src/components/course/CourseObjectives.tsx` | 创建 | 学习目标列表 |
| `frontend/src/components/course/CourseOutline.tsx` | 创建 | 课程大纲时间轴 |
| `frontend/src/components/course/CourseTestimonials.tsx` | 创建 | 家长评价卡片 |
| `frontend/src/components/course/CourseCTA.tsx` | 创建 | 预约按钮 |
| `frontend/src/components/course/CourseDetail.tsx` | 创建 | 页面容器，获取数据并渲染各区块 |
| `frontend/src/components/course/__tests__/CourseHeader.test.tsx` | 创建 | CourseHeader 测试 |
| `frontend/src/components/course/__tests__/CourseObjectives.test.tsx` | 创建 | CourseObjectives 测试 |
| `frontend/src/components/course/__tests__/CourseOutline.test.tsx` | 创建 | CourseOutline 测试 |
| `frontend/src/components/course/__tests__/CourseTestimonials.test.tsx` | 创建 | CourseTestimonials 测试 |
| `frontend/src/components/course/__tests__/CourseCTA.test.tsx` | 创建 | CourseCTA 测试 |
| `frontend/src/components/course/__tests__/CourseDetail.test.tsx` | 创建 | CourseDetail 集成测试 |
| `frontend/src/App.tsx` | 修改 | 注册 `/courses/:slug` 路由 |
| `frontend/src/components/sections/ProductGrid.tsx` | 修改 | 修复"查看详情"链接指向 `/courses/:slug` |

---

## 任务 1：后端 — 添加 slug 路由和控制器

**文件：**
- 修改：`backend/src/api/product/routes/custom.ts`
- 修改：`backend/src/api/product/controllers/product.ts`

- [ ] **步骤 1：在 custom.ts 添加 slug 路由**

在 `backend/src/api/product/routes/custom.ts` 的 `routes` 数组末尾（`withCategory` 路由之后）添加：

```typescript
    {
      method: 'GET',
      path: '/api/products/slug/:slug',
      handler: 'product.findBySlug',
      config: {
        auth: false,
      },
    },
```

- [ ] **步骤 2：在 product.ts 控制器添加 findBySlug 方法**

在 `backend/src/api/product/controllers/product.ts` 的 `withCategory` 方法之后（`}` 闭合括号之前）添加：

```typescript
  async findBySlug(ctx) {
    const { slug } = ctx.params;
    
    console.log('[Product findBySlug] Request:', { slug });
    
    if (!slug) {
      ctx.status = 400;
      ctx.body = { error: '请提供课程 slug' };
      return;
    }
    
    try {
      const product = await strapi.db.query('api::product.product').findOne({
        where: { slug, publishedAt: { $notNull: true } },
        populate: ['thumbnail', 'images', 'categories', 'objectives', 'outline', 'testimonials'],
      });
      
      if (!product) {
        ctx.status = 404;
        ctx.body = { error: '课程不存在' };
        return;
      }
      
      console.log('[Product findBySlug] Found:', product.name);
      
      ctx.body = {
        data: {
          id: product.id,
          documentId: product.documentId,
          ...product,
        },
        meta: {},
      };
    } catch (error) {
      console.error('[Product findBySlug] Error:', error);
      ctx.status = 500;
      ctx.body = {
        error: '获取课程失败',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
```

- [ ] **步骤 3：重启 Strapi 验证路由**

运行：`cd backend && npm run develop`

验证：`curl -s http://localhost:1337/api/products/slug/language | python3 -m json.tool`

预期：返回包含 `objectives`、`outline`、`testimonials`、`teachingMethod` 字段的产品数据

- [ ] **步骤 4：Commit**

```bash
git add backend/src/api/product/routes/custom.ts backend/src/api/product/controllers/product.ts
git commit -m "feat(backend): 添加 /api/products/slug/:slug 路由，populate 课程详情字段"
```

---

## 任务 2：前端 — 更新 Product 接口和类型定义

**文件：**
- 修改：`frontend/src/lib/api.ts`

- [ ] **步骤 1：在 api.ts 中更新 Product 接口**

在 `frontend/src/lib/api.ts` 找到 `export interface Product`（约第 277 行），在 `attributes` 对象内添加新字段：

```typescript
export interface CourseObjective {
  id: number;
  title: string;
  description?: string;
}

export interface CourseModule {
  id: number;
  title: string;
  description?: string;
  lessonCount?: number;
}

export interface CourseTestimonial {
  id: number;
  parentName: string;
  content: string;
  rating?: number;
}

export interface Product {
  id: number;
  attributes: {
    name: string;
    slug: string;
    description?: string;
    shortDescription?: string;
    price?: number;
    originalPrice?: number;
    image?: { data?: { attributes: { url: string } } };
    images?: { data: { attributes: { url: string } }[] };
    isFeatured?: boolean;
    isNew?: boolean;
    categories?: { data: ProductCategory[] };
    specs?: { data: ProductSpec[] };
    specValues?: Record<string, string>;
    teachingMethod?: string;
    objectives?: CourseObjective[];
    outline?: CourseModule[];
    testimonials?: CourseTestimonial[];
    createdAt?: string;
    updatedAt?: string;
  };
}
```

- [ ] **步骤 2：验证类型检查通过**

运行：`cd frontend && npx tsc --noEmit`

预期：无类型错误

- [ ] **步骤 3：Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(frontend): 更新 Product 接口，添加课程详情字段类型"
```

---

## 任务 3：TDD — CourseHeader 组件

**文件：**
- 创建：`frontend/src/components/course/__tests__/CourseHeader.test.tsx`
- 创建：`frontend/src/components/course/CourseHeader.tsx`

- [ ] **步骤 1：编写失败的测试**

创建 `frontend/src/components/course/__tests__/CourseHeader.test.tsx`：

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CourseHeader from '../CourseHeader';

const mockProduct = {
  id: 1,
  attributes: {
    name: '语言启蒙',
    slug: 'language',
    shortDescription: '培养孩子语言表达能力与阅读兴趣',
    specValues: {
      course_hours: '48课时',
      class_size: '小班12人',
      age_range: '4-6岁',
      duration: '6个月',
    },
  },
};

describe('CourseHeader 组件', () => {
  it('渲染课程名称', () => {
    render(<CourseHeader product={mockProduct as any} />);
    expect(screen.getByRole('heading', { name: '语言启蒙' })).toBeInTheDocument();
  });

  it('渲染课程简短描述', () => {
    render(<CourseHeader product={mockProduct as any} />);
    expect(screen.getByText('培养孩子语言表达能力与阅读兴趣')).toBeInTheDocument();
  });

  it('渲染规格标签', () => {
    render(<CourseHeader product={mockProduct as any} />);
    expect(screen.getByText('48课时')).toBeInTheDocument();
    expect(screen.getByText('小班12人')).toBeInTheDocument();
    expect(screen.getByText('4-6岁')).toBeInTheDocument();
    expect(screen.getByText('6个月')).toBeInTheDocument();
  });

  it('缺失 specValues 时不崩溃', () => {
    const noSpecs = { id: 2, attributes: { name: '测试课程', slug: 'test' } };
    render(<CourseHeader product={noSpecs as any} />);
    expect(screen.getByRole('heading', { name: '测试课程' })).toBeInTheDocument();
  });

  it('缺失 shortDescription 时不崩溃', () => {
    const noDesc = { id: 3, attributes: { name: '无描述课程', slug: 'nodesc', specValues: {} } };
    render(<CourseHeader product={noDesc as any} />);
    expect(screen.getByRole('heading', { name: '无描述课程' })).toBeInTheDocument();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd frontend && npx vitest run src/components/course/__tests__/CourseHeader.test.tsx`

预期：FAIL，报错 "Cannot find module '../CourseHeader'"

- [ ] **步骤 3：编写 CourseHeader 实现**

创建 `frontend/src/components/course/CourseHeader.tsx`：

```typescript
import { Clock, Users, Calendar, GraduationCap } from 'lucide-react';
import type { Product } from '../../lib/api';

const specConfig: Record<string, { label: string; icon: React.ComponentType<{ size?: number }> }> = {
  course_hours: { label: '课时', icon: Clock },
  class_size: { label: '班额', icon: Users },
  age_range: { label: '年龄', icon: GraduationCap },
  duration: { label: '周期', icon: Calendar },
};

export default function CourseHeader({ product }: { product: Product }) {
  const { name, shortDescription, specValues } = product.attributes;

  return (
    <section className="py-16 bg-gradient-to-b from-[#FFF3E5] to-background">
      <div className="max-w-[1400px] mx-auto px-8">
        <h1
          className="text-[#1C2B3A] mb-4"
          style={{
            fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
            fontSize: '2.5rem',
            fontWeight: 800,
          }}
        >
          {name}
        </h1>
        {shortDescription && (
          <p className="text-muted-foreground text-lg mb-8 max-w-[640px]">
            {shortDescription}
          </p>
        )}
        {specValues && Object.keys(specValues).length > 0 && (
          <div className="flex flex-wrap gap-4">
            {Object.entries(specValues).map(([key, value]) => {
              const config = specConfig[key];
              if (!config) return null;
              const Icon = config.icon;
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border shadow-sm"
                >
                  <Icon size={16} />
                  <span className="text-sm font-medium text-[#1C2B3A]">{value}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd frontend && npx vitest run src/components/course/__tests__/CourseHeader.test.tsx`

预期：PASS，5 个测试全部通过

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/components/course/CourseHeader.tsx frontend/src/components/course/__tests__/CourseHeader.test.tsx
git commit -m "feat(frontend): CourseHeader 组件 — 课程名称/描述/规格标签"
```

---

## 任务 4：TDD — CourseObjectives 组件

**文件：**
- 创建：`frontend/src/components/course/__tests__/CourseObjectives.test.tsx`
- 创建：`frontend/src/components/course/CourseObjectives.tsx`

- [ ] **步骤 1：编写失败的测试**

创建 `frontend/src/components/course/__tests__/CourseObjectives.test.tsx`：

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CourseObjectives from '../CourseObjectives';

const mockObjectives = [
  { id: 1, title: '掌握 500+ 词汇量', description: '通过绘本和游戏积累基础词汇' },
  { id: 2, title: '提升表达能力', description: '能完整叙述简单故事' },
  { id: 3, title: '培养阅读兴趣', description: '养成自主阅读习惯' },
];

describe('CourseObjectives 组件', () => {
  it('渲染区块标题', () => {
    render(<CourseObjectives objectives={mockObjectives} />);
    expect(screen.getByRole('heading', { name: '学习目标' })).toBeInTheDocument();
  });

  it('渲染所有目标项', () => {
    render(<CourseObjectives objectives={mockObjectives} />);
    expect(screen.getByText('掌握 500+ 词汇量')).toBeInTheDocument();
    expect(screen.getByText('提升表达能力')).toBeInTheDocument();
    expect(screen.getByText('培养阅读兴趣')).toBeInTheDocument();
  });

  it('渲染目标描述', () => {
    render(<CourseObjectives objectives={mockObjectives} />);
    expect(screen.getByText('通过绘本和游戏积累基础词汇')).toBeInTheDocument();
  });

  it('空数组时不渲染区块', () => {
    const { container } = render(<CourseObjectives objectives={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('objectives 为 undefined 时不崩溃', () => {
    const { container } = render(<CourseObjectives objectives={undefined as any} />);
    expect(container.firstChild).toBeNull();
  });

  it('目标项无 description 时不崩溃', () => {
    const noDesc = [{ id: 1, title: '无描述目标' }];
    render(<CourseObjectives objectives={noDesc as any} />);
    expect(screen.getByText('无描述目标')).toBeInTheDocument();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd frontend && npx vitest run src/components/course/__tests__/CourseObjectives.test.tsx`

预期：FAIL，报错 "Cannot find module '../CourseObjectives'"

- [ ] **步骤 3：编写 CourseObjectives 实现**

创建 `frontend/src/components/course/CourseObjectives.tsx`：

```typescript
import { Target } from 'lucide-react';
import type { CourseObjective } from '../../lib/api';

export default function CourseObjectives({ objectives }: { objectives?: CourseObjective[] }) {
  if (!objectives || objectives.length === 0) return null;

  return (
    <section className="py-16 bg-background">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-[#FFF3E5] flex items-center justify-center">
            <Target size={20} className="text-[#F5851F]" />
          </div>
          <h2
            className="text-[#1C2B3A]"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: '1.75rem',
              fontWeight: 700,
            }}
          >
            学习目标
          </h2>
        </div>
        <div className="grid grid-cols-12 gap-6">
          {objectives.map((obj, index) => (
            <div key={obj.id} className="col-span-12 sm:col-span-6 lg:col-span-4">
              <div className="h-full bg-card rounded-2xl p-6 border border-border shadow-sm flex gap-4">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-full bg-[#F5851F] text-white flex items-center justify-center font-bold"
                >
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-[#1C2B3A] mb-2">{obj.title}</h3>
                  {obj.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{obj.description}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd frontend && npx vitest run src/components/course/__tests__/CourseObjectives.test.tsx`

预期：PASS，6 个测试全部通过

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/components/course/CourseObjectives.tsx frontend/src/components/course/__tests__/CourseObjectives.test.tsx
git commit -m "feat(frontend): CourseObjectives 组件 — 学习目标列表"
```

---

## 任务 5：TDD — CourseOutline 组件

**文件：**
- 创建：`frontend/src/components/course/__tests__/CourseOutline.test.tsx`
- 创建：`frontend/src/components/course/CourseOutline.tsx`

- [ ] **步骤 1：编写失败的测试**

创建 `frontend/src/components/course/__tests__/CourseOutline.test.tsx`：

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CourseOutline from '../CourseOutline';

const mockOutline = [
  { id: 1, title: '第 1-12 课：基础词汇', description: '通过绘本认识基础汉字和词语', lessonCount: 12 },
  { id: 2, title: '第 13-24 课：句子表达', description: '学习完整句子的构造和表达', lessonCount: 12 },
  { id: 3, title: '第 25-36 课：故事阅读', description: '阅读简单故事并复述', lessonCount: 12 },
  { id: 4, title: '第 37-48 课：综合应用', description: '综合运用语言能力', lessonCount: 12 },
];

describe('CourseOutline 组件', () => {
  it('渲染区块标题', () => {
    render(<CourseOutline outline={mockOutline} />);
    expect(screen.getByRole('heading', { name: '课程大纲' })).toBeInTheDocument();
  });

  it('渲染所有大纲模块', () => {
    render(<CourseOutline outline={mockOutline} />);
    expect(screen.getByText('第 1-12 课：基础词汇')).toBeInTheDocument();
    expect(screen.getByText('第 13-24 课：句子表达')).toBeInTheDocument();
    expect(screen.getByText('第 25-36 课：故事阅读')).toBeInTheDocument();
    expect(screen.getByText('第 37-48 课：综合应用')).toBeInTheDocument();
  });

  it('渲染课时数', () => {
    render(<CourseOutline outline={mockOutline} />);
    expect(screen.getAllByText(/12 课时/)).toHaveLength(4);
  });

  it('渲染模块描述', () => {
    render(<CourseOutline outline={mockOutline} />);
    expect(screen.getByText('通过绘本认识基础汉字和词语')).toBeInTheDocument();
  });

  it('空数组时不渲染区块', () => {
    const { container } = render(<CourseOutline outline={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('outline 为 undefined 时不崩溃', () => {
    const { container } = render(<CourseOutline outline={undefined as any} />);
    expect(container.firstChild).toBeNull();
  });

  it('lessonCount 为 0 时不显示课时数', () => {
    const zeroCount = [{ id: 1, title: '测试模块', description: '描述', lessonCount: 0 }];
    render(<CourseOutline outline={zeroCount as any} />);
    expect(screen.getByText('测试模块')).toBeInTheDocument();
    expect(screen.queryByText(/课时/)).not.toBeInTheDocument();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd frontend && npx vitest run src/components/course/__tests__/CourseOutline.test.tsx`

预期：FAIL，报错 "Cannot find module '../CourseOutline'"

- [ ] **步骤 3：编写 CourseOutline 实现**

创建 `frontend/src/components/course/CourseOutline.tsx`：

```typescript
import { BookOpen } from 'lucide-react';
import type { CourseModule } from '../../lib/api';

export default function CourseOutline({ outline }: { outline?: CourseModule[] }) {
  if (!outline || outline.length === 0) return null;

  return (
    <section className="py-16 bg-muted/30">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center">
            <BookOpen size={20} className="text-[#2563EB]" />
          </div>
          <h2
            className="text-[#1C2B3A]"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: '1.75rem',
              fontWeight: 700,
            }}
          >
            课程大纲
          </h2>
        </div>
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
          <div className="space-y-6">
            {outline.map((module, index) => (
              <div key={module.id} className="relative flex gap-6">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-full bg-card border-2 border-[#2563EB] flex items-center justify-center font-bold text-[#2563EB] z-10"
                >
                  {index + 1}
                </div>
                <div className="flex-1 bg-card rounded-2xl p-6 border border-border shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-[#1C2B3A]">{module.title}</h3>
                    {module.lessonCount && module.lessonCount > 0 && (
                      <span className="text-sm text-[#2563EB] font-medium bg-[#EFF6FF] px-3 py-1 rounded-full">
                        {module.lessonCount} 课时
                      </span>
                    )}
                  </div>
                  {module.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{module.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd frontend && npx vitest run src/components/course/__tests__/CourseOutline.test.tsx`

预期：PASS，7 个测试全部通过

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/components/course/CourseOutline.tsx frontend/src/components/course/__tests__/CourseOutline.test.tsx
git commit -m "feat(frontend): CourseOutline 组件 — 课程大纲时间轴"
```

---

## 任务 6：TDD — CourseTestimonials 组件

**文件：**
- 创建：`frontend/src/components/course/__tests__/CourseTestimonials.test.tsx`
- 创建：`frontend/src/components/course/CourseTestimonials.tsx`

- [ ] **步骤 1：编写失败的测试**

创建 `frontend/src/components/course/__tests__/CourseTestimonials.test.tsx`：

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CourseTestimonials from '../CourseTestimonials';

const mockTestimonials = [
  { id: 1, parentName: '张妈妈', content: '孩子上了一学期，语言表达能力明显提升！', rating: 5 },
  { id: 2, parentName: '李爸爸', content: '老师很专业，孩子很喜欢上课。', rating: 5 },
  { id: 3, parentName: '王妈妈', content: '课程设计科学，效果显著。', rating: 4 },
];

describe('CourseTestimonials 组件', () => {
  it('渲染区块标题', () => {
    render(<CourseTestimonials testimonials={mockTestimonials} />);
    expect(screen.getByRole('heading', { name: '家长评价' })).toBeInTheDocument();
  });

  it('渲染所有评价', () => {
    render(<CourseTestimonials testimonials={mockTestimonials} />);
    expect(screen.getByText('张妈妈')).toBeInTheDocument();
    expect(screen.getByText('李爸爸')).toBeInTheDocument();
    expect(screen.getByText('王妈妈')).toBeInTheDocument();
  });

  it('渲染评价内容', () => {
    render(<CourseTestimonials testimonials={mockTestimonials} />);
    expect(screen.getByText('孩子上了一学期，语言表达能力明显提升！')).toBeInTheDocument();
  });

  it('渲染 5 星评分', () => {
    render(<CourseTestimonials testimonials={mockTestimonials} />);
    const fiveStarItems = screen.getAllByText('★');
    expect(fiveStarItems.length).toBeGreaterThanOrEqual(5);
  });

  it('空数组时不渲染区块', () => {
    const { container } = render(<CourseTestimonials testimonials={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('testimonials 为 undefined 时不崩溃', () => {
    const { container } = render(<CourseTestimonials testimonials={undefined as any} />);
    expect(container.firstChild).toBeNull();
  });

  it('无 rating 时默认 5 星', () => {
    const noRating = [{ id: 1, parentName: '赵妈妈', content: '还不错' }];
    render(<CourseTestimonials testimonials={noRating as any} />);
    expect(screen.getByText('赵妈妈')).toBeInTheDocument();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd frontend && npx vitest run src/components/course/__tests__/CourseTestimonials.test.tsx`

预期：FAIL，报错 "Cannot find module '../CourseTestimonials'"

- [ ] **步骤 3：编写 CourseTestimonials 实现**

创建 `frontend/src/components/course/CourseTestimonials.tsx`：

```typescript
import { MessageSquare } from 'lucide-react';
import type { CourseTestimonial } from '../../lib/api';

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} 星评分`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={star <= rating ? 'text-[#F5851F]' : 'text-muted-foreground/30'}
          style={{ fontSize: '1rem' }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export default function CourseTestimonials({ testimonials }: { testimonials?: CourseTestimonial[] }) {
  if (!testimonials || testimonials.length === 0) return null;

  return (
    <section className="py-16 bg-background">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] flex items-center justify-center">
            <MessageSquare size={20} className="text-[#059669]" />
          </div>
          <h2
            className="text-[#1C2B3A]"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: '1.75rem',
              fontWeight: 700,
            }}
          >
            家长评价
          </h2>
        </div>
        <div className="grid grid-cols-12 gap-6">
          {testimonials.map((t) => (
            <div key={t.id} className="col-span-12 sm:col-span-6 lg:col-span-4">
              <div className="h-full bg-card rounded-2xl p-6 border border-border shadow-sm">
                <StarRating rating={t.rating || 5} />
                <p className="text-sm text-muted-foreground leading-relaxed my-4">{t.content}</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#FFF3E5] flex items-center justify-center text-[#F5851F] font-bold text-sm">
                    {t.parentName.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-[#1C2B3A]">{t.parentName}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd frontend && npx vitest run src/components/course/__tests__/CourseTestimonials.test.tsx`

预期：PASS，7 个测试全部通过

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/components/course/CourseTestimonials.tsx frontend/src/components/course/__tests__/CourseTestimonials.test.tsx
git commit -m "feat(frontend): CourseTestimonials 组件 — 家长评价卡片"
```

---

## 任务 7：TDD — CourseCTA 组件

**文件：**
- 创建：`frontend/src/components/course/__tests__/CourseCTA.test.tsx`
- 创建：`frontend/src/components/course/CourseCTA.tsx`

- [ ] **步骤 1：编写失败的测试**

创建 `frontend/src/components/course/__tests__/CourseCTA.test.tsx`：

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CourseCTA from '../CourseCTA';

const renderWithRouter = (courseName: string) => {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<CourseCTA courseName={courseName} />} />
        <Route path="/appointment-success" element={<div>预约页面</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('CourseCTA 组件', () => {
  it('渲染 CTA 标题', () => {
    renderWithRouter('语言启蒙');
    expect(screen.getByText(/预约免费试听/)).toBeInTheDocument();
  });

  it('渲染课程名称', () => {
    renderWithRouter('语言启蒙');
    expect(screen.getByText('语言启蒙')).toBeInTheDocument();
  });

  it('渲染预约按钮', () => {
    renderWithRouter('语言启蒙');
    expect(screen.getByRole('link', { name: /立即预约/ })).toBeInTheDocument();
  });

  it('预约按钮链接到首页预约表单', () => {
    renderWithRouter('语言启蒙');
    const link = screen.getByRole('link', { name: /立即预约/ });
    expect(link).toHaveAttribute('href', '/?course=语言启蒙#appointment');
  });

  it('课程名称为空时仍渲染按钮', () => {
    renderWithRouter('');
    expect(screen.getByRole('link', { name: /立即预约/ })).toBeInTheDocument();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd frontend && npx vitest run src/components/course/__tests__/CourseCTA.test.tsx`

预期：FAIL，报错 "Cannot find module '../CourseCTA'"

- [ ] **步骤 3：编写 CourseCTA 实现**

创建 `frontend/src/components/course/CourseCTA.tsx`：

```typescript
import { Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CourseCTA({ courseName }: { courseName: string }) {
  return (
    <section className="py-16 bg-gradient-to-r from-[#F5851F] to-[#FF8C00]">
      <div className="max-w-[1400px] mx-auto px-8 text-center">
        <h2
          className="text-white mb-4"
          style={{
            fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
            fontSize: '2rem',
            fontWeight: 800,
          }}
        >
          预约免费试听{courseName ? ` — ${courseName}` : ''}
        </h2>
        <p className="text-white/90 text-base mb-8 max-w-[480px] mx-auto">
          立即预约，让孩子体验专业、有趣的课程
        </p>
        <Link
          to={`/?course=${encodeURIComponent(courseName)}#appointment`}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-white text-[#F5851F] font-bold text-base hover:bg-white/90 transition-colors duration-200 shadow-lg"
        >
          <Calendar size={20} />
          立即预约
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd frontend && npx vitest run src/components/course/__tests__/CourseCTA.test.tsx`

预期：PASS，5 个测试全部通过

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/components/course/CourseCTA.tsx frontend/src/components/course/__tests__/CourseCTA.test.tsx
git commit -m "feat(frontend): CourseCTA 组件 — 预约 CTA 按钮"
```

---

## 任务 8：TDD — CourseDetail 页面容器

**文件：**
- 创建：`frontend/src/components/course/__tests__/CourseDetail.test.tsx`
- 创建：`frontend/src/components/course/CourseDetail.tsx`

- [ ] **步骤 1：编写失败的测试**

创建 `frontend/src/components/course/__tests__/CourseDetail.test.tsx`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CourseDetail from '../CourseDetail';

vi.mock('../../../lib/api', () => ({
  getProductBySlug: vi.fn(),
}));

import { getProductBySlug } from '../../../lib/api';

const mockProduct = {
  id: 1,
  attributes: {
    name: '语言启蒙',
    slug: 'language',
    description: '通过绘本阅读、儿歌律动等方式培养语言能力。',
    shortDescription: '培养孩子语言表达能力与阅读兴趣',
    specValues: { course_hours: '48课时', class_size: '小班12人', age_range: '4-6岁', duration: '6个月' },
    teachingMethod: '采用沉浸式教学法，结合绘本和游戏。',
    objectives: [
      { id: 1, title: '掌握 500+ 词汇量', description: '通过绘本积累词汇' },
    ],
    outline: [
      { id: 1, title: '第 1-12 课：基础词汇', description: '认识基础汉字', lessonCount: 12 },
    ],
    testimonials: [
      { id: 1, parentName: '张妈妈', content: '效果很好！', rating: 5 },
    ],
  },
};

describe('CourseDetail 页面', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('加载中显示 loading', () => {
    vi.mocked(getProductBySlug).mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter>
        <CourseDetail slug="language" />
      </MemoryRouter>
    );
    expect(screen.getByText(/加载中/)).toBeInTheDocument();
  });

  it('加载成功后渲染课程名称', async () => {
    vi.mocked(getProductBySlug).mockResolvedValueOnce({ data: mockProduct } as any);
    render(
      <MemoryRouter>
        <CourseDetail slug="language" />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '语言启蒙' })).toBeInTheDocument();
    });
  });

  it('渲染课程描述', async () => {
    vi.mocked(getProductBySlug).mockResolvedValueOnce({ data: mockProduct } as any);
    render(
      <MemoryRouter>
        <CourseDetail slug="language" />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/通过绘本阅读/)).toBeInTheDocument();
    });
  });

  it('渲染学习目标区块', async () => {
    vi.mocked(getProductBySlug).mockResolvedValueOnce({ data: mockProduct } as any);
    render(
      <MemoryRouter>
        <CourseDetail slug="language" />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '学习目标' })).toBeInTheDocument();
    });
  });

  it('渲染课程大纲区块', async () => {
    vi.mocked(getProductBySlug).mockResolvedValueOnce({ data: mockProduct } as any);
    render(
      <MemoryRouter>
        <CourseDetail slug="language" />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '课程大纲' })).toBeInTheDocument();
    });
  });

  it('渲染家长评价区块', async () => {
    vi.mocked(getProductBySlug).mockResolvedValueOnce({ data: mockProduct } as any);
    render(
      <MemoryRouter>
        <CourseDetail slug="language" />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '家长评价' })).toBeInTheDocument();
    });
  });

  it('渲染预约 CTA 按钮', async () => {
    vi.mocked(getProductBySlug).mockResolvedValueOnce({ data: mockProduct } as any);
    render(
      <MemoryRouter>
        <CourseDetail slug="language" />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /立即预约/ })).toBeInTheDocument();
    });
  });

  it('课程不存在时显示 404', async () => {
    vi.mocked(getProductBySlug).mockRejectedValueOnce(new Error('Not found'));
    render(
      <MemoryRouter>
        <CourseDetail slug="nonexistent" />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/课程不存在|找不到/)).toBeInTheDocument();
    });
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd frontend && npx vitest run src/components/course/__tests__/CourseDetail.test.tsx`

预期：FAIL，报错 "Cannot find module '../CourseDetail'"

- [ ] **步骤 3：编写 CourseDetail 实现**

创建 `frontend/src/components/course/CourseDetail.tsx`：

```typescript
import { useEffect, useState } from 'react';
import { getProductBySlug, type Product } from '../../lib/api';
import CourseHeader from './CourseHeader';
import CourseObjectives from './CourseObjectives';
import CourseOutline from './CourseOutline';
import CourseTestimonials from './CourseTestimonials';
import CourseCTA from './CourseCTA';

export default function CourseDetail({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getProductBySlug(slug)
      .then((res) => {
        if (!cancelled) {
          setProduct(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[CourseDetail] 加载失败:', err);
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="py-32 text-center text-muted-foreground">加载中...</div>
    );
  }

  if (error || !product) {
    return (
      <div className="py-32 text-center">
        <h1 className="text-2xl font-bold text-[#1C2B3A] mb-4">课程不存在</h1>
        <p className="text-muted-foreground">您访问的课程可能已下架或链接有误。</p>
      </div>
    );
  }

  const { attributes } = product;

  return (
    <>
      <CourseHeader product={product} />
      
      {attributes.description && (
        <section className="py-16 bg-background">
          <div className="max-w-[1400px] mx-auto px-8">
            <h2
              className="text-[#1C2B3A] mb-6"
              style={{
                fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                fontSize: '1.75rem',
                fontWeight: 700,
              }}
            >
              课程介绍
            </h2>
            <div className="prose prose-lg max-w-none text-muted-foreground leading-relaxed">
              {attributes.description}
            </div>
          </div>
        </section>
      )}

      <CourseObjectives objectives={attributes.objectives} />
      <CourseOutline outline={attributes.outline} />

      {attributes.teachingMethod && (
        <section className="py-16 bg-muted/30">
          <div className="max-w-[1400px] mx-auto px-8">
            <h2
              className="text-[#1C2B3A] mb-6"
              style={{
                fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                fontSize: '1.75rem',
                fontWeight: 700,
              }}
            >
              教学方法
            </h2>
            <div className="prose prose-lg max-w-none text-muted-foreground leading-relaxed">
              {attributes.teachingMethod}
            </div>
          </div>
        </section>
      )}

      <CourseTestimonials testimonials={attributes.testimonials} />
      <CourseCTA courseName={attributes.name} />
    </>
  );
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd frontend && npx vitest run src/components/course/__tests__/CourseDetail.test.tsx`

预期：PASS，8 个测试全部通过

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/components/course/CourseDetail.tsx frontend/src/components/course/__tests__/CourseDetail.test.tsx
git commit -m "feat(frontend): CourseDetail 页面容器 — 数据获取和区块编排"
```

---

## 任务 9：路由注册和 ProductGrid 链接修复

**文件：**
- 修改：`frontend/src/App.tsx`
- 修改：`frontend/src/components/sections/ProductGrid.tsx`

- [ ] **步骤 1：在 App.tsx 注册 /courses/:slug 路由**

在 `frontend/src/App.tsx` 的 `<Routes>` 中添加课程详情路由：

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './layout/Layout';
import PageRenderer from './pages/PageRenderer';
import AppointmentSuccess from './pages/AppointmentSuccess';
import CourseDetail from './components/course/CourseDetail';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><PageRenderer /></Layout>} />
        <Route path="/:slug" element={<Layout><PageRenderer slug={''} /></Layout>} />
        <Route path="/courses/:slug" element={<Layout><CourseDetail slug="" /></Layout>} />
        <Route path="/appointment-success" element={<AppointmentSuccess />} />
      </Routes>
    </BrowserRouter>
  );
}
```

注意：`CourseDetail` 需要 `slug` prop，从路由参数获取。需要用 `useParams` 包装。创建 `frontend/src/pages/CourseDetailPage.tsx`：

```typescript
import { useParams } from 'react-router-dom';
import CourseDetail from '../components/course/CourseDetail';

export default function CourseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  return <CourseDetail slug={slug || ''} />;
}
```

然后 App.tsx 改为：

```typescript
import CourseDetailPage from './pages/CourseDetailPage';

// 路由改为：
<Route path="/courses/:slug" element={<Layout><CourseDetailPage /></Layout>} />
```

- [ ] **步骤 2：修复 ProductGrid 的"查看详情"链接**

在 `frontend/src/components/sections/ProductGrid.tsx` 中，找到课程卡片的链接，改为 `/courses/${slug}`。

先读取 ProductGrid.tsx 当前内容，找到渲染课程卡片的代码，将链接从可能的 `#` 或其他改为：

```typescript
<Link to={`/courses/${product.attributes.slug}`}>
  查看详情
</Link>
```

- [ ] **步骤 3：运行全部前端测试**

运行：`cd frontend && npx vitest run`

预期：所有测试通过（包括之前的 54 个测试 + 新增的课程详情页测试）

- [ ] **步骤 4：Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/CourseDetailPage.tsx frontend/src/components/sections/ProductGrid.tsx
git commit -m "feat(frontend): 注册 /courses/:slug 路由，修复 ProductGrid 详情链接"
```

---

## 任务 10：TRAE 内建浏览器视觉验证

**文件：** 无（使用 TRAE 内建浏览器工具）

- [ ] **步骤 1：确认前后端服务运行中**

后端：`curl -s http://localhost:1337/_health` 返回 204
前端：`curl -s http://localhost:5173` 返回 HTML

- [ ] **步骤 2：用 TRAE 内建浏览器导航到课程详情页**

使用 `browser_navigate` 导航到 `http://localhost:5173/courses/language`

- [ ] **步骤 3：截取全页截图**

使用 `browser_take_screenshot` 保存为 `course-detail-language.png`

- [ ] **步骤 4：检查页面渲染**

使用 `browser_snapshot` 检查页面结构，确认：
- 课程头部（名称、描述、规格标签）正确显示
- 学习目标区块渲染（如果有数据）
- 课程大纲区块渲染（如果有数据）
- 家长评价区块渲染（如果有数据）
- 预约 CTA 按钮可见
- 无 console 错误

- [ ] **步骤 5：测试预约 CTA 跳转**

使用 `browser_click` 点击"立即预约"按钮，验证跳转到 `/?course=语言启蒙#appointment`

- [ ] **步骤 6：验证其他 3 个课程**

重复步骤 2-4，分别访问：
- `http://localhost:5173/courses/math`
- `http://localhost:5173/courses/english`
- `http://localhost:5173/courses/comprehensive`

- [ ] **步骤 7：验证 404 页面**

导航到 `http://localhost:5173/courses/nonexistent`，确认显示"课程不存在"提示

- [ ] **步骤 8：从首页课程区块点击进入**

导航到 `http://localhost:5173`，找到课程区块，点击"查看详情"，验证跳转到对应课程详情页

---

## 自检结果

### 1. 规格覆盖度

| 规格需求 | 对应任务 | 状态 |
|---------|---------|------|
| Strapi schema 迁移（3 component + 4 字段） | 已在 brainstorming 阶段完成 | ✅ |
| 后端 API 返回新字段 | 任务 1（slug 路由 + populate） | ✅ |
| 前端 Product 接口更新 | 任务 2 | ✅ |
| CourseHeader 组件 | 任务 3 | ✅ |
| CourseObjectives 组件 | 任务 4 | ✅ |
| CourseOutline 组件 | 任务 5 | ✅ |
| CourseTestimonials 组件 | 任务 6 | ✅ |
| CourseCTA 组件 | 任务 7 | ✅ |
| CourseDetail 页面容器 | 任务 8 | ✅ |
| 路由注册 | 任务 9 | ✅ |
| ProductGrid 链接修复 | 任务 9 | ✅ |
| 视觉验证 | 任务 10 | ✅ |

### 2. 占位符扫描

无占位符。所有代码步骤都包含完整代码。

### 3. 类型一致性

- `CourseObjective`、`CourseModule`、`CourseTestimonial` 在任务 2 定义，任务 4/5/6/8 使用
- `Product` 接口在任务 2 更新，任务 3/8 使用
- `getProductBySlug` 在任务 8 mock 并调用
- 所有组件 props 名称一致
