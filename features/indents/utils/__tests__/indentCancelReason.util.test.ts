import {
  indentAwardBlockedBecauseInactive,
  indentFailedCategory,
} from "@/features/indents/utils/indentCancelReason.util";

describe("indentAwardBlockedBecauseInactive", () => {
  it("blocks award on a cancelled, closed, or expired indent", () => {
    expect(indentAwardBlockedBecauseInactive("cancelled")).toMatch(/reactivate/i);
    expect(indentAwardBlockedBecauseInactive("closed")).toMatch(/reactivate/i);
    expect(indentAwardBlockedBecauseInactive("EXPIRED")).toMatch(/reactivate/i);
  });

  it("buckets a failed indent by its cancel reason", () => {
    expect(
      indentFailedCategory({ status: "cancelled", cancel_reason: "client_cancelled" }),
    ).toBe("client_cancelled");
    expect(
      indentFailedCategory({ status: "cancelled", cancel_reason: "cost_does_not_match" }),
    ).toBe("cost_does_not_match");
    expect(indentFailedCategory({ status: "expired", cancel_reason: null })).toBe(
      "indent_expired",
    );
  });

  it("leaves the live award path open", () => {
    expect(indentAwardBlockedBecauseInactive("broadcast")).toBeNull();
    expect(indentAwardBlockedBecauseInactive("open")).toBeNull();
    expect(indentAwardBlockedBecauseInactive("pending")).toBeNull();
    expect(indentAwardBlockedBecauseInactive("quoted")).toBeNull();
  });
});
