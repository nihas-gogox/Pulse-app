import {
  bidderIndentNeedsBroadcastFallback,
  mergeBidderIndentTarget,
} from "@/features/indents/utils/indentTargetForBidder.util";

describe("bidderIndentNeedsBroadcastFallback", () => {
  it("fetches when target exists but basis is missing (market RPC shape)", () => {
    expect(
      bidderIndentNeedsBroadcastFallback({
        supplier_target: 5320,
        supplier_rate_basis: null,
      }),
    ).toBe(true);
    expect(
      bidderIndentNeedsBroadcastFallback({
        supplier_target: 5320,
      }),
    ).toBe(true);
  });

  it("does not fetch when target and basis are both present", () => {
    expect(
      bidderIndentNeedsBroadcastFallback({
        supplier_target: 5320,
        supplier_rate_basis: "per_mt",
      }),
    ).toBe(false);
  });
});

describe("mergeBidderIndentTarget", () => {
  it("fills per_mt onto a market row that only had the rupee figure", () => {
    expect(
      mergeBidderIndentTarget(
        { supplier_target: 5320, supplier_rate_basis: null, weight: 0 },
        { supplier_target: 5320, supplier_rate_basis: "per_mt", weight: 0 },
      ),
    ).toEqual({
      supplier_target: 5320,
      supplier_rate_basis: "per_mt",
      weight: 0,
    });
  });
});
