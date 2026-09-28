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

/** Finance ledger/adjustments only after the user opens Finance. */
export function shouldFetchDeliveredTripFinance(
  activeTab: TripDetailMainTab,
  trip: TripCompletionFields | null | undefined,
): boolean {
  return activeTab === "finance" && isTripCompleted(trip);
}

/** Driver/supplier/client historical rating lists — skip on completed first paint. */
export function shouldFetchHistoricalPartyRatings(
  trip: TripCompletionFields | null | undefined,
): boolean {
  return !isTripCompleted(trip);
}

/** Manifest sidebar driver/vehicle ratings + compliance docs. */
export function shouldFetchManifestRefAssetInsights(
  trip: TripCompletionFields | null | undefined,
): boolean {
  return !isTripCompleted(trip);
}

/** Operations/verification outbox flush is for live trips. */
export function shouldFlushTripOutboxOnDetail(
  trip: TripCompletionFields | null | undefined,
): boolean {
  if (!trip) return false;
  return !isTripCompleted(trip);
}

/** Storage/OCR viewer path: Docs tab only (not first paint). */
export function shouldLoadTripDocumentsForViewer(
  activeTab: TripDetailMainTab,
): boolean {
  return activeTab === "docs";
}

/** Hub digital-POD trip_documents scan — live ops list only, not History. */
export function shouldFetchHubDigitalPodFlags(
  showCompletedList: boolean,
  opts?: { compactViewport?: boolean },
): boolean {
  if (showCompletedList) return false;
  if (opts?.compactViewport) return false;
  return true;
}

/** Subcontract partner + rate for Finance / trip detail (including completed). */
export function shouldFetchTripSubcontractsOnDetail(
  trip: TripCompletionFields | null | undefined,
): boolean {
  return Boolean(trip?.id);
}

export function shouldBackfillPostedExpensesToLedger(input: {
  isDriverViewer: boolean;
  trip: TripCompletionFields;
}): boolean {
  if (input.isDriverViewer) return false;
  if (isTripCompleted(input.trip)) return false;
  if (!input.trip.id || !input.trip.vehicle_id) return false;
  return true;
}

/** Phone / narrow web — skip Leaflet + full bundle RPC on first paint. */
export const NARROW_WEB_TRIP_DETAIL_MAX_WIDTH = 1024;

export function isNarrowWebViewport(
  innerWidth: number | undefined,
  platformOS: string,
): boolean {
  if (platformOS !== "web") return false;
  if (innerWidth == null || !Number.isFinite(innerWidth)) return false;
  return innerWidth < NARROW_WEB_TRIP_DETAIL_MAX_WIDTH;
}

/** Completed always; live trips on narrow web use the light trip row first. */
export function shouldPreferLightTripDetailFirstPaint(input: {
  completed: boolean;
  narrowWeb: boolean;
}): boolean {
  return input.completed || input.narrowWeb;
}

/**
 * Phone/narrow web must not open presence, checkpoints, geofence timeline, or
 * GPS realtime until the user opens Track — those polls stacked onto Postgres
 * while Dashboard showed Database Unhealthy (logs-43: 57014 / 25P03 / 57P05).
 */
export function shouldLoadTripTrackingQueries(input: {
  compactWeb: boolean;
  trackingUiOpen: boolean;
}): boolean {
  if (!input.compactWeb) return true;
  return input.trackingUiOpen;
}
