export interface CategoryRow {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description?: string;
  image?: any;
  position: number;
  isActive: boolean;
  parent?: { documentId: string } | null;
}

export interface CategoryNode extends Omit<CategoryRow, 'parent'> {
  children: CategoryNode[];
}

/**
 * 将扁平分类列表组装成嵌套树。
 * - 根节点：parent 为 null 或指向不存在分类（孤儿）的节点
 * - 每层按 position 升序排列
 */
export function buildTree(flatList: CategoryRow[]): CategoryNode[] {
  const byParent = new Map<string | null, CategoryRow[]>();
  const validDocIds = new Set(flatList.map((r) => r.documentId));

  for (const row of flatList) {
    const parentDocId = row.parent?.documentId ?? null;
    // 孤儿节点（parent 指向不存在的分类）作为根节点
    const key = parentDocId && validDocIds.has(parentDocId) ? parentDocId : null;
    const bucket = byParent.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      byParent.set(key, [row]);
    }
  }

  function build(parentId: string | null): CategoryNode[] {
    const rows = (byParent.get(parentId) ?? [])
      .slice()
      .sort((a, b) => a.position - b.position);
    return rows.map((row) => ({
      id: row.id,
      documentId: row.documentId,
      name: row.name,
      slug: row.slug,
      description: row.description,
      image: row.image,
      position: row.position,
      isActive: row.isActive,
      children: build(row.documentId),
    }));
  }

  return build(null);
}

/**
 * 检查 possibleDescendantDocId 是否是 categoryDocId 的后代（含间接，不含自身）。
 * BFS 遍历子树。findChildren 为依赖注入的查询函数（便于测试）。
 */
export async function detectCycle(
  categoryDocId: string,
  possibleDescendantDocId: string,
  findChildren: (docId: string) => Promise<{ documentId: string }[]>
): Promise<boolean> {
  const queue: string[] = [];
  const visited = new Set<string>();

  // 从直接子节点开始（自身不算后代）
  const directChildren = await findChildren(categoryDocId);
  for (const child of directChildren) {
    queue.push(child.documentId);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    if (current === possibleDescendantDocId) {
      return true;
    }

    const children = await findChildren(current);
    for (const child of children) {
      queue.push(child.documentId);
    }
  }

  return false;
}
