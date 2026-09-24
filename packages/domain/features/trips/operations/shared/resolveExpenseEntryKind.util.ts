import { getTripFuelEntryById } from "../fuel/fuel.service";
import { getTripOtherExpenseById } from "../other/otherExpense.service";
import type { TripOtherExpenseCategory } from "../types";
import { getTripTollEntryById } from "../toll/toll.service";
import {
  normalizeTripOtherExpenseCategory,
  type DriverExpenseFormKind,
} from "./driverExpenseCategoryNav.util";

export type ResolvedExpenseEntry = {
  kind: DriverExpenseFormKind;
  otherCategory?: TripOtherExpenseCategory;
};

/** Resolve fuel / toll / other from a raw source row id (edit flows). */
export async function resolveExpenseEntryKind(
  entryId: string,
): Promise<ResolvedExpenseEntry> {
  const id = entryId.trim();
  if (!id) return { kind: "other" };

  const [fuelRes, tollRes, otherRes] = await Promise.all([
    getTripFuelEntryById(id),
    getTripTollEntryById(id),
    getTripOtherExpenseById(id),
  ]);

  if (fuelRes.entry) return { kind: "fuel" };
  if (tollRes.entry) return { kind: "toll" };
  if (otherRes.entry) {
    return {
      kind: "other",
      otherCategory: normalizeTripOtherExpenseCategory(otherRes.entry.expense_category),
    };
  }

  return { kind: "other" };
}
