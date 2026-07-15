import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useProductSearch } from '@/hooks/useProductSearch';
import { searchProducts } from '@/lib/api';
import type { Product } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  searchProducts: vi.fn(),
}));

const mockProducts: Product[] = [
  { id: 1, documentId: 'doc1', name: 'Product 1', slug: 'p1' },
  { id: 2, documentId: 'doc2', name: 'Product 2', slug: 'p2' },
];

const defaultResponse = {
  data: [] as Product[],
  meta: { total: 0, page: 1, pageSize: 12, pageCount: 0 },
};

describe('useProductSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(searchProducts).mockReset();
    vi.mocked(searchProducts).mockResolvedValue(defaultResponse);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初始加载触发一次搜索（空参数）', async () => {
    renderHook(() => useProductSearch());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(searchProducts).toHaveBeenCalledTimes(1);
    expect(searchProducts).toHaveBeenCalledWith({
      query: undefined,
      categorySlugs: undefined,
      sort: undefined,
      page: 1,
      limit: 12,
    });
  });

  it('setQuery 后 300ms 内不触发搜索（防抖）', async () => {
    const { result } = renderHook(() => useProductSearch());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    vi.mocked(searchProducts).mockClear();

    act(() => {
      result.current.setQuery('phone');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });

    expect(searchProducts).not.toHaveBeenCalled();
  });

  it('setQuery 后 300ms 后触发搜索', async () => {
    const { result } = renderHook(() => useProductSearch());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    vi.mocked(searchProducts).mockClear();

    act(() => {
      result.current.setQuery('phone');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(searchProducts).toHaveBeenCalledTimes(1);
    expect(searchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'phone' })
    );
  });

  it('setCategory 立即触发搜索且 page 重置为 1', async () => {
    const { result } = renderHook(() => useProductSearch());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    act(() => {
      result.current.setPage(3);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    vi.mocked(searchProducts).mockClear();

    act(() => {
      result.current.setCategory('phones');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(searchProducts).toHaveBeenCalledTimes(1);
    expect(searchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ categorySlugs: ['phones'], page: 1 })
    );
    expect(result.current.page).toBe(1);
    expect(result.current.category).toBe('phones');
  });

  it('setSort 立即触发搜索且 page 重置为 1', async () => {
    const { result } = renderHook(() => useProductSearch());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    act(() => {
      result.current.setPage(4);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    vi.mocked(searchProducts).mockClear();

    act(() => {
      result.current.setSort('price:asc');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(searchProducts).toHaveBeenCalledTimes(1);
    expect(searchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ sort: ['price:asc'], page: 1 })
    );
    expect(result.current.page).toBe(1);
    expect(result.current.sort).toBe('price:asc');
  });

  it('setPage 立即触发搜索', async () => {
    const { result } = renderHook(() => useProductSearch());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    vi.mocked(searchProducts).mockClear();

    act(() => {
      result.current.setPage(5);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(searchProducts).toHaveBeenCalledTimes(1);
    expect(searchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ page: 5 })
    );
    expect(result.current.page).toBe(5);
  });

  it('搜索失败时设置 error', async () => {
    vi.mocked(searchProducts).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useProductSearch());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.loading).toBe(false);
  });

  it('搜索成功时设置 results 和 meta', async () => {
    vi.mocked(searchProducts).mockResolvedValue({
      data: mockProducts,
      meta: { total: 2, page: 1, pageSize: 12, pageCount: 1 },
    });

    const { result } = renderHook(() => useProductSearch());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.results).toEqual(mockProducts);
    expect(result.current.total).toBe(2);
    expect(result.current.pageCount).toBe(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('reset 清空所有状态', async () => {
    const { result } = renderHook(() => useProductSearch());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    act(() => {
      result.current.setQuery('phone');
      result.current.setCategory('phones');
      result.current.setSort('price:asc');
      result.current.setPage(3);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    vi.mocked(searchProducts).mockClear();

    act(() => {
      result.current.reset();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.query).toBe('');
    expect(result.current.category).toBeNull();
    expect(result.current.sort).toBeNull();
    expect(result.current.page).toBe(1);
    expect(searchProducts).toHaveBeenCalledTimes(1);
  });
});

describe('useProductSearch race condition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(searchProducts).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('快速连续查询时，两次请求都发出且只应用最新请求的结果', async () => {
    let resolveFirst!: (value: any) => void;
    let resolveSecond!: (value: any) => void;

    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const secondPromise = new Promise((resolve) => {
      resolveSecond = resolve;
    });

    // 初始加载立即完成；后续两次查询分别返回 first/second promise（保持 pending）
    vi.mocked(searchProducts)
      .mockResolvedValueOnce(defaultResponse)
      .mockReturnValueOnce(firstPromise as any)
      .mockReturnValueOnce(secondPromise as any);

    const { result } = renderHook(() => useProductSearch());

    // 初始加载完成
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    vi.mocked(searchProducts).mockClear();

    // 第一次查询
    act(() => {
      result.current.setQuery('a');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    // 第二次查询（在第一次完成前）
    act(() => {
      result.current.setQuery('ab');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    // 两次查询都应触发请求（不被 requestingRef 阻塞）
    expect(searchProducts).toHaveBeenCalledTimes(2);

    // 先完成第一次请求（旧结果）
    await act(async () => {
      resolveFirst({
        data: [{ id: 1, documentId: 'd1', name: '旧结果', slug: 'old' }],
        meta: { total: 1, page: 1, pageSize: 12, pageCount: 1 },
      });
      await Promise.resolve();
    });

    // 旧结果不应被应用
    expect(result.current.results).toEqual([]);

    // 完成第二次请求（新结果）
    await act(async () => {
      resolveSecond({
        data: [{ id: 2, documentId: 'd2', name: '新结果', slug: 'new' }],
        meta: { total: 1, page: 1, pageSize: 12, pageCount: 1 },
      });
      await Promise.resolve();
    });

    // 最终结果应该是第二次的（新结果）
    expect(result.current.results).toEqual([
      { id: 2, documentId: 'd2', name: '新结果', slug: 'new' },
    ]);
  });

  it('组件卸载时取消进行中的请求，旧结果不应用', async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort');

    let resolvePending!: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePending = resolve;
    });

    vi.mocked(searchProducts)
      .mockResolvedValueOnce(defaultResponse)
      .mockReturnValueOnce(pendingPromise as any);

    const { result, unmount } = renderHook(() => useProductSearch());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    vi.mocked(searchProducts).mockClear();

    // 触发一次查询（pending）
    act(() => {
      result.current.setQuery('phone');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(searchProducts).toHaveBeenCalledTimes(1);

    // 重置 spy 调用记录，精确断言卸载触发的 abort
    abortSpy.mockClear();

    // 卸载组件（应 abort 进行中的请求）
    act(() => {
      unmount();
    });

    // 验证卸载时 AbortController.abort 被调用
    expect(abortSpy).toHaveBeenCalled();

    // 卸载后完成请求，不应抛错也不应影响已卸载组件
    await act(async () => {
      resolvePending({
        data: [{ id: 9, documentId: 'd9', name: '卸载后结果', slug: 'after' }],
        meta: { total: 1, page: 1, pageSize: 12, pageCount: 1 },
      });
      await Promise.resolve();
    });

    abortSpy.mockRestore();
  });
});
