/**
 * usePagination.js
 * Manages page state and provides helper functions.
 * Compatible with backend's paginationMeta format:
 *   { total, page, limit, total_pages, has_next, has_prev }
 */
import { useState, useCallback } from 'react';

const usePagination = (initialPage = 1, initialLimit = 10) => {
  const [page,  setPage]  = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [meta,  setMeta]  = useState(null); // full pagination meta from API

  const goToPage = useCallback((p) => {
    if (meta && (p < 1 || p > meta.total_pages)) return;
    setPage(p);
  }, [meta]);

  const nextPage = useCallback(() => {
    if (meta?.has_next) setPage((p) => p + 1);
  }, [meta]);

  const prevPage = useCallback(() => {
    if (meta?.has_prev) setPage((p) => p - 1);
  }, [meta]);

  const resetPage = useCallback(() => setPage(1), []);

  const updateMeta = useCallback((paginationObj) => {
    if (!paginationObj) return;
    setMeta({
      ...paginationObj,
      has_next: paginationObj.page < paginationObj.total_pages,
      has_prev: paginationObj.page > 1,
    });
  }, []);

  return {
    page, limit, meta,
    setPage, setLimit, goToPage, nextPage, prevPage, resetPage, updateMeta
  };
};

export default usePagination;
