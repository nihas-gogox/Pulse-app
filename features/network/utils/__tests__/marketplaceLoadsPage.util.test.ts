import {
  countUniqueLoadRoutes,
  growVisibleLoadCount,
  indentLoadRouteKey,
  MARKETPLACE_LOAD_PAGE_SIZE,
  nextMarketplacePageOffset,
  sliceMarketplaceLoadsPage,
  takeVisibleLoadPage,
} from "@/features/network/utils/marketplaceLoadsPage.util";

describe("marketplaceLoadsPage", () => {
  it("pages 15 rows and stops when the prefix is short", () => {
    expect(MARKETPLACE_LOAD_PAGE_SIZE).toBe(15);
    const rows = Array.from({ length: 15 }, (_, i) => i);
    expect(sliceMarketplaceLoadsPage(rows, 0)).toEqual({
      page: rows,
      hasMore: true,
    });
    expect(sliceMarketplaceLoadsPage(rows.slice(0, 7), 0)).toEqual({
      page: rows.slice(0, 7),
      hasMore: false,
    });
    expect(nextMarketplacePageOffset(0, 15)).toBe(15);
    expect(nextMarketplacePageOffset(15, 4)).toBeUndefined();
  });

  it("grows the on-screen network prefix 15 at a time", () => {
    const rows = Array.from({ length: 40 }, (_, i) => i);
    expect(takeVisibleLoadPage(rows, 15)).toHaveLength(15);
    expect(growVisibleLoadCount(15, 40)).toBe(30);
    expect(growVisibleLoadCount(30, 40)).toBe(40);
  });

  it("samples unique routes so one lane cannot fill the page", () => {
    const rows = [
      { pickup_area: "Bhandara", drop_location: "Bengaluru" },
      { pickup_area: "Bhandara", drop_location: "Bengaluru" },
      { pickup_area: "Bhandara", drop_location: "Bhiwadi" },
      { pickup_area: "Chennai", drop_location: "Hyderabad" },
    ];
    const sample = takeVisibleLoadPage(rows, 15, 15, indentLoadRouteKey);
    expect(sample).toHaveLength(3);
    expect(sample.map((r) => `${r.pickup_area}→${r.drop_location}`)).toEqual([
      "Bhandara→Bengaluru",
      "Bhandara→Bhiwadi",
      "Chennai→Hyderabad",
    ]);
    expect(countUniqueLoadRoutes(rows, indentLoadRouteKey)).toBe(3);
  });
});
