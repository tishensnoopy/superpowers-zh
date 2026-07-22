import { describe, it, expect } from 'vitest';
import { buildTree, type CategoryRow } from '../build-tree';

describe('buildTree 纯函数', () => {
  it('空列表返回空数组', () => {
    expect(buildTree([])).toEqual([]);
  });

  it('单层：根分类按 position 排序', () => {
    const rows: CategoryRow[] = [
      { id: 1, documentId: 'a', name: 'A', slug: 'a', position: 1, isActive: true, parent: null },
      { id: 2, documentId: 'b', name: 'B', slug: 'b', position: 0, isActive: true, parent: null },
    ];
    const tree = buildTree(rows);
    expect(tree).toHaveLength(2);
    expect(tree[0].documentId).toBe('b');
    expect(tree[1].documentId).toBe('a');
  });

  it('多层：子分类嵌套到父分类下', () => {
    const rows: CategoryRow[] = [
      { id: 1, documentId: 'root', name: 'Root', slug: 'root', position: 0, isActive: true, parent: null },
      { id: 2, documentId: 'child1', name: 'Child1', slug: 'child1', position: 1, isActive: true, parent: { documentId: 'root' } },
      { id: 3, documentId: 'child2', name: 'Child2', slug: 'child2', position: 0, isActive: true, parent: { documentId: 'root' } },
      { id: 4, documentId: 'grandchild', name: 'Grandchild', slug: 'gc', position: 0, isActive: true, parent: { documentId: 'child2' } },
    ];
    const tree = buildTree(rows);
    expect(tree).toHaveLength(1);
    expect(tree[0].documentId).toBe('root');
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].documentId).toBe('child2');
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].documentId).toBe('grandchild');
  });

  it('孤儿节点（parent 指向不存在的分类）作为根节点处理', () => {
    const rows: CategoryRow[] = [
      { id: 1, documentId: 'orphan', name: 'Orphan', slug: 'orphan', position: 0, isActive: true, parent: { documentId: 'deleted' } },
    ];
    const tree = buildTree(rows);
    expect(tree).toHaveLength(1);
    expect(tree[0].documentId).toBe('orphan');
    expect(tree[0].children).toEqual([]);
  });

  it('保留 description 和 image 字段', () => {
    const rows: CategoryRow[] = [
      {
        id: 1, documentId: 'a', name: 'A', slug: 'a', position: 0, isActive: true, parent: null,
        description: 'desc', image: { url: '/img.jpg' },
      },
    ];
    const tree = buildTree(rows);
    expect(tree[0].description).toBe('desc');
    expect(tree[0].image).toEqual({ url: '/img.jpg' });
  });
});
