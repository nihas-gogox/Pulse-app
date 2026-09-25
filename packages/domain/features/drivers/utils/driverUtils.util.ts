/**
 * Driver app — helpers for trip display.
 * Aggregate trips (supplier_id set) are ad-hoc: finance is handled offline, so we do not show
 * trip rate or commission derived from client_price/supplier_rate to the driver.
 */

import * as driversService from "../services/drivers.service";
import { isDcoOperatingTrip } from "../../trips/domain/tripDcoOperating";
import { getTripExecutionModel } from "../../trips/domain/tripExecutionModel";
import type { TripRow } from "../../trips/services/trips.service";

export interface TripWithSupplier {
  supplier_id?: string | null;
  driver_commission?: number | null;
  supplier_rate?: number | null;
  client_price?: number | null;
  distance?: string | number | null;
  odometer_distance_km?: number | null;
  gps_distance_km?: number | null;
  operating_mode?: string | null;
  dco_payee_id?: string | null;
  trip_payout_mode?: string | null;
}

export interface DriverTripPayoutTerms {
  commissionPercent?: number | null;
  commissionPerKm?: number | null;
}

function pickTripDistanceKm(trip: TripWithSupplier): number {
  const odometer = Number(trip.odometer_distance_km ?? 0);
  if (Number.isFinite(odometer) && odometer > 0) return odometer;
  const gps = Number(trip.gps_distance_km ?? 0);
  if (Number.isFinite(gps) && gps > 0) return gps;
  const fallback = Number(trip.distance ?? 0);
  if (Number.isFinite(fallback) && fallback > 0) return fallback;
  return 0;
}

/** Trip shape for roster detection (source + driver/vehicle from org). */
export interface TripRosterShape {
  source?: string | null;
  driver_id?: string | null;
  vehicle_id?: string | null;
}

/** True when trip is roster-from-LoadHub (connected/integrated): driver+vehicle from org — no OTP.
 * Market-awarded DCO trips are also identity-linked at accept time (no phone OTP claim). */
export function isRosterTrip(trip: TripRosterShape | null | undefined): boolean {
  if (!trip) return false;
  const source = String(trip.source ?? "").trim();
  if (source === "market_bid" && !!(trip.driver_id && String(trip.driver_id).trim())) {
    return true;
  }
  return (
    source === "direct_quote" &&
    !!(trip.driver_id && String(trip.driver_id).trim()) &&
    !!(trip.vehicle_id && String(trip.vehicle_id).trim())
  );
}

/** True when trip is aggregate (outsourced/partner); driver payment is handled offline. */
export function isAggregateTrip(trip: TripWithSupplier | null | undefined): boolean {
  if (!trip) return false;
  const sid = trip.supplier_id;
  return !!(sid && String(sid).trim());
}

/**
 * Context for the Trips hub / trip-detail **Asset vs Aggregate** pill only.
 * Does not replace {@link isAggregateTrip} for OTP gates, earnings, or ledger logic.
 */
export type AggregateTripKindPillContext = {
  viewerOrganizationId?: string | null;
  supplierLinkedOrganizationId?: string | null;
  /** When true, driver was created for OTP / assign-by-phone — always show Aggregate pill. */
  driverTrackingOnly?: boolean | null;
};

export type HubTripKind = "asset" | "aggregate" | "dco";

/**
 * Hub / detail trip-kind pill.
 * DCO is only `operating_mode === 'DCO'` ({@link isDcoOperatingTrip}).
 * Non-DCO Asset vs Aggregate uses {@link getTripExecutionModel}.
 * `ctx` is reserved for hub viewers; it must not override DCO.
 */
export function getHubTripKind(
  trip: TripWithSupplier &
    TripRosterShape & { organization_id?: string | null },
  _ctx?: AggregateTripKindPillContext | null,
): HubTripKind {
  if (isDcoOperatingTrip(trip)) return "dco";
  return getTripExecutionModel(trip as TripRow);
}

/**
 * Whether the UI should show the **AGGREGATE** (vs ASSET) trip-kind pill for the current viewer.
 *
 * Cross-org partner views (awarded supplier looking at the aggregator's trip) always stay
 * **AGGREGATE** — that tile is settlement-only. The mover's own `mover_asset` trip (owned by
 * the supplier org, supplier_id null) is the ASSET tile where fuel/toll/driver pay live.
 * Do not re-introduce the old "infer Asset for supplier on shipper trip" workaround: it made
 * both tiles look identical and routed movers into a screen with no expense entry.
 *
 * DCO trips are grouped with Aggregate (see {@link getHubTripKind}).
 */
