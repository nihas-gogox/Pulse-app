/**
 * O(n) driver aggregation. due = from trips (commission); paid = from ledger only (amount_out).
 * Commission: from driver offer (client_price * commission_percent/100 or distance * commission_per_km)
 * when available; else the trip's already-stamped driver_commission (see stampTripDriverPayFromTerms,
 * which only ever writes this when real agreed terms existed). No agreed terms → 0, never a guess.
 */
import type { FinancialRowData, AggregationTotals } from './types';
import type { LedgerTx, TripForDriver, DriverLike, DriverOfferForAggregation, TripPartyMap } from './types';
import { isDcoOperatingTrip } from '../../trips/domain/tripDcoOperating';
import { isDriverLedgerContactType } from '../domain/financeCounterpartyLane';

/** Parse trip distance (km) to numeric km for per-km commission. */
function parseDistanceKm(distance: string | number | null | undefined): number | null {
  if (distance == null) return null;
  if (typeof distance === 'string' && distance.trim() === '') return null;
  const n = Number(
    typeof distance === 'number'
      ? distance
      : String(distance).replace(/,/g, '').trim(),
  );
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Compute trip-based commission for one trip. Used in TRANSACTION LEDGER table (COMMISSION column).
 * 1) Driver offer: client_price * (commission_percent/100) or distance_km * commission_per_km.
 * 2) Else trip.driver_commission (already-stamped real amount — see stampTripDriverPayFromTerms).
 * No agreed terms and nothing stamped → 0. Never guess from supplier_rate/client_price: an
 * unagreed amount must not be treated as a real payable (see the driver-app equivalent,
 * resolveDriverTripPayoutTerms/hasAgreedPayoutTerms in driverUtils.util.ts, which this mirrors
 * on the business side).
 */
export function computeDriverCommissionForTrip(
  trip: Omit<TripForDriver, 'distance'> & { distance?: string | number | null },
  offer: DriverOfferForAggregation | null | undefined
): number {
  if (isDcoOperatingTrip(trip)) return 0;
  const basePrice = Number(trip.client_price ?? 0) || 0;
  const distanceKm = parseDistanceKm(trip.distance);
  if (offer) {
    const pct = offer.commissionPercent != null && Number(offer.commissionPercent) >= 0 ? Number(offer.commissionPercent) : null;
    const perKm = offer.commissionPerKm != null && Number(offer.commissionPerKm) >= 0 ? Number(offer.commissionPerKm) : null;
    if (pct != null && basePrice > 0) return (basePrice * pct) / 100;
    if (perKm != null && distanceKm != null && distanceKm > 0) return distanceKm * perKm;
  }
  return Number(trip.driver_commission ?? 0) || 0;
}

export function aggregateDrivers(
  drivers: readonly DriverLike[],
  trips: readonly TripForDriver[],
  transactions: readonly LedgerTx[],
  offersByDriverId?: Record<string, DriverOfferForAggregation> | null,
  _tripPartyMap?: TripPartyMap | null
): { rows: FinancialRowData[]; totals: AggregationTotals } {
  const dueFromTrips: Record<string, number> = {};
  const paidFromLedger: Record<string, number> = {};
  const tripCountByDriver: Record<string, number> = {};
  const offers = offersByDriverId ?? {};

  const driverIds = new Set<string>();
  for (let i = 0; i < drivers.length; i++) {
    const id = drivers[i].id;
    driverIds.add(id);
    dueFromTrips[id] = 0;
    paidFromLedger[id] = 0;
    tripCountByDriver[id] = 0;
  }

  for (let i = 0; i < trips.length; i++) {
    const t = trips[i];
    if (!t.driver_id) continue;
    // DCO settlement is dco_payee / contact_type=dco — never Finance → Drivers.
    if (isDcoOperatingTrip(t)) continue;
    const offer = offers[t.driver_id] ?? null;
    const commission = computeDriverCommissionForTrip(t, offer);
    dueFromTrips[t.driver_id] = (dueFromTrips[t.driver_id] ?? 0) + commission;
    tripCountByDriver[t.driver_id] = (tripCountByDriver[t.driver_id] ?? 0) + 1;
  }

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const amtOut = Number(tx.amount_out ?? 0);
    if (!amtOut) continue;

    if (isDriverLedgerContactType(tx.contact_type) && tx.contact_id) {
      paidFromLedger[tx.contact_id] =
        (paidFromLedger[tx.contact_id] ?? 0) + amtOut;
      continue;
    }

    // Intentionally do not infer driver payments from generic trip-linked cash-out rows.
    // Only explicit driver-linked ledger rows (contact_type=driver) should reduce due,
    // otherwise supplier/vehicle/other expenses can incorrectly zero-out driver pending.
  }

  const rows: FinancialRowData[] = [];
  let totalIn = 0;
  let totalOut = 0;

  for (let i = 0; i < drivers.length; i++) {
    const d = drivers[i];
    const id = d.id;
    const due = dueFromTrips[id] ?? 0;
    const paid = paidFromLedger[id] ?? 0;
    const pending = Math.max(0, due - paid);
    totalIn += paid + pending;
    totalOut += pending;
    const leftAt = d.left_at ?? null;
    const isDisconnected = leftAt != null && leftAt !== '';
    const isIntegrated =
      !isDisconnected &&
      (d.tracking_only !== true) &&
      d.user_id != null &&
      d.user_id !== '';
    const leftAtFormatted =
      leftAt != null && leftAt !== ''
        ? (() => {
            try {
              const date = new Date(leftAt);
              return isNaN(date.getTime()) ? leftAt : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            } catch {
              return leftAt;
            }
          })()
        : null;
    const displayName = d.name ?? (d as { full_name?: string | null }).full_name ?? undefined;
    const rawAvatar = (d.avatar_url ?? "").trim();
    const rawSeed = (d.avatar_seed ?? "").trim();
    rows.push({
      id,
      name: displayName ?? undefined,
      subline: leftAtFormatted ? `Disconnected · Left on ${leftAtFormatted}` : (d.status ?? undefined),
      status: isDisconnected ? 'DISCONNECTED' : (d.status ?? 'offline'),
      trips: tripCountByDriver[id] ?? 0,
      paid,
      pending,
      due,
      is_integrated: isIntegrated,
      left_at: leftAt ?? undefined,
      profileImageUrl: rawAvatar || undefined,
      avatarSeed: rawSeed || undefined,
    });
  }

  return {
    rows,
    totals: { totalIn, totalOut },
  };
}
