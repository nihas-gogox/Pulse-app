import type { Router } from "expo-router";

import { ROUTES } from "@pulse/core/lib/routes";

import type { TripOtherExpenseCategory } from "../types";
import { TRIP_OTHER_EXPENSE_OPTIONS } from "./tripOtherExpenseCategories";

/** Unified driver expense picker — fuel, toll, and other trip costs. */
export type DriverExpenseCategoryNav =
  | "fuel"
  | "toll"
  | TripOtherExpenseCategory;

export type DriverExpenseCategoryOption = {
  value: DriverExpenseCategoryNav;
  label: string;
};

const DRIVER_CATEGORY_COMPACT_LABELS: Partial<Record<DriverExpenseCategoryNav, string>> = {
  challan: "Challan",
  maintenance: "Repair",
  advance: "Advance",
  food: "Food",
  weighbridge: "Weighbridge",
  misc: "Other",
};

export const DRIVER_EXPENSE_CATEGORY_OPTIONS: DriverExpenseCategoryOption[] = [
  { value: "fuel", label: "Fuel" },
  { value: "toll", label: "Toll" },
  ...TRIP_OTHER_EXPENSE_OPTIONS.map((opt) => ({
    value: opt.value,
    label: DRIVER_CATEGORY_COMPACT_LABELS[opt.value] ?? opt.label,
  })),
];

export type DriverExpenseFormKind = "fuel" | "toll" | "other";

export function isTripOtherExpenseCategory(
  value: string,
): value is TripOtherExpenseCategory {
  return TRIP_OTHER_EXPENSE_OPTIONS.some((opt) => opt.value === value);
}

/** Map stored / legacy / cost-category strings to a chip-selectable other category. */
export function normalizeTripOtherExpenseCategory(
  raw: string | null | undefined,
): TripOtherExpenseCategory {
  const trimmed = raw?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (trimmed && isTripOtherExpenseCategory(trimmed)) return trimmed;

  if (trimmed === "penalty" || trimmed === "fine" || trimmed === "e_challan") {
    return "challan";
  }
  if (trimmed === "repair" || trimmed === "service") return "maintenance";
  if (trimmed === "meal" || trimmed === "stay" || trimmed === "hotel") return "food";
  if (trimmed === "other" || trimmed === "general") return "misc";

  return "parking";
}

export function parseDriverExpenseCategoryParam(
  raw: string | null | undefined,
): TripOtherExpenseCategory {
  const trimmed = raw?.trim();
  if (!trimmed) return "parking";
  return normalizeTripOtherExpenseCategory(trimmed);
}

export function parseDriverExpenseKindParam(
  raw: string | null | undefined,
): DriverExpenseFormKind {
  const trimmed = raw?.trim().toLowerCase();
  if (trimmed === "fuel") return "fuel";
  if (trimmed === "toll") return "toll";
  return "other";
}

/** New driver expense entries — single route with optional kind/category query. */
export function driverExpenseEntryHref(
  tripId: string,
  opts?: {
    kind?: DriverExpenseFormKind;
    category?: TripOtherExpenseCategory;
    entryId?: string;
  },
): string {
  if (opts?.entryId) {
    if (opts.kind === "fuel") return ROUTES.tripFuelEntry(tripId, opts.entryId);
    if (opts.kind === "toll") return ROUTES.tripTollEntry(tripId, opts.entryId);
    return ROUTES.tripOtherExpenseEntry(tripId, opts.entryId);
  }

  const base = ROUTES.tripOtherExpenseEntry(tripId);
  const params = new URLSearchParams();
  if (opts?.kind && opts.kind !== "other") params.set("kind", opts.kind);
  if (opts?.category) params.set("category", opts.category);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function activeDriverExpenseCategoryValue(
  formKind: DriverExpenseFormKind,
  otherCategory: TripOtherExpenseCategory,
): DriverExpenseCategoryNav {
  if (formKind === "fuel") return "fuel";
  if (formKind === "toll") return "toll";
  return otherCategory;
}

export function navigateDriverExpenseCategory(
  router: Router,
  tripId: string,
  next: DriverExpenseCategoryNav,
  currentForm: DriverExpenseFormKind,
): void {
  if (next === "fuel") {
    if (currentForm !== "fuel") {
      router.replace(ROUTES.tripFuelEntry(tripId) as never);
    }
    return;
  }
  if (next === "toll") {
    if (currentForm !== "toll") {
      router.replace(ROUTES.tripTollEntry(tripId) as never);
    }
    return;
  }
  if (currentForm !== "other") {
    router.replace(
      `${ROUTES.tripOtherExpenseEntry(tripId)}?category=${encodeURIComponent(next)}` as never,
    );
  }
}
