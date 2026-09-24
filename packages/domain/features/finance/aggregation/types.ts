/**
 * Minimal types for O(n) finance aggregation. No dependency on full LedgerRow/TripRow.
 * Single source of truth: ledger = cash movements; trips = contractual (billed, due, commission).
 */

export type ContactType = 'client' | 'supplier' | 'driver' | null;

/** Minimal ledger row; contact_type accepted as string for compatibility with tab props. */
export interface LedgerTx {
  contact_id?: string | null;
  contact_type?: string | null;
  amount_in?: number;
  amount_out?: number;
  party_name?: string | null;
  trip_id?: string | null;
  /** ISO date of the transaction. Used for month-scoped aggregation (Goals balance snapshot). */
  transaction_date?: string | null;
  created_at?: string | null;
}

/**
 * Map trip_id -> party ids for O(n) fallback when a ledger entry has trip_id but no contact_id.
 * Ensures debits (amount_out) and credits (amount_in) are attributed to the correct party
 * (e.g. when supplier assigns driver/vehicle, or legacy entries). One entry counts for at most one party.
 */
export interface TripPartyMap {
  [tripId: string]: {
    client_id?: string | null;
    supplier_id?: string | null;
    driver_id?: string | null;
  };
}

export interface TripForCustomer {
  /** Trip id; required for per-trip payment attribution (aligns with ClientDetailScreen). */
  id?: string;
  client_id: string | null;
  client_name: string | null;
  client_price: number;
  /** Trip owner org. For integrated suppliers, used to attribute receivables to linked_organization_id (shipper as client). */
  organization_id?: string | null;
  /** When current org is supplier, amount owed by trip owner (shipper) to us. */
  supplier_rate?: number | null;
  /** Source indent id; used to dedup when indent-level amounts are also included (prevents double-count). */
  indent_id?: string | null;
  /** Cached paid from trip row; used as initial paid for per-trip attribution. */
  amount_paid?: number | null;
}

export interface TripForSupplier {
  supplier_id: string | null;
  /** Optional; when supplier_id is null, used to match supplier by name (e.g. integrated/synced trips). */
  supplier_name?: string | null;
  supplier_rate: number;
  /** Canonical DCO discriminator. DCO trips settle via dco_payee, not this supplier list. */
  operating_mode?: string | null;
  /** Source indent id; used to dedup when indent-level amounts are also included (prevents double-count). */
  indent_id?: string | null;
  /** Present on full trip rows; used for party map / driver attribution. */
  driver_id?: string | null;
}

/**
 * Minimal indent shape for finance aggregation (pre-trip amount visibility on the Customers tab).
 * Supplier payables use trips only once an indent is converted.
 */
export interface IndentForAggregation {
  id: string;
  client_name: string;
  client_price: number;
  /** Indicative supplier target rate. Used as fallback display; actual due is from accepted quote. */
  supplier_target?: number | null;
  /** 'pending' | 'quoted' (legacy) | 'awarded' | 'completed' | 'cancelled'
   * 'quoted' is deprecated — no new rows after migration 20270128103100. */
  status: string;
}

/**
 * Minimal direct quote shape for finance aggregation.
 * Only accepted quotes contribute to supplier due amounts.
 */
export interface DirectQuoteForAggregation {
  id: string;
  indent_id: string;
  bidder_organization_id: string;
  amount: number;
  /** 'pending' | 'accepted' | 'rejected' */
  status: string;
}

export interface TripForDriver {
  driver_id: string | null;
  driver_commission?: number | null;
  supplier_rate?: number | null;
  /** Canonical DCO discriminator. DCO trips must not enter Finance → Drivers. */
  operating_mode?: string | null;
  /** Trip base price (REVENUE); used to compute commission from driver offer %. */
  client_price?: number | null;
  /**
   * Distance from DB (km).
   * Depending on serialization, it may come as `number` or a numeric `string` (e.g. "420").
   * Parsed to number for per-km commission.
   */
  distance?: string | number | null;
}

/** Driver offer from accepted invite (commission terms + fixed salary for calculation). */
export interface DriverOfferForAggregation {
  /** Fixed monthly salary (payable_amount from invite). */
  payableAmount?: number | null;
  commissionPercent: number | null;
  commissionPerKm: number | null;
}

export interface ClientLike {
  id: string;
  name?: string | null;
  contact_person?: string | null;
  is_integrated?: boolean;
  /** When set, client is another platform org (for shared ledger / Compare & Verify). */
  linked_organization_id?: string | null;
  /** Optional contact/commission percent; shown on subline with MANUAL/INTEGRATED. */
  contact_percent?: number | null;
}

export interface SupplierLike {
  id: string;
  name?: string | null;
  company_name?: string | null;
  contact_person?: string | null;
  supplier_type?: 'integrated' | 'offline' | 'marketplace';
  linked_organization_id?: string | null;
}

export interface DriverLike {
  id: string;
  name?: string | null;
  status?: string | null;
  /** Profile photo storage path or public URL; same as drivers row / PartyAvatar. */
  avatar_url?: string | null;
  /** Preset avatar seed when no photo. */
  avatar_seed?: string | null;
  /** When set, driver is linked to app user (integrated); otherwise non-integrated. */
  user_id?: string | null;
  /** When set, driver has left this fleet; show as disconnected with date. */
  left_at?: string | null;
  /** When true, driver was created only for trip tracking (OTP/assign-by-phone). Exclude from Drivers tab; do not show as INTEGRATED. */
  tracking_only?: boolean | null;
}

export interface FinancialRowData {
  id: string;
  name?: string;
  subline?: string;
  msn?: string | null;
  category?: string;
  desc?: string;
  in?: number;
  out?: number;
  received?: number;
  pending?: number;
  billed?: number;
  trips?: number;
  due?: number;
  sourced?: number;
  /** Supplier: total payables from trips (before paid); for overlay Total Payables. */
  payables?: number;
  sales?: number;
  expense?: number;
  status?: string;
  paid?: number;
  /** Customers: platform-linked (shared ledger) vs offline */
  is_integrated?: boolean;
  /** When set (supplier), trip owner org for "trips where we are client" in Compare & Verify. */
  linked_organization_id?: string | null;
  /** Optional contact/commission percent; shown on subline with MANUAL/INTEGRATED (e.g. "MANUAL · 10%"). */
  contactPercent?: number | null;
  /** Customers/Suppliers: contact person name; shown on entity subline left of Non-integrated/Integrated icon. */
  contactPerson?: string | null;
  /** Drivers: when set, driver has left the fleet; show as "Disconnected · Left on {date}". */
  left_at?: string | null;
  /** Drivers: profile image path/URL for FinancialRow / PartyAvatar (optional signed URL from parent). */
  profileImageUrl?: string | null;
  /** Drivers: seed preset when no profileImageUrl. */
  avatarSeed?: string | null;
  /**
   * Supplier-lane subtype. `dco` stays contact_type=dco internally and must not
   * route to a suppliers-table detail page.
   */
  counterpartyKind?: "supplier" | "dco";
}

export interface AggregationTotals {
  totalIn: number;
  totalOut: number;
}
