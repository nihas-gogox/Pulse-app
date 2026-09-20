import {
  tripExpenseEntryExitHref,
  tripExpenseEntryFallbackHref,
} from "../tripExpenseEntryExit.util";

describe("tripExpenseEntryExitHref", () => {
  it("returns trip detail with the expenses tab", () => {
    expect(tripExpenseEntryExitHref("trip-1")).toBe("/trip/trip-1?tab=expenses");
  });
});

describe("tripExpenseEntryFallbackHref", () => {
  it("falls back to trips list when trip id is missing", () => {
    expect(tripExpenseEntryFallbackHref("")).toBe("/(tabs)/trips");
  });
});
