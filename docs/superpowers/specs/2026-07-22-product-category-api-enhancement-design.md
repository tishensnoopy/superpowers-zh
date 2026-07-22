# Phase 2：课程分类管理 API 增强 设计文档

> **创建日期：** 2026-07-22
> **状态：** 已确认，待编写实施计划
> **前置依赖：** Phase 1 实体关系重构已完成（commit a07e620）
> **工作流：** 本地开发 → 测试 → push → 服务器 pull（客户服务器暂不部署）

## 1. 背景与目标

现有 `product-category` content type 已具备基本的层级分类能力（parent/children 自引用、position 排序、isActive 状态、i18n 本地化、products manyToMany）。但存在以下缺陷：

1. **getCategoryTree 只支持一层子分类** — controller 用 `findMany({ populate: { children: ... } })` 只 populate 一层，无法返回真正的无限层级树
2. **无批量操作** — 只有单条 CRUD，无法批量调整排序或批量移动分类到新父级
3. **无验证逻辑** — 移动分类时不检测循环引用，删除有子分类的父分类时不拒绝
4. **controller 堆满 console.log** — 大量调试语句残留

**目标：** 在不改动数据模型、不新增前端 UI 的前提下，增强 product-category 的 API 能力，使其支持完整的无限层级分类管理。

## 2. 范围边界

### 包含

- `getCategoryTree` 改为递归无限层级
- 新增批量调序端点 `POST /product-categories/reorder`
- 新增批量移动端点 `POST /product-categories/move`
- 循环引用检测（move 操作）
- 删除拒绝（有子分类的父分类）
- slug 重复友好提示
- 清理 console.log 调试语句
- find/findOne 改用 `strapi.documents()` 模式（与 Phase 1 controller 一致）

### 不包含（YAGNI）

- 分类管理 UI（拖拽式可视化编辑）— 标记为 Phase 0 out-of-scope，用 Strapi 自带 admin 管理
- slug 层级内唯一性（保持现有全局唯一）
- 递归 SQL CTE（数据量小，不需要）
- 批量事务（Strapi v5 不原生支持，逐条更新可接受）
- 缓存层（数据量小，不需要）

## 3. 数据模型

**保持不变。** 现有 schema 已满足需求：

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string (i18n) | 分类名称 |
| slug | string (unique) | URL 路径，全局唯一 |
| description | text (i18n) | 分类描述 |
| image | media | 分类图标/封面图 |
| position | integer | 排序权重，数值越小越靠前 |
| isActive | boolean | 是否启用 |
| parent | manyToOne (self) | 父级分类 |
| children | oneToMany (self) | 子分类列表 |
| products | manyToMany | 此分类下的产品 |

唯一决策：`slug` 保持 `unique: true`（全局唯一），不改为层级内唯一。理由：现有前端 URL 依赖全局 slug，层级内唯一增加复杂度且收益有限。

## 4. getCategoryTree 递归策略

### 方案选择：一次查全量 + 内存组装树

分类数据量极小（教育机构通常几十条），递归 SQL CTE 是过度设计。采用：

1. `strapi.documents().findMany()` 一次查出所有 `isActive: true` 的分类（populate parent + image）
2. 在 service 层用 `buildTree(flatList)` 纯函数组装成嵌套树
3. 返回根分类数组，每个根分类的 `children` 递归含完整子树

### buildTree 纯函数规格

```typescript
interface CategoryNode {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description?: string;
  image?: any;
  position: number;
  isActive: boolean;
  children: CategoryNode[];
}

/**
 * 将扁平分类列表组装成嵌套树。
 * - 根节点：parent 为 null 的分类
 * - 按 position 升序排列
 * - 孤儿节点（parent 指向已删除的分类）作为根节点处理
 */
function buildTree(flatList: CategoryRow[]): CategoryNode[];
```

### 向后兼容

前端 CategoryFilter 等消费的仍是"根分类数组"，只是 children 现在是完整子树而非一层。无需前端改动。

## 5. 批量操作 API

### 5.1 批量调序 `POST /product-categories/reorder`

**请求：**
```json
{
  "items": [
    { "id": "docId1", "position": 0 },
    { "id": "docId2", "position": 1 },
    { "id": "docId3", "position": 2 }
  ]
}
```

**响应：**
```json
{
  "data": { "updated": 3 },
  "meta": {}
}
```

