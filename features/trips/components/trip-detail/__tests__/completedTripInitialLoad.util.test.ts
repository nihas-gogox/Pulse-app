import {
  shouldAutoRunHistoricalLrOcr,
  shouldBackfillPostedExpensesToLedger,
  shouldFetchOperationsSummary,
  shouldSkipExpenseTabAutoSelect,
} from "../completedTripInitialLoad.util";

const completed = { id: "t1", status: "delivered", completed_at: "2026-09-19T00:00:00Z", vehicle_id: "v1" };
const inProgress = { id: "t2", status: "in_progress", completed_at: null, vehicle_id: "v1" };

describe("completed trip initial load contract", () => {
  it("makes no operations-summary request on the Trip tab", () => {
    expect(shouldFetchOperationsSummary("t1", "trip")).toBe(false);
    expect(shouldFetchOperationsSummary("t1", "docs")).toBe(false);
    expect(shouldFetchOperationsSummary("t1", "finance")).toBe(false);
  });

  it("starts Expense queries only after selecting Expense", () => {
    expect(shouldFetchOperationsSummary("t1", "expenses")).toBe(true);
    expect(shouldFetchOperationsSummary(null, "expenses")).toBe(false);
  });

  it("does not auto-switch completed trips to Expense", () => {
    expect(shouldSkipExpenseTabAutoSelect(completed)).toBe(true);
    expect(shouldSkipExpenseTabAutoSelect(inProgress)).toBe(false);
  });

  it("makes no automatic OCR/ocr_jobs request on the completed Trip tab", () => {
    expect(shouldAutoRunHistoricalLrOcr("trip", completed)).toBe(false);
    expect(shouldAutoRunHistoricalLrOcr("docs", completed)).toBe(false);
    expect(shouldAutoRunHistoricalLrOcr("docs", inProgress)).toBe(true);
  });

  it("does not ledger write-backfill on initial Trip-tab open of a completed trip", () => {
    expect(
      shouldBackfillPostedExpensesToLedger({ isDriverViewer: false, trip: completed }),
    ).toBe(false);
    expect(
      shouldBackfillPostedExpensesToLedger({ isDriverViewer: false, trip: inProgress }),
    ).toBe(true);
  });
});
