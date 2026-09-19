import {
  shouldAutoRunHistoricalLrOcr,
  shouldBackfillPostedExpensesToLedger,
  shouldFetchDeliveredTripFinance,
  shouldFetchHistoricalPartyRatings,
  shouldFetchManifestRefAssetInsights,
  shouldFetchTripSubcontractsOnDetail,
  shouldFlushTripOutboxOnDetail,
  shouldFetchHubDigitalPodFlags,
  shouldFetchOperationsSummary,
  shouldLoadTripDocumentsForViewer,
  shouldSkipExpenseTabAutoSelect,
} from "../completedTripInitialLoad.util";

const completed = { id: "t1", status: "delivered", completed_at: "2026-09-19T00:00:00Z", vehicle_id: "v1" };
const inProgress = { id: "t2", status: "in_progress", completed_at: null, vehicle_id: "v1" };

describe("completed trip initial load contract", () => {
  it("Trip-tab first paint does not start deferred surfaces", () => {
    expect(shouldFetchOperationsSummary("t1", "trip")).toBe(false);
    expect(shouldFetchDeliveredTripFinance("trip", completed)).toBe(false);
    expect(shouldLoadTripDocumentsForViewer("trip")).toBe(false);
    expect(shouldAutoRunHistoricalLrOcr("trip", completed)).toBe(false);
    expect(shouldFetchHistoricalPartyRatings(completed)).toBe(false);
    expect(shouldFetchManifestRefAssetInsights(completed)).toBe(false);
    expect(shouldFetchTripSubcontractsOnDetail(completed)).toBe(false);
    expect(shouldFlushTripOutboxOnDetail(completed)).toBe(false);
    expect(
      shouldBackfillPostedExpensesToLedger({ isDriverViewer: false, trip: completed }),
    ).toBe(false);
  });

  it("Finance tab loads delivered ledger/adjustments", () => {
    expect(shouldFetchDeliveredTripFinance("finance", completed)).toBe(true);
    expect(shouldFetchDeliveredTripFinance("finance", inProgress)).toBe(false);
  });

  it("Expense tab loads operations summary even for a completed trip", () => {
    expect(shouldFetchOperationsSummary("t1", "expenses")).toBe(true);
    expect(shouldFetchOperationsSummary(null, "expenses")).toBe(false);
  });

  it("Docs tab loads the document viewer; OCR stays off for completed trips", () => {
    expect(shouldLoadTripDocumentsForViewer("docs")).toBe(true);
    expect(shouldLoadTripDocumentsForViewer("finance")).toBe(false);
    expect(shouldAutoRunHistoricalLrOcr("docs", completed)).toBe(false);
    expect(shouldAutoRunHistoricalLrOcr("docs", inProgress)).toBe(true);
  });

  it("does not scan hub trip_documents while History is showing", () => {
    expect(shouldFetchHubDigitalPodFlags(true)).toBe(false);
    expect(shouldFetchHubDigitalPodFlags(false)).toBe(true);
  });

  it("live trip detail still runs ratings, manifest insights, subcontracts, and outbox flush", () => {
    expect(shouldFetchHistoricalPartyRatings(inProgress)).toBe(true);
    expect(shouldFetchManifestRefAssetInsights(inProgress)).toBe(true);
    expect(shouldFetchTripSubcontractsOnDetail(inProgress)).toBe(true);
    expect(shouldFlushTripOutboxOnDetail(inProgress)).toBe(true);
    expect(shouldFlushTripOutboxOnDetail(null)).toBe(false);
    expect(
      shouldBackfillPostedExpensesToLedger({ isDriverViewer: false, trip: inProgress }),
    ).toBe(true);
  });

  it("does not auto-switch completed trips to Expense", () => {
    expect(shouldSkipExpenseTabAutoSelect(completed)).toBe(true);
    expect(shouldSkipExpenseTabAutoSelect(inProgress)).toBe(false);
  });
});
