import { ROUTES } from "@pulse/core/lib/routes";

/** Parent surface for fuel / toll / other entry — Expense Hub on trip detail. */
export function tripExpenseEntryExitHref(tripId: string): string {
  return ROUTES.tripDetail(tripId, { tab: "expenses" });
}

export function tripExpenseEntryFallbackHref(tripId: string): string {
  return tripId.trim() ? tripExpenseEntryExitHref(tripId) : ROUTES.TABS.TRIPS;
}
