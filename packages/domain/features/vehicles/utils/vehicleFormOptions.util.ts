/**
 * Add Vehicle form options — vehicle categories (UI labels) and body length presets.
 * Body length list is deduplicated by normalized key (case/spacing).
 */

import { TRUCK_TYPE_AND_CAPACITY_PRESETS } from "../../indents/constants";
import { INDIAN_TRUCK_LIST } from "./indianTruckData.util";

export const VEHICLE_CATEGORY_LABELS = [
  "Mini Truck / LCV",
  "Open Body Truck",
  "Closed Container",
  "Trailer",
  "Tanker",
  "Tipper",
  "Other",
] as const;

export type VehicleCategoryLabel = (typeof VEHICLE_CATEGORY_LABELS)[number];

export function normalizeBodyLengthKey(label: string): string {
  return label.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Preset rows for scroll pickers; "Other" is handled in the UI.
 * Reused across multiple fields to avoid duplicated lists.
 */
const RAW_SCROLL_PRESET_OPTIONS: string[] = [
  ...TRUCK_TYPE_AND_CAPACITY_PRESETS,
  "Canter / 709 14 ft - 3.5 MT",
  "Canter 17 ft - 5 MT",
  "19 ft - 6 Wheeler - 7 MT",
  "19 ft - 6 Wheeler - 8 MT",
  "20 ft - 6.5 MT",
  "20 ft - 7 MT",
  "21 ft - 6 W container",
  "22 ft - 6W container",
  "24 ft SXL Container",
  "24 ft MXL container",
  "28 ft SXL Container",
  "28 ft MXL container",
  "30 ft Container",
  "32 ft SXL Container",
  "32 ft MXL Container",
  "32 Ft SXL",
  "32 Ft MXL",
  "40 FT",
  "25 MT",
  "21 MT",
  "8 FT",
  "20 FT",
  "16 MT",
  "19FT",
  "9 MT",
  "17 FT",
  "24 FT",
  "30 MT",
  "40 MT",
  "45 MT",
  "35 MT",
  "11 MT",
  "55 MT",
  "22 FT",
  "50 MT",
  "32 FT",
  "32 MT",
  "32 FT MXL 18 MT",
  "32 FT SXL HQ",
  "36 MT",
  "26 FT",
  "18 MT",
  "19 MT",
  "14 FT",
  "30 FT",
  "10 MT",
  "29 MT",
  "17 MT",
];

function dedupePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = normalizeBodyLengthKey(v);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export const BODY_LENGTH_SELECT_OPTIONS = dedupePreserveOrder(RAW_SCROLL_PRESET_OPTIONS);

export const OTHER_LABEL = "Other";

const BODY_TYPE_BY_CATEGORY: Record<string, string[]> = {
  "Mini Truck / LCV":   ["Open Body", "Closed Body", "Flatbed"],
  "Open Body Truck":    ["Open Body", "Half Body", "Full Body", "Flatbed"],
  "Closed Container":   ["Closed Body", "Half Body", "Full Body", "Curtain Side"],
  "Trailer":            ["Flatbed", "Closed Body", "Curtain Side", "Full Body"],
  "Tanker":             [],
  "Tipper":             [],
  "Other":              ["Open Body", "Closed Body", "Half Body", "Full Body", "Flatbed", "Curtain Side"],
};

export function getBodyTypeOptions(category: string): string[] {
  const c = category.trim();
  return BODY_TYPE_BY_CATEGORY[c] ?? ["Open Body", "Closed Body", "Half Body", "Full Body", "Flatbed", "Curtain Side"];
}

export const AXLE_CHIP_OPTIONS = [
  "1 Axle", "2 Axle", "3 Axle",
  "4x2", "6x2", "6x4", "8x2", "10x2", "10x4",
] as const;

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

/**
 * Model list should be independent from body length presets.
 * We derive it from `INDIAN_TRUCK_LIST` (deduped + sorted) and optionally narrow it by category.
 */
export function getModelSelectOptions(categoryLabel: string): string[] {
  const c = (categoryLabel ?? "").trim().toLowerCase();

  const matchType = (needle: string) =>
    INDIAN_TRUCK_LIST.filter((t) => (t.type ?? "").toLowerCase().includes(needle)).map(
      (t) => t.model,
    );

  let models: string[];
  if (c.includes("tipper")) {
    models = matchType("tipper");
  } else if (c.includes("tanker")) {
    models = matchType("tanker");
  } else if (c.includes("closed container") || c.includes("container")) {
    models = matchType("container");
  } else if (c.includes("open body")) {
    models = matchType("open body");
  } else if (c.includes("trailer")) {
    // Include tractor-trailer and trailer combos
    models = [...matchType("trailer"), ...matchType("tractor"), ...matchType("tractor head")];
  } else if (c.includes("mini") || c.includes("lcv")) {
    // Mini/LCV bucket
    models = [
      ...matchType("mini truck"),
      ...matchType("lcv"),
      ...matchType("pickup"),
      ...matchType("light truck"),
    ];
  } else {
    // Fallback: show all known models
    models = INDIAN_TRUCK_LIST.map((t) => t.model);
  }

  const out = uniqueSorted(models);
  // If the category filter produced no results, fall back to full list so the picker is never empty.
  return out.length > 0 ? out : uniqueSorted(INDIAN_TRUCK_LIST.map((t) => t.model));
}

