import {
  PARTY_TRIP_PAGE_SIZES,
  partyTripPageSlice,
} from "@/features/finance/utils/partyTripPage.util";

describe("partyTripPageSlice", () => {
  const rows = Array.from({ length: 60 }, (_, i) => i);

  it("loads the first 25 by default page size", () => {
    const view = partyTripPageSlice(rows, 0, PARTY_TRIP_PAGE_SIZES[0]);
    expect(view.rows).toHaveLength(25);
    expect(view.rows[0]).toBe(0);
    expect(view.totalPages).toBe(3);
  });

  it("loads 50 on the next page size and keeps the last short page", () => {
    const first = partyTripPageSlice(rows, 0, 50);
    expect(first.rows).toHaveLength(50);
    const next = partyTripPageSlice(rows, 1, 50);
    expect(next.rows).toEqual([50, 51, 52, 53, 54, 55, 56, 57, 58, 59]);
    expect(next.totalPages).toBe(2);
  });

  it("clamps a page past the end", () => {
    const view = partyTripPageSlice(rows, 9, 100);
    expect(view.page).toBe(0);
    expect(view.rows).toHaveLength(60);
  });
});