export function shouldShowAggregateTripKindPill(
  trip: TripWithSupplier &
    TripRosterShape & { organization_id?: string | null },
  ctx?: AggregateTripKindPillContext | null,
): boolean {
  return getHubTripKind(trip, ctx) !== "asset";
}

type TripPayoutShape = TripWithSupplier & {
  trip_payout_mode?: string | null;
};

/**
 * Manifest hero right column: **driver** on asset trips; **supplier** on aggregate/market.
 * Uses explicit payout mode first, then the same Asset vs Aggregate pill rules as Trips hub.
 */
export function shouldShowManifestHeroDriverParty(
  trip: TripWithSupplier &
    TripRosterShape & { organization_id?: string | null },
  ctx?: AggregateTripKindPillContext | null,
): boolean {
  const payoutMode = String((trip as TripPayoutShape).trip_payout_mode ?? "")
    .trim()
    .toLowerCase();

  if (isDcoOperatingTrip(trip)) return false;
  if (payoutMode === "market") return false;
  if (payoutMode === "asset") return true;
  if (!isAggregateTrip(trip)) return true;
  return !shouldShowAggregateTripKindPill(trip, ctx);
}

/**
 * Trips hub violet pill (Integrated vs Manual): **Integrated** only when the trip is aggregate and was
 * created via Load Hub (`source === direct_quote`). Aggregate trips with `manual` (or any other) source
 * show **Manual** — matches DB `trips.source`; does not change {@link isAggregateTrip} or ledger behavior.
 */
export function shouldShowIntegratedSubtypePillForHub(
  trip: TripWithSupplier & TripRosterShape,
): boolean {
  if (!isAggregateTrip(trip)) return false;
  return String(trip.source ?? "").trim() === "direct_quote";
}

/** Legacy guess applied when a driver has no agreed pay terms on record. */
const UNAGREED_EARNINGS_RATIO = 0.1;

/**
 * How a trip's driver earnings figure was arrived at.
 * - `trip_commission` — explicit `driver_commission` set on the trip
 * - `per_km` / `commission_percent` — agreed invite terms
 * - `estimated` — NO agreed terms exist; the 10% legacy guess. Callers must
 *   label this as an estimate and prompt for real terms rather than presenting
 *   it as money the driver is owed.
 * - `none` — nothing to compute from
 */
export type DriverEarningsBasis =
  | "trip_commission"
  | "per_km"
  | "commission_percent"
  | "dco_settlement"
  | "estimated"
  | "none";

export interface DriverTripEarnings {
  amount: number;
  basis: DriverEarningsBasis;
  /** True when no agreed pay terms back this number — it is a guess, not a rate. */
  isEstimated: boolean;
}

/**
 * Trip earnings plus the provenance of the figure. Prefer this over
 * `tripEarningsForDriver` anywhere the number is shown to a user or used to
 * settle money — the `estimated` basis means nobody agreed to the amount.
 */
