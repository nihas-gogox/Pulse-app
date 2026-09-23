/** First marketplace page on Load — keep the RPC small so network indents stay first. */
export const MARKETPLACE_LOAD_PAGE_SIZE = 15;

export function sliceMarketplaceLoadsPage<T>(
  rows: T[],
  offset: number,
  pageSize: number = MARKETPLACE_LOAD_PAGE_SIZE,
): { page: T[]; hasMore: boolean } {
  const start = Math.max(0, offset);
  const size = Math.max(1, pageSize);
  const page = rows.slice(start, start + size);
  return { page, hasMore: rows.length >= start + size };
}

export function nextMarketplacePageOffset(
  offset: number,
  pageLength: number,
  pageSize: number = MARKETPLACE_LOAD_PAGE_SIZE,
): number | undefined {
  if (pageLength < pageSize) return undefined;
  return offset + pageSize;
}

export function loadRouteKey(
  pickup?: string | null,
  drop?: string | null,
): string {
  return `${(pickup ?? "").trim().toLowerCase()}→${(drop ?? "").trim().toLowerCase()}`;
}

export function indentLoadRouteKey(load: {
  pickup_area?: string | null;
  drop_location?: string | null;
}): string {
  return loadRouteKey(load.pickup_area, load.drop_location);
}

/** First unique pickup→drop per sample slot so the page is not one repeated lane. */
export function takeDiverseRouteSample<T>(
  rows: readonly T[],
  getRouteKey: (row: T) => string,
  limit: number = MARKETPLACE_LOAD_PAGE_SIZE,
): T[] {
  const size = Math.max(1, limit);
  const out: T[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = getRouteKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= size) break;
  }
  return out;
}

export function countUniqueLoadRoutes<T>(
  rows: readonly T[],
  getRouteKey: (row: T) => string,
): number {
  const seen = new Set<string>();
  for (const row of rows) seen.add(getRouteKey(row));
  return seen.size;
}

/** Visible prefix for Get Load network cards — unique routes first. */
export function takeVisibleLoadPage<T>(
  rows: T[],
  visibleCount: number,
  pageSize: number = MARKETPLACE_LOAD_PAGE_SIZE,
  getRouteKey?: (row: T) => string,
): T[] {
  const size = Math.max(pageSize, visibleCount);
  if (getRouteKey) {
    return takeDiverseRouteSample(rows, getRouteKey, size);
  }
  return rows.slice(0, size);
}

export function growVisibleLoadCount(
  visibleCount: number,
  total: number,
  pageSize: number = MARKETPLACE_LOAD_PAGE_SIZE,
): number {
  return Math.min(total, visibleCount + pageSize);
}
