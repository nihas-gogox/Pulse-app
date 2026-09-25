/**
 * Shared pagination types and defaults for list APIs.
 * Aligns with docs/PAGINATION_AND_CACHE_ANALYSIS.md.
 */
export const DEFAULT_PAGE_SIZE = 50;
export const LEDGER_PAGE_SIZE = 50;
export const DRIVER_TRIPS_PAGE_SIZE = 30;
/** Cap for finite-list sync/cache fetches (React Query `finite` keys). */
export const FINITE_LIST_CAP = 500;

export interface PageOpts {
  limit?: number;
  offset?: number;
}

export interface PagedResult<T> {
  data: T[];
  hasMore: boolean;
  total?: number;
}

export function toRange(offset: number, limit: number): { from: number; to: number } {
  return { from: offset, to: offset + limit - 1 };
}