export function tripEarningsDetailForDriver(
  trip: TripWithSupplier | null | undefined,
  payoutTerms?: DriverTripPayoutTerms | null,
  driverOrgIds?: Iterable<string> | null,
): DriverTripEarnings {
  const none = { amount: 0, basis: "none" as const, isEstimated: false };
  if (!trip) return none;

  if (isDcoOperatingTrip(trip)) {
    const agreed = Number(trip.supplier_rate ?? 0) || 0;
    if (agreed > 0) {
      return {
        amount: Math.round(agreed),
        basis: "dco_settlement",
        isEstimated: false,
      };
    }
    return none;
  }

  /**
   * A driver is paid by their EMPLOYER, never by their employer's customer.
   *
   * An indent-based awarded load creates two trip rows (docs/TRIP_VARIANTS.md §4):
   * the middleman's money row and the mover's own work row. The mover's driver is
   * stamped on BOTH — on the middleman's row only so the broker can track who is
   * carrying its client's goods. Computing earnings from that row pays the driver
   * twice for one job, off the broker's larger prices.
   *
   * Worked example (live): alishek is PR logistics' driver. PR was awarded ITS
   * Logistics' load. Earnings must come from PR's row only (1,900) — never from
   * ITS's row, which previously contributed a phantom 2,750, and after that field
   * was zeroed fell through to the 10% legacy guess for an even worse 3,800.
   *
   * So: when the caller tells us which orgs the driver actually belongs to, any
   * trip owned by a different org earns nothing. Returning `none` here is what
   * stops the fallbacks below from inventing a number — zeroing
   * `driver_commission` alone is not enough, because rule 4 treats 0 as "unset".
   *
   * Omitting `driverOrgIds` preserves the old behavior for callers that have no
   * driver context; trips with no `organization_id` are never excluded.
   */
  const commission = Number(trip.driver_commission ?? 0) || 0;

  if (driverOrgIds != null) {
    const owned = new Set<string>();
    for (const id of driverOrgIds) {
      const v = String(id ?? "").trim();
      if (v !== "") owned.add(v);
    }
    const tripOrg = String(
      (trip as TripWithSupplier & { organization_id?: string | null }).organization_id ?? "",
    ).trim();
    const isForeignOrg = owned.size > 0 && tripOrg !== "" && !owned.has(tripOrg);
    /**
     * Foreign-org row earns nothing — EXCEPT when it carries an explicit
     * `driver_commission`. Verified live: 3 drivers have a broker row whose paired
     * mover_asset row was never created (the known gap where
     * _ensure_mover_asset_trip does not run). Two of those sit at 0 and are
     * correctly dropped; Mani's carries 4,500 and is the only record of that job's
     * pay. Suppressing it would silently erase real money owed, which is worse
     * than showing it on the broker's row. An explicit figure was set by a human
     * or by the completion trigger against that specific row — honour it.
     *
     * The phantom double-count this fix targets is gone either way: those rows
     * were zeroed, so they take the `return none` branch.
     */
    if (isForeignOrg && commission <= 0) return none;
  }
  if (commission > 0) {
    return {
      amount: Math.round(commission),
      basis: "trip_commission",
      isEstimated: false,
    };
  }

  const perKm = Number(payoutTerms?.commissionPerKm ?? 0) || 0;
  if (perKm > 0) {
    const km = pickTripDistanceKm(trip);
    if (km > 0) {
      return { amount: Math.round(km * perKm), basis: "per_km", isEstimated: false };
    }
  }

  const commissionPercent = Number(payoutTerms?.commissionPercent ?? 0) || 0;
  if (commissionPercent > 0) {
    const ratio = Math.min(100, commissionPercent) / 100;
    const supplierRate = Number(trip.supplier_rate ?? 0) || 0;
    if (supplierRate > 0) {
      return {
        amount: Math.round(supplierRate * ratio),
        basis: "commission_percent",
        isEstimated: false,
      };
    }
    const clientPrice = Number(trip.client_price ?? 0) || 0;
    if (clientPrice > 0) {
      return {
        amount: Math.round(clientPrice * ratio),
        basis: "commission_percent",
        isEstimated: false,
      };
    }
  }

  const supplierRate = Number(trip.supplier_rate ?? 0) || 0;
  if (supplierRate > 0) {
    return {
      amount: Math.round(supplierRate * UNAGREED_EARNINGS_RATIO),
      basis: "estimated",
      isEstimated: true,
    };
  }
  const clientPrice = Number(trip.client_price ?? 0) || 0;
  if (clientPrice > 0) {
    return {
      amount: Math.round(clientPrice * UNAGREED_EARNINGS_RATIO),
      basis: "estimated",
      isEstimated: true,
    };
  }
  return none;
}

/**
 * Trip earnings shown to driver.
 * Priority:
 * 1) explicit `driver_commission` on trip
 * 2) accepted invite per-km payout (odometer distance first, then GPS, then trip distance)
 * 3) accepted invite trip-level commission %
 * 4) legacy fallback (10% supplier_rate, else 10% client_price)
 *
 * Returns the bare number. Use `tripEarningsDetailForDriver` when the caller
 * needs to know whether case 4 fired.
 */
export function tripEarningsForDriver(
  trip: TripWithSupplier | null | undefined,
  payoutTerms?: DriverTripPayoutTerms | null,
  driverOrgIds?: Iterable<string> | null,
): number {
  return tripEarningsDetailForDriver(trip, payoutTerms, driverOrgIds).amount;
}

export interface DriverTripPayoutOffer extends DriverTripPayoutTerms {
  /** Monthly salary — tripEarningsDetailForDriver has no concept of this; checked separately. */
  payableAmount?: number | null;
}

export interface DriverTripPayoutResolution {
  /**
   * True when a real per-trip commission basis (stored trip_commission, agreed
   * per-km, or agreed commission %) or a monthly salary is on record. False for
   * the legacy 10% guess, or when nothing is configured at all — a `drivers` row
   * existing is never sufficient on its own.
   */
  hasAgreedPayoutTerms: boolean;
  commissionDetail: DriverTripEarnings;
  monthlyPayableAmount: number;
}

