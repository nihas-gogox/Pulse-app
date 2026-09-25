/**
 * Trip statuses where reassignment must NOT rewind workflow to `assigned`.
 * Keep in sync with SQL mid-trip lists in assign_aggregate_trip_driver migrations.
 *
 * Status meanings (dispatcher/driver workflow):
 * - in_transit / in_progress / intransit / transit — actively hauling
 * - picked_up / pickup / at_pickup — pickup phase
 * - at_drop / loading / unloading — at consignee or handling cargo
 * - dispatched / on_route / going_to_pickup / moving / started — en route or started leg
 * - s_in / s_out / d_in / d_out — gate/checkpoint legs (supplier/destination in-out)
 * - pod_pending / pod_received — proof-of-delivery workflow
 * - arrived / at_destination / confirmed_arrival — at or confirmed at destination
 */
export const PRESERVABLE_TRIP_STATUSES = [
  'in_transit',
  'in_progress',
  'intransit',
  'transit',
  'picked_up',
  'pickup',
  'at_pickup',
  'at_drop',
  'loading',
  'unloading',
  'dispatched',
  'on_route',
  'going_to_pickup',
  'moving',
  'started',
  's_in',
  's_out',
  'd_in',
  'd_out',
  'pod_pending',
  'pod_received',
  'arrived',
  'at_destination',
  'confirmed_arrival',
] as const;

export type PreservableTripStatus = (typeof PRESERVABLE_TRIP_STATUSES)[number];

const PRESERVABLE_SET = new Set<string>(PRESERVABLE_TRIP_STATUSES);

/** Statuses that may be set to `assigned` on first driver assign (pre-departure only). */
export const FIRST_ASSIGN_TARGET_STATUSES = new Set([
  'pending',
  'assigned',
  'draft',
  'confirmed',
  '',
]);

export function isPreservableTripStatus(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase().trim();
  return PRESERVABLE_SET.has(s);
}

/** SQL `IN (...)` fragment for migrations — must match PRESERVABLE_TRIP_STATUSES. */
export function preservableStatusesSqlInList(): string {
  return PRESERVABLE_TRIP_STATUSES.map((s) => `'${s}'`).join(', ');
}
