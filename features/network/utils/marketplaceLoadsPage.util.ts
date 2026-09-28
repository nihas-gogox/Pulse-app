/** First marketplace page on Load — keep the RPC small so network indents stay first. */
export const MARKETPLACE_LOAD_PAGE_SIZE = 15;

/** How close to the bottom (px) before the next page paints. */
export const LOAD_SCROLL_PAGE_THRESHOLD_PX = 140;

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

/** Visible prefix for a lazy-loaded list. The page size never replaces the total. */
export function takeVisibleLoadPage<T>(
  rows: readonly T[],
  visibleCount: number,
  pageSize: number = MARKETPLACE_LOAD_PAGE_SIZE,
): T[] {
  const size = Math.max(pageSize, visibleCount);
  return rows.slice(0, size);
}

export function growVisibleLoadCount(
  visibleCount: number,
  total: number,
  pageSize: number = MARKETPLACE_LOAD_PAGE_SIZE,
): number {
  return Math.min(total, visibleCount + pageSize);
}

export function isScrollNearListEnd(
  layoutHeight: number,
  offsetY: number,
  contentHeight: number,
  thresholdPx: number = LOAD_SCROLL_PAGE_THRESHOLD_PX,
): boolean {
  if (contentHeight <= 0 || layoutHeight <= 0) return false;
  return layoutHeight + offsetY >= contentHeight - thresholdPx;
}