**行为：**
- 幂等：直接覆盖 position 值
- 用 document service 的 `update()` 逐条更新
- 忽略不存在的 id（记录跳过数）
- 需要 admin 认证（非 auth: false）

### 5.2 批量移动 `POST /product-categories/move`

**请求：**
```json
{
  "ids": ["docId1", "docId2"],
  "newParentId": "docId3"
}
```

> `newParentId` 为 `null` 表示移到根级

**响应：**
```json
{
  "data": { "moved": 2 },
  "meta": {}
}
```

**行为：**
- 移动前对每个 id 做循环引用检测（见 §6.1）
- **检测阶段原子性：** 任一 id 触发循环引用则整批拒绝，不执行任何移动，返回 409
- 检测全部通过后，用 document service 的 `update()` 逐条更新 parent 关系（Strapi v5 无批量事务，逐条更新可接受——数据量小且已通过预检）
- 需要 admin 认证

## 6. 验证逻辑（service 层）

### 6.1 循环引用检测

**规则：** 移动分类 A 到 newParent 下时，newParent 不能是 A 自身或 A 的任何后代。

**实现：** `hasDescendant(categoryDocumentId, possibleDescendantDocumentId)` 递归检查。

```typescript
/**
 * 检查 possibleDescendant 是否是 category 的后代（含间接）。
 * 用于 move 操作的循环引用检测。
 */
async function hasDescendant(
  categoryDocId: string,
  possibleDescendantDocId: string
): Promise<boolean>;
```

**违反时：** 返回 409 + `{ error: { status: 409, name: "CircularReference", message: "Cannot move category under its own descendant" } }`

### 6.2 删除拒绝

**规则：** 有 children 的分类拒绝删除。

**实现：** 在 delete 操作前查 children，非空则拒绝。

**违反时：** 返回 409 + `{ error: { status: 409, name: "HasChildren", message: "Cannot delete category with children. Remove children first." } }`

### 6.3 slug 重复校验

现有 schema 的 `unique: true` 已在 DB 层保证。service 层在 create/update 时捕获唯一约束错误，转换为 400 + 友好提示：

```json
{ "error": { "status": 400, "name": "DuplicateSlug", "message": "Slug already exists. Choose a different slug." } }
```

## 7. 清理项

- 删除 controller 里所有 `console.log` 调试语句（find/findOne/getCategoryTree/create/update/delete 共约 15 处）
- find/findOne 的 populate 改用 `strapi.documents()` 直接调用模式（与 Phase 1 的 campus-teacher-link controller 一致，绕过 sanitize 限制）
- getCategoryTree 改用 service 层 buildTree，controller 只做转发

## 8. 文件改动清单

| 文件 | 改动 |
|------|------|
| `backend/src/api/product-category/routes/product-category.ts` | 新增 reorder / move 路由 |
| `backend/src/api/product-category/controllers/product-category.ts` | 清理 console.log；find/findOne 改 strapi.documents()；新增 reorder/move/delete 转发；delete 加 children 检查 |
| `backend/src/api/product-category/services/product-category.ts` | 新增 buildTree / hasDescendant / reorder / move 逻辑 |
| `backend/src/api/product-category/services/__tests__/product-category.test.ts` | 新增：buildTree + hasDescendant 单测 |

## 9. 测试策略（TDD）

| 测试类型 | 内容 | 数量预估 |
|---------|------|---------|
| 单测 | `buildTree()` — 空树、单层、多层、孤儿节点、position 排序 | 5 |
| 单测 | `hasDescendant()` — 自身、直接子、深层后代、无关系 | 4 |
| 集成 | reorder — 幂等性、跳过不存在的 id | 2 |
| 集成 | move — 正常移动、移到根级、循环引用拒绝（409） | 3 |
| 集成 | delete — 有子分类拒绝（409）、无子分类成功 | 2 |
| 集成 | getCategoryTree — 返回完整嵌套树 | 1 |

## 10. 验收标准

1. 后端所有单测 + 集成测试通过
2. `GET /product-categories/tree` 返回完整嵌套树（递归到叶子节点）
3. `POST /product-categories/reorder` 批量调序后 position 正确更新
4. `POST /product-categories/move` 正常移动 + 循环引用返回 409
5. `DELETE /product-categories/:id` 有子分类时返回 409
6. controller 无 console.log
7. 客户服务器暂不部署（本地验证通过即可）
