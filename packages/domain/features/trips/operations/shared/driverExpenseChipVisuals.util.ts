import type { LucideIcon } from "lucide-react-native";
import {
  Banknote,
  Building2,
  CircleDot,
  CircleParking,
  Clock,
  CreditCard,
  Droplets,
  Fuel,
  HandCoins,
  HelpCircle,
  Hourglass,
  Landmark,
  Layers,
  Leaf,
  MapPin,
  MoreHorizontal,
  Nfc,
  PackageMinus,
  PackagePlus,
  Radio,
  Receipt,
  Scale,
  Sparkles,
  Ticket,
  Truck,
  UserRound,
  UtensilsCrossed,
  Wrench,
} from "lucide-react-native";

import Theme from "@pulse/core/constants/Theme";

import type {
  FuelType,
  OperationalPaymentMode,
  OperationalPaymentOwner,
  TripOtherExpenseCategory,
} from "../types";

export type DriverChipVisual = {
  Icon: LucideIcon;
  /** Icon stroke when tile is idle */
  tint: string;
  /** Icon badge background when idle */
  tintBg: string;
  /** Icon badge background when selected */
  activeTintBg: string;
};

/** Shared idle palette — light gray icons, no per-chip color coding. */
const IDLE_TINT = Theme.textMuted;
const IDLE_TINT_BG = "rgba(148,163,184,0.12)";
const ACTIVE_TINT_BG = Theme.driverEmeraldMuted;

function chip(Icon: LucideIcon): DriverChipVisual {
  return {
    Icon,
    tint: IDLE_TINT,
    tintBg: IDLE_TINT_BG,
    activeTintBg: ACTIVE_TINT_BG,
  };
}

const OTHER_CATEGORY_VISUALS: Record<TripOtherExpenseCategory, DriverChipVisual> = {
  parking: chip(CircleParking),
  challan: chip(Ticket),
  loading: chip(PackagePlus),
  unloading: chip(PackageMinus),
  detention: chip(Hourglass),
  maintenance: chip(Wrench),
  fastag: chip(Nfc),
  advance: chip(HandCoins),
  food: chip(UtensilsCrossed),
  weighbridge: chip(Scale),
  misc: chip(Sparkles),
};

const DRIVER_EXPENSE_CATEGORY_VISUALS: Record<string, DriverChipVisual> = {
  fuel: chip(Fuel),
  toll: chip(Landmark),
  ...OTHER_CATEGORY_VISUALS,
};

const PAYMENT_MODE_VISUALS: Record<OperationalPaymentMode, DriverChipVisual> = {
  cash: chip(Banknote),
  fastag: chip(Radio),
  card: chip(CreditCard),
  credit: chip(Receipt),
  pending: chip(Clock),
  unknown: chip(HelpCircle),
};

const FUEL_TYPE_VISUALS: Record<FuelType, DriverChipVisual> = {
  diesel: chip(Fuel),
  petrol: chip(Droplets),
  cng: chip(Leaf),
  other: chip(CircleDot),
};

const TOLL_ENTRY_VISUALS: Record<"actual" | "estimated", DriverChipVisual> = {
  actual: chip(MapPin),
  estimated: chip(MoreHorizontal),
};

const PAYMENT_OWNER_VISUALS: Record<OperationalPaymentOwner, DriverChipVisual> = {
  organization: chip(Building2),
  driver: chip(UserRound),
  supplier: chip(Truck),
  fleet_card: chip(CreditCard),
  fastag: chip(Radio),
  cash_advance: chip(Banknote),
  credit_vendor: chip(Receipt),
  unknown: chip(HelpCircle),
};

const DEFAULT_VISUAL: DriverChipVisual = chip(Layers);

export function visualForDriverExpenseCategory(value: string): DriverChipVisual {
  return DRIVER_EXPENSE_CATEGORY_VISUALS[value] ?? DEFAULT_VISUAL;
}

export function visualForOtherExpenseCategory(
  value: TripOtherExpenseCategory,
): DriverChipVisual {
  return OTHER_CATEGORY_VISUALS[value] ?? DEFAULT_VISUAL;
}

export function visualForPaymentMode(value: OperationalPaymentMode): DriverChipVisual {
  return PAYMENT_MODE_VISUALS[value] ?? DEFAULT_VISUAL;
}

export function visualForPaymentOwner(value: OperationalPaymentOwner): DriverChipVisual {
  return PAYMENT_OWNER_VISUALS[value] ?? DEFAULT_VISUAL;
}

export function visualForFuelType(value: FuelType): DriverChipVisual {
  return FUEL_TYPE_VISUALS[value] ?? DEFAULT_VISUAL;
}

export function visualForTollEntryType(value: "actual" | "estimated"): DriverChipVisual {
  return TOLL_ENTRY_VISUALS[value] ?? DEFAULT_VISUAL;
}

export function resolveDriverChipVisual(
  value: string,
  group:
    | "other_category"
    | "driver_expense_category"
    | "payment_mode"
    | "payment_owner"
    | "fuel_type"
    | "toll_entry",
): DriverChipVisual {
  switch (group) {
    case "other_category":
      return visualForOtherExpenseCategory(value as TripOtherExpenseCategory);
    case "driver_expense_category":
      return visualForDriverExpenseCategory(value);
    case "payment_mode":
      return visualForPaymentMode(value as OperationalPaymentMode);
    case "payment_owner":
      return visualForPaymentOwner(value as OperationalPaymentOwner);
    case "fuel_type":
      return visualForFuelType(value as FuelType);
    case "toll_entry":
      return visualForTollEntryType(value as "actual" | "estimated");
    default:
      return DEFAULT_VISUAL;
  }
}
