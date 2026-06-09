import { useState } from "react";

const DEFAULT_PAGE_SIZE = 10;

/**
 * Pagination côté client d'un tableau déjà filtré.
 * `resetKey` (ex: recherche + filtre concaténés) ramène à la page 1 quand il
 * change — ajusté pendant le rendu, sans useEffect.
 */
export function usePagination<T>(
  items: T[],
  pageSize: number = DEFAULT_PAGE_SIZE,
  resetKey?: string,
) {
  const [page, setPage] = useState(1);
  const [prevKey, setPrevKey] = useState(resetKey);

  if (resetKey !== prevKey) {
    setPrevKey(resetKey);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return {
    page: safePage,
    setPage,
    totalPages,
    pageItems,
    total: items.length,
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, items.length),
  };
}
