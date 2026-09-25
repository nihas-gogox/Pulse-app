/**
 * Indent → Trip conversion service.
 *
 * Covers two paths:
 *   1. Direct-quote path  — use acceptAwardedQuote (create_trip_from_direct_quote RPC).
 *   2. Manual-assignment path — awardIndentToTrip (award_indent_to_trip RPC).
 *      For indents where the shipper assigns a supplier directly (assigned_supplier_id)
 *      without going through the quote/bid process.
 *
 * Both are idempotent: if a trip already exists for the indent it is returned (and any
 * newly supplied driver/vehicle is applied). O(1) per call; O(n) for batch.
 *
 * Edge cases handled in the RPCs:
 *   - Cancelled indent               → RAISE EXCEPTION (surfaced as error)
 *   - Missing required fields        → RAISE EXCEPTION
 *   - Trip already exists            → return existing trip (+ apply driver/vehicle)
 *   - Completed/cancelled trip       → return as-is (no field overwrite)
 *   - No supplier_id resolved        → trip created with supplier_id = NULL (draft)
 *   - Concurrent double-call         → unique index on trips.indent_id catches race
 */
import type { TripRow } from '@/features/trips/services/trips.service';
import { supabase } from '@/lib/supabase';

export interface AwardIndentOptions {
  /**
   * Agreed supplier rate. If omitted the RPC uses indent.assigned_supplier_rate
   * then falls back to indent.supplier_target.
   */
  supplierRate?: number | null;
  /** Direct supplier row id in the indent owner's org. Takes priority over supplierOrgId. */
  supplierId?: string | null;
  /**
   * Bidder organisation id. Used when you only know the external org (no supplier row id).
   * The RPC will resolve the supplier row by looking up suppliers.linked_organization_id.
   */
  supplierOrgId?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  vehicleDisplayNumber?: string | null;
}

export interface BatchAwardResult {
  /** Number of newly created trips. Already-existing trips are not counted. */
  created: number;
}

/**
 * Convert a single indent into a trip (manual-assignment path).
 * Idempotent — safe to call multiple times for the same indent.
 * Sets indent.status = 'completed' on success.
 */
export async function awardIndentToTrip(
  indentId: string,
  options?: AwardIndentOptions,
): Promise<{ error: Error | null; trip: TripRow | null }> {
  if (!indentId) {
    return { error: new Error('indentId is required'), trip: null };
  }

  const payload: {
    p_indent_id: string;
    p_supplier_rate?: number | null;
    p_supplier_id?: string | null;
    p_supplier_org_id?: string | null;
    p_driver_id?: string | null;
    p_vehicle_id?: string | null;
    p_vehicle_display_number?: string | null;
  } = { p_indent_id: indentId };

  if (options?.supplierRate != null) payload.p_supplier_rate = options.supplierRate;
  if (options?.supplierId != null) payload.p_supplier_id = options.supplierId;
  if (options?.supplierOrgId != null) payload.p_supplier_org_id = options.supplierOrgId;
  if (options?.driverId != null) payload.p_driver_id = options.driverId;
  if (options?.vehicleId != null) payload.p_vehicle_id = options.vehicleId;
  if (options?.vehicleDisplayNumber != null) {
    payload.p_vehicle_display_number = options.vehicleDisplayNumber.trim() || null;
  }

  const { data, error } = await supabase().rpc('award_indent_to_trip', payload);

  if (error) {
    return { error: new Error(error.message), trip: null };
  }

  const rows = (data ?? []) as TripRow[];
  return { error: null, trip: rows[0] ?? null };
}

export interface CreateTripFromAssignedIndentOptions {
  driverId?: string | null;
  vehicleId?: string | null;
  vehicleDisplayNumber?: string | null;
}

/**
 * Supplier Claimed deploy when indent was assigned to this org without a direct_quotes row.
 * Backed by public.create_trip_from_assigned_indent (supplier auth on assigned_supplier_id).
 */