/**
 * Whether a trip's driver-facing earnings figure is backed by something actually
 * agreed, as opposed to `tripEarningsDetailForDriver`'s legacy 10%-of-price guess.
 * Callers that display a hero "your earnings" number should gate on
 * `hasAgreedPayoutTerms`, not on the amount being non-zero — the guess is also
 * non-zero whenever the trip has a price, which is exactly what makes it unsafe
 * to show as payable.
 */
export function resolveDriverTripPayoutTerms(
  trip: TripWithSupplier | null | undefined,
  offer?: DriverTripPayoutOffer | null,
): DriverTripPayoutResolution {
  const commissionDetail = tripEarningsDetailForDriver(trip, offer);
  const hasRealCommissionBasis =
    commissionDetail.basis === "trip_commission" ||
    commissionDetail.basis === "per_km" ||
    commissionDetail.basis === "commission_percent" ||
    commissionDetail.basis === "dco_settlement";
  const monthlyPayableAmount = Number(offer?.payableAmount ?? 0) || 0;
  return {
    hasAgreedPayoutTerms: hasRealCommissionBasis || monthlyPayableAmount > 0,
    commissionDetail,
    monthlyPayableAmount,
  };
}

/**
 * Whether the driver assignment / mission UI may show a trip ₹ as EST. EARNINGS.
 *
 * False when:
 * - Trip is supplier-mediated (**aggregate**) — shipper→supplier commercial
 *   price is not the driver's pay (Driver-cum-Owner payable not defined yet).
 * - Phone / tracking-only stub assignment (no employment pay terms).
 * - No agreed salary / commission / trip_commission on record.
 */
export function canShowDriverTripEstEarnings(
  trip: TripWithSupplier | null | undefined,
  offer?: DriverTripPayoutOffer | null,
  opts?: { trackingOnly?: boolean | null },
): boolean {
  if (!trip) return false;
  if (isDcoOperatingTrip(trip)) {
    return resolveDriverTripPayoutTerms(trip, offer).hasAgreedPayoutTerms;
  }
  if (isAggregateTrip(trip)) return false;
  if (opts?.trackingOnly === true) return false;
  return resolveDriverTripPayoutTerms(trip, offer).hasAgreedPayoutTerms;
}

/** Hero copy when {@link canShowDriverTripEstEarnings} is false. */
export const DRIVER_PAY_NA_AMOUNT = "—";
export const DRIVER_PAY_NA_LABEL = "PAY N/A";

export function isAssignedNotStarted(status: string) {
  const s = (status || "").toLowerCase();
  return s === "assigned" || s === "pending" || s === "scheduled";
}

export function isActiveMission(status: string) {
  const s = (status || "").toLowerCase();
  return (
    s === "in_progress" ||
    s === "in_transit" ||
    s === "transit" ||
    s === "picked_up" ||
    s === "pickup" ||
    s === "started" ||
    s === "at_drop"
  );
}

export function isCompletedStatus(status: string) {
  const s = (status || "").toLowerCase();
  return s === "completed" || s === "delivered" || s === "done";
}

export function buildInviteOfferText(inv: driversService.DriverInviteRow): string {
  const parts: string[] = [];
  if (inv.payable_amount != null && inv.payable_amount > 0) {
    parts.push(`₹${Number(inv.payable_amount).toLocaleString("en-IN")}`);
  }
  if (inv.commission_percent != null && inv.commission_percent > 0) {
    parts.push(`${inv.commission_percent}% commission`);
  }
  if (inv.commission_per_km != null && inv.commission_per_km > 0) {
    parts.push(`₹${inv.commission_per_km}/km`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Offer on accept";
}

export function isCompleted(status: string) {
  const s = (status || '').toLowerCase();
  return s === 'completed' || s === 'delivered' || s === 'done';
}

export function buildOfferText(inv: driversService.DriverInviteRow): string {
  const parts: string[] = [];
  if (inv.payable_amount != null && inv.payable_amount > 0) {
    parts.push(`₹${Number(inv.payable_amount).toLocaleString('en-IN')}`);
  }
  if (inv.commission_percent != null && inv.commission_percent > 0) {
    parts.push(`${inv.commission_percent}% commission`);
  }
  if (inv.commission_per_km != null && inv.commission_per_km > 0) {
    parts.push(`₹${inv.commission_per_km}/km`);
  }
  return parts.length ? parts.join(' · ') : 'Offer on accept';
}
