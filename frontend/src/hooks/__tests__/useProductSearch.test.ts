import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useProductSearch } from '../useProductSearch';
import { searchProducts } from '../../lib/api';
import type { Product } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  searchProducts: vi.fn(),
}));

const mockProducts: Product[] = [
  { id: 1, attributes: { name: 'Product 1', slug: 'p1' } },
  { id: 2, attributes: { name: 'Product 2', slug: 'p2' } },
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