export async function createTripFromAssignedIndent(
  indentId: string,
  options?: CreateTripFromAssignedIndentOptions,
): Promise<{ error: Error | null; trip: TripRow | null }> {
  if (!indentId) {
    return { error: new Error('indentId is required'), trip: null };
  }

  const payload: {
    p_indent_id: string;
    p_driver_id?: string | null;
    p_vehicle_id?: string | null;
    p_vehicle_display_number?: string | null;
  } = { p_indent_id: indentId };

  if (options?.driverId != null) payload.p_driver_id = options.driverId;
  if (options?.vehicleId != null) payload.p_vehicle_id = options.vehicleId;
  if (options?.vehicleDisplayNumber != null) {
    payload.p_vehicle_display_number = options.vehicleDisplayNumber.trim() || null;
  }

  // create_trip_from_assigned_indent settles the Marketplace fee itself, atomically with
  // trip creation, when the award needs it — a separate settle call here duplicated that
  // round trip and, if the RPC then failed for an unrelated reason, could leave the org
  // charged with no trip. Fee-pending failures still surface via the RPC's own
  // fee_payment_pending error (see formatDeployTripError in useStaffHandshake.ts).
  const { data, error } = await supabase().rpc(
    'create_trip_from_assigned_indent',
    payload,
  );

  if (error) {
    return { error: new Error(error.message), trip: null };
  }

  const rows = (data ?? []) as TripRow[];
  return { error: null, trip: rows[0] ?? null };
}

/**
 * that doesn't already have a trip. Single round-trip to the DB (set-based INSERT).
 *
 * Returns the count of trips created.  Already-existing trips are untouched.
 */
export async function batchAwardIndentsToTrips(
  orgId: string,
): Promise<{ error: Error | null; result: BatchAwardResult }> {
  if (!orgId) {
    return { error: new Error('orgId is required'), result: { created: 0 } };
  }

  const { data, error } = await supabase().rpc('batch_award_indents_to_trips', {
    p_org_id: orgId,
  });

  if (error) {
    return { error: new Error(error.message), result: { created: 0 } };
  }

  return { error: null, result: { created: Number(data ?? 0) } };
}

export interface CreateMoverAssetTripOptions {
  driverId?: string | null;
  vehicleId?: string | null;
  vehicleDisplayNumber?: string | null;
}

/**
 * Create the MOVER's own asset trip for an awarded load.
 *
 * When an aggregator awards a load to a mover, the shared aggregator-owned trip
 * is billed 'market' (mover = payable) and cannot double as the mover's asset
 * record (trips_one_per_indent). This creates the mover's own 'asset' trip
 * (owned by the mover org, linked via source_indent_id) so the mover can log
 * fuel / toll / driver salary. Idempotent per (mover org, indent).
 * Backed by public.create_mover_asset_trip.
 */
export async function createMoverAssetTrip(
  indentId: string,
  options?: CreateMoverAssetTripOptions,
): Promise<{ error: Error | null; trip: TripRow | null }> {
  if (!indentId) {
    return { error: new Error('indentId is required'), trip: null };
  }

  const payload: {
    p_indent_id: string;
    p_driver_id?: string | null;
    p_vehicle_id?: string | null;
    p_vehicle_display_number?: string | null;
  } = { p_indent_id: indentId };

  if (options?.driverId != null) payload.p_driver_id = options.driverId;
  if (options?.vehicleId != null) payload.p_vehicle_id = options.vehicleId;
  if (options?.vehicleDisplayNumber != null) {
    payload.p_vehicle_display_number =
      options.vehicleDisplayNumber.trim() || null;
  }

  const { data, error } = await supabase().rpc(
    'create_mover_asset_trip',
    payload,
  );

  if (error) {
    return { error: new Error(error.message), trip: null };
  }

  const rows = (data ?? []) as TripRow[];
  return { error: null, trip: rows[0] ?? null };
}
