import { useSafeBack } from "@pulse/core/lib/useSafeBack";
import { tripExpenseEntryFallbackHref } from "./tripExpenseEntryExit.util";

/**
 * Leave an expense entry screen. Uses history when present; otherwise replaces
 * onto the trip Expense Hub (web deep links and replace-navigations have no back stack).
 */
export function useLeaveTripExpenseEntry(tripId: string): () => void {
  return useSafeBack(tripExpenseEntryFallbackHref(tripId));
}
