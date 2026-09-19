import { isTripCompleted } from "@/features/trips/services/trips.service";

export type TripDetailMainTab = "trip" | "finance" | "expenses" | "tracking" | "docs";

type TripCompletionFields = {
  status?: string | null;
  completed_at?: string | null;
  id?: string | null;
  vehicle_id?: string | null;
};

/** Operations summary (fuel/toll/other/maintenance/ledger) only on Expense. */
export function shouldFetchOperationsSummary(
  tripId: string | null | undefined,
  activeTab: TripDetailMainTab,
): boolean {
  return Boolean(tripId) && activeTab === "expenses";
}

/** Completed/History trips stay on Trip — never auto-jump to Expense. */
export function shouldSkipExpenseTabAutoSelect(
  trip: TripCompletionFields | null | undefined,
): boolean {
  return isTripCompleted(trip);
}

/**
 * Auto Pulse Scan / ocr_jobs for an LR missing a number: docs tab only, and
 * never for completed trips (upload-time OCR remains).
 */
export function shouldAutoRunHistoricalLrOcr(
  activeTab: TripDetailMainTab,
  trip: TripCompletionFields | null | undefined,
): boolean {
  if (activeTab !== "docs") return false;
  if (isTripCompleted(trip)) return false;
  return true;
}

/** Ledger write-backfill is not an open-completed-trip operation. */
export function shouldBackfillPostedExpensesToLedger(input: {
  isDriverViewer: boolean;
  trip: TripCompletionFields;
}): boolean {
  if (input.isDriverViewer) return false;
  if (isTripCompleted(input.trip)) return false;
  if (!input.trip.id || !input.trip.vehicle_id) return false;
  return true;
}
