'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { searchProducts } from '@/lib/api';
import type { Product } from '@/lib/api';

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
  const skipDebounceRef = useRef(true);
  const limitRef = useRef(initialLimit);
  limitRef.current = initialLimit;

  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const doSearch = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

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

      if (currentRequestId !== requestIdRef.current || controller.signal.aborted) {
        return;
      }

      setResults(response.data);
      setTotal(response.meta.total);
      setPageCount(response.meta.pageCount);
    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }
      if (currentRequestId !== requestIdRef.current) {
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (currentRequestId === requestIdRef.current && !controller.signal.aborted) {
        setLoading(false);
      }
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

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

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
