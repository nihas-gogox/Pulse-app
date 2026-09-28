/** Page sizes for a party detail trip table. Metrics stay on the full selection. */
export const PARTY_TRIP_PAGE_SIZES = [25, 50, 100] as const;

export type PartyTripPageSize = (typeof PARTY_TRIP_PAGE_SIZES)[number];

export function partyTripPageSlice<T>(
  rows: readonly T[],
  page: number,
  pageSize: number,
): { page: number; totalPages: number; rows: T[] } {
  const size = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * size;
  return {
    page: safePage,
    totalPages,
    rows: rows.slice(start, start + size),
  };
}
