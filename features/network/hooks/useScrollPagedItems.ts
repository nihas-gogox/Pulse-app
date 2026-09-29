import {
  growVisibleLoadCount,
  isScrollNearListEnd,
  MARKETPLACE_LOAD_PAGE_SIZE,
  takeVisibleLoadPage,
} from "@/features/network/utils/marketplaceLoadsPage.util";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

/**
 * Ecommerce-style window: paint a page, grow on scroll-near-end.
 * `total` is always the full catalog length — never the painted prefix.
 */
export function useScrollPagedItems<T>(
  items: readonly T[],
  pageSize: number = MARKETPLACE_LOAD_PAGE_SIZE,
  catalogKey?: string,
) {
  const size = Math.max(1, pageSize);
  const resetKey = `${catalogKey ?? ""}:${items.length}:${size}`;
  const [visibleCount, setVisibleCount] = useState(size);

  useEffect(() => {
    setVisibleCount(size);
  }, [resetKey, size]);

  const visibleItems = useMemo(
    () => takeVisibleLoadPage(items, visibleCount, size),
    [items, visibleCount, size],
  );
  const total = items.length;
  const hasMore = total > visibleItems.length;

  const loadMore = useCallback(() => {
    setVisibleCount((n) => growVisibleLoadCount(n, items.length, size));
  }, [items.length, size]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!hasMore) return;
      const { layoutMeasurement, contentOffset, contentSize } =
        event.nativeEvent;
      if (
        isScrollNearListEnd(
          layoutMeasurement.height,
          contentOffset.y,
          contentSize.height,
        )
      ) {
        loadMore();
      }
    },
    [hasMore, loadMore],
  );

  return {
    visibleItems,
    total,
    hasMore,
    remaining: Math.max(0, total - visibleItems.length),
    onScroll,
    loadMore,
  };
}
