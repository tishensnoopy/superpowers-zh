# MeiliSearch 前端搜索 UI 设计

## 背景

后端 MeiliSearch 搜索 API 已完整实现（`GET /api/products/search`），支持关键词搜索、分类筛选、排序和分页。前端目前只有静态 `ProductGrid` 组件（`getProducts()` 一次性加载全部），无搜索/筛选/分页能力。

## 目标

为课程体系页面（`/courses`）构建搜索 + 筛选 + 排序 + 分页 UI，调用已有后端搜索 API。

## 后端 API 接口

**请求：**
```
GET /api/products/search?query=关键词&categorySlugs=language&sort=name:asc&page=1&limit=12
```

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| query | string | 搜索关键词 |
| categorySlugs | string[] | 分类 slug 筛选 |
| sort | string[] | 排序（如 `name:asc`, `price:asc`, `price:desc`） |
| page | int | 页码（默认 1） |
| limit | int | 每页条数（默认 20） |

**响应：**
```json
{
  "data": [{ "id": 1, "attributes": { "name": "...", "slug": "...", ... } }],
  "meta": { "total": 15, "page": 1, "pageSize": 12, "pageCount": 2 }
}
```

## 组件架构

```
CoursesPage
  └─ CourseSearchPanel (容器组件)
       ├─ useProductSearch (hook)
       │    └─ searchProducts() (API 函数)
       ├─ SearchBar
       ├─ CategoryFilter
       ├─ SortControl
       ├─ SearchResultsGrid
       └─ Pagination
```

## 组件接口

### searchProducts (API 函数)

文件：`frontend/src/lib/api.ts`

```typescript
export async function searchProducts(params: {
  query?: string;
  categorySlugs?: string[];
  sort?: string[];
  page?: number;
  limit?: number;
}): Promise<{ data: Product[]; meta: { total: number; page: number; pageSize: number; pageCount: number } }>;
```

### useProductSearch (Hook)

文件：`frontend/src/hooks/useProductSearch.ts`

```typescript
export function useProductSearch(initialLimit?: number): {
  query: string;
  category: string | null;
  sort: string | null;
  page: number;
  results: Product[];
  loading: boolean;
  error: string | null;
  total: number;
  pageCount: number;
  setQuery: (q: string) => void;
  setCategory: (c: string | null) => void;
  setSort: (s: string | null) => void;
  setPage: (p: number) => void;
  reset: () => void;
};
```

行为：
- query 变化后 300ms 防抖触发搜索
- category/sort 变化立即触发搜索，page 重置为 1
- page 变化立即触发搜索
- 初始加载时执行一次空搜索（获取全部课程）

### SearchBar

文件：`frontend/src/components/course/SearchBar.tsx`

```typescript
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}
```

- 带搜索图标的文本输入框
- onChange 实时回调（防抖由 hook 处理）

### CategoryFilter

文件：`frontend/src/components/course/CategoryFilter.tsx`

```typescript
interface CategoryFilterProps {
  categories: { id: number; attributes: { slug: string; name: string } }[];
  selected: string | null;
  onChange: (slug: string | null) => void;
}
```

- pill 按钮组，单选
- 首个按钮为"全部"（value=null）
- 选中态：橙色背景 + 白字

### SortControl

文件：`frontend/src/components/course/SortControl.tsx`

```typescript
interface SortControlProps {
  value: string | null;
  onChange: (value: string | null) => void;
}
```

- 下拉菜单
- 选项：默认排序(null) / 名称 A-Z(name:asc) / 价格从低到高(price:asc) / 价格从高到低(price:desc)

### SearchResultsGrid

文件：`frontend/src/components/course/SearchResultsGrid.tsx`

```typescript
interface SearchResultsGridProps {
  results: Product[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}
```

- loading=true：4 个骨架卡片
- error 非空：错误提示 + 重试按钮
- results 为空：空状态提示
- 正常：4 列卡片网格，复用 ProductGrid 卡片设计

### Pagination

文件：`frontend/src/components/course/Pagination.tsx`

```typescript
interface PaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}
```

- 上一页/下一页按钮 + 页码
- 当前页高亮
- 只有 1 页时不显示

## 并行分工

### Agent A：数据层

负责文件：
- `frontend/src/lib/api.ts`（仅追加 `searchProducts` 函数）
- `frontend/src/hooks/useProductSearch.ts`（新建）
- `frontend/src/hooks/__tests__/useProductSearch.test.ts`（新建）

TDD：先写测试再实现。

### Agent B：UI 组件层

负责文件：
- `frontend/src/components/course/SearchBar.tsx` + 测试
- `frontend/src/components/course/CategoryFilter.tsx` + 测试
- `frontend/src/components/course/SortControl.tsx` + 测试
- `frontend/src/components/course/SearchResultsGrid.tsx` + 测试
- `frontend/src/components/course/Pagination.tsx` + 测试

TDD：先写测试再实现。所有组件为纯展示组件（接收 props，不调 API）。

### 主 Agent：整合层

Agent A 和 B 完成后：
- 创建 `frontend/src/components/course/CourseSearchPanel.tsx`（容器组件）
- 更新 `frontend/src/pages/CoursesPage.tsx`
- 全量回归测试

## 测试计划

- searchProducts API 函数：URL 构造、参数序列化、响应解析
- useProductSearch hook：初始加载、防抖、筛选切换重置页码、错误处理
- SearchBar：输入回调、placeholder 渲染
- CategoryFilter：按钮渲染、选中态、切换回调
- SortControl：选项渲染、选中态、切换回调
- SearchResultsGrid：加载骨架、错误态、空态、正常网格
- Pagination：页码渲染、当前页高亮、边界禁用、切换回调
- CourseSearchPanel：组件组合、状态传递
- CoursesPage：集成渲染

## 设计决策

- 搜索防抖 300ms（避免逐字符请求）
- 分类单选（多选对课程场景过度复杂）
- 每页 12 条（4 列 × 3 行，视觉平衡）
- 骨架屏而非 spinner（更好的加载体验）
- 复用 ProductGrid 卡片样式（视觉一致）
