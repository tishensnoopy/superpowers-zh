import { factories } from '@strapi/strapi';
import { buildTree, detectCycle, type CategoryRow } from './build-tree';

export default factories.createCoreService('api::product-category.product-category', ({ strapi }) => ({
  /**
   * 返回完整嵌套的分类树（递归无限层级）。
   * 策略：一次查出所有 isActive 分类，内存组装树。
   */
  async getCategoryTree() {
    const rows = await strapi.db.query('api::product-category.product-category').findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' },
      populate: {
        parent: { select: ['documentId'] },
        image: true,
      },
    }) as CategoryRow[];

    return buildTree(rows);
  },

  /**
   * 检查 possibleDescendantDocId 是否是 categoryDocId 的后代（含间接，不含自身）。
   * 用于 move 操作的循环引用检测。
   */
  async hasDescendant(categoryDocId: string, possibleDescendantDocId: string): Promise<boolean> {
    const findChildren = async (docId: string): Promise<{ documentId: string }[]> => {
      return strapi.db.query('api::product-category.product-category').findMany({
        where: { parent: { documentId: docId } },
        select: ['documentId'],
      }) as Promise<{ documentId: string }[]>;
    };

    return detectCycle(categoryDocId, possibleDescendantDocId, findChildren);
  },

  /**
   * 批量调序。幂等——直接覆盖 position。
   * @returns 更新的记录数 + 跳过数（不存在的 id）
   */
  async reorder(items: { id: string; position: number }[]): Promise<{ updated: number; skipped: number }> {
    let updated = 0;
    let skipped = 0;

    for (const item of items) {
      try {
        await strapi.documents('api::product-category.product-category').update({
          documentId: item.id,
          data: { position: item.position } as any,
        });
        updated++;
      } catch {
        skipped++;
      }
    }

    return { updated, skipped };
  },

  /**
   * 批量移动到新父级。
   * 循环引用检测：newParentId 不能是任何一个待移动分类的后代（整批原子性——任一失败全部不执行）。
   * newParentId 为 null 表示移到根级。
   */
  async move(ids: string[], newParentId: string | null): Promise<{ moved: number; error?: string }> {
    if (newParentId !== null) {
      for (const id of ids) {
        const isCycle = await this.hasDescendant(id, newParentId);
        if (isCycle) {
          return { moved: 0, error: `Cannot move category ${id} under its own descendant` };
        }
      }
    }

    let moved = 0;
    for (const id of ids) {
      await strapi.documents('api::product-category.product-category').update({
        documentId: id,
        data: { parent: newParentId } as any,
      });
      moved++;
    }

    return { moved };
  },

  async initializeDefaults() {
    const existing = await strapi.db.query('api::product-category.product-category').findMany();

    if (existing.length === 0) {
      const defaults = [
        { name: 'Category A', slug: 'category-a', position: 0, isActive: true },
        { name: 'Category B', slug: 'category-b', position: 1, isActive: true },
        { name: 'Category C', slug: 'category-c', position: 2, isActive: true },
      ];

      const created = await Promise.all(
        defaults.map((item) => this.create({ data: item }))
      );
      return created;
    }

    return existing;
  },
}));
