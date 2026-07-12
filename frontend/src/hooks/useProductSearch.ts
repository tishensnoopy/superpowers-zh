import { useCallback, useEffect, useRef, useState } from 'react';
import { searchProducts } from '../lib/api';
import type { Product } from '../lib/api';

export function useProductSearch(initialLimit = 12) {
  const [query, setQueryState] = useState('');
  const [category, setCategoryState] = useState<string | null>(null);
  const [sort, setSortState] = useState<string | null>(null);
  const [page, setPageState] = useState(1);
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestingRef = useRef(false);
  const skipDebounceRef = useRef(true);
  const limitRef = useRef(initialLimit);
  limitRef.current = initialLimit;

  const doSearch = useCallback(async () => {
    if (requestingRef.current) return;
    requestingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await searchProducts({
        query: query || undefined,
        categorySlugs: category ? [category] : undefined,
        sort: sort ? [sort] : undefined,
        page,
        limit: limitRef.current,
      });
      setResults(response.data);
      setTotal(response.meta.total);
      setPageCount(response.meta.pageCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      requestingRef.current = false;
    }
  }, [query, category, sort, page]);

  useEffect(() => {
    const skipDebounce = skipDebounceRef.current;
    skipDebounceRef.current = false;

    if (skipDebounce) {
      void doSearch();
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      void doSearch();
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [doSearch]);

  const setQuery = useCallback((q: string) => {
    setQueryState(q);
  }, []);

  const setCategory = useCallback((c: string | null) => {
    skipDebounceRef.current = true;
    setCategoryState(c);
    setPageState(1);
  }, []);

  const setSort = useCallback((s: string | null) => {
    skipDebounceRef.current = true;
    setSortState(s);
    setPageState(1);
  }, []);

  const setPage = useCallback((p: number) => {
    skipDebounceRef.current = true;
    setPageState(p);
  }, []);

  const reset = useCallback(() => {
    skipDebounceRef.current = true;
    setQueryState('');
    setCategoryState(null);
    setSortState(null);
    setPageState(1);
  }, []);

  return {
    query,
    category,
    sort,
    page,
    results,
    loading,
    error,
    total,
    pageCount,
    setQuery,
    setCategory,
    setSort,
    setPage,
    reset,
  };
}
