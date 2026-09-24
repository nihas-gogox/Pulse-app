/**
 * Create indent form options — aligned with pulse-unified-base create-indent types.
 */

import type { CirculationTarget } from "@/features/indents/services/indents.service";

/**
 * Truck body-length (FT) and payload (MT) presets used as vehicle type options
 * on Add Trip and Add Load. Do not add these to product / load type.
 */
export const TRUCK_TYPE_AND_CAPACITY_PRESETS = [
  "20 FT",
  "32 Ft MXL",
  "32 Ft SXL",
  "20 FT OPEN",
  "16 MT",
  "21 MT",
  "18 MT",
  "10 FT",
  "24 MT",
  "7 MT",
  "17 FT",
  "14 FT",
  "8 FT",
  "40 FT",
  "41 MT",
  "30 MT",
  "25 MT",
  "35 MT",
  "22 FT",
  "22 FT OPEN",
  "40 MT",
  "24 FT",
  "21 FT",
  "65 MT",
  "42 MT",
  "31 MT",
  "60 MT",
  "34 MT",
  "36 MT",
  "50 MT",
  "20 MT",
  "32 MT",
] as const;

export const VEHICLE_TYPES = [
  ...TRUCK_TYPE_AND_CAPACITY_PRESETS,
  "Tata Ace",
  "Eicher 14ft",
  "Taurus 17ft",
  "Container 20ft",
  "Container 32ft",
  "Trailer",
  "Container",
  "32FT Container",
  "40ft Container",
  "Truck",
  "Tipper",
  "Open Body",
  "Tanker",
  "Tempo",
  "Mini Truck",
  "Pickup",
];

export const LOAD_TYPES = [
  "Bags",
  "Carbon Powder",
  "Electronic Goods",
  "Engineering materials",
  "FMCG",
  "Paint",
  "Steel",
  "Tyre",
  "Electronics",
  "FMCG Goods",
  "Construction Material",
  "Textiles",
  "Machinery Parts",
  "Pharmaceuticals",
];

export const CIRCULATION_TARGETS: Array<{
  value: CirculationTarget;
  label: string;
  description: string;
}> = [
  {
    value: "marketplace",
    label: "Marketplace Only",
    description: "Post to open marketplace for competitive bidding",
  },
  {
    value: "integrated_supplier",
    label: "Integrated Suppliers",
    description: "Send to your integrated supplier network",
  },
  {
    value: "offline",
    label: "Offline Only",
    description: "Handle through offline channels",
  },
  {
    value: "both",
    label: "Marketplace + Integrated",
    description: "Post to both marketplace and integrated suppliers",
  },
];
