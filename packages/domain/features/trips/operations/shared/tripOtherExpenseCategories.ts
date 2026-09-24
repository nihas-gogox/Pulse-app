import type { TripOtherExpenseCategory } from "../../../../../../features/trips/operations/types";
import type { TripCostCategory } from "@/features/finance/domain/tripCostEvent";

export type TripOtherExpenseOption = {
  value: TripOtherExpenseCategory;
  label: string;
  hint?: string;
};

export const TRIP_OTHER_EXPENSE_OPTIONS: TripOtherExpenseOption[] = [
  { value: "parking", label: "Parking" },
  { value: "challan", label: "Challan / fine" },
  { value: "loading", label: "Loading" },
  { value: "unloading", label: "Unloading" },
  { value: "detention", label: "Detention" },
  { value: "maintenance", label: "Trip repair" },
  { value: "fastag", label: "FASTag" },
  { value: "advance", label: "Driver advance" },
  { value: "food", label: "Food / stay" },
  { value: "weighbridge", label: "Weighbridge" },
  { value: "misc", label: "Other" },
];

/** High-frequency categories shown first; rest behind “More”. */
export const PRIMARY_OTHER_EXPENSE_CATEGORY_VALUES: TripOtherExpenseCategory[] = [
  "parking",
  "challan",
  "loading",
  "unloading",
  "detention",
  "food",
];

export function splitOtherExpenseOptions(options = TRIP_OTHER_EXPENSE_OPTIONS): {
  primary: TripOtherExpenseOption[];
  more: TripOtherExpenseOption[];
} {
  const primarySet = new Set(PRIMARY_OTHER_EXPENSE_CATEGORY_VALUES);
  return {
    primary: options.filter((opt) => primarySet.has(opt.value)),
    more: options.filter((opt) => !primarySet.has(opt.value)),
  };
}

export function otherExpenseCategoryToCostCategory(
  category: TripOtherExpenseCategory,
): TripCostCategory {
  switch (category) {
    case "parking":
      return "parking";
    case "challan":
      return "penalty";
    case "loading":
      return "loading";
    case "unloading":
      return "unloading";
    case "detention":
      return "detention";
    case "maintenance":
      return "maintenance";
    case "fastag":
      return "fastag";
    case "advance":
      return "advance";
    case "food":
    case "weighbridge":
    case "misc":
    default:
      return "misc";
  }
}

export function formatOtherExpenseCategoryLabel(category: string): string {
  const match = TRIP_OTHER_EXPENSE_OPTIONS.find((opt) => opt.value === category);
  return match?.label ?? category.replaceAll("_", " ");
}
