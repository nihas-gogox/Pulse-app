/**
 * Dispatcher-side reads from driver_presence.
 *
 * driver_presence is the PRIMARY source of truth for live driver position —
 * not driver_locations. One row per driver, UPSERTed by the driver app.
 * RLS: org members can read presence for their org's drivers.
 */

import { supabase } from '@pulse/core/lib/supabase';

export type DriverPresenceRow = {
  driver_id: string;
  trip_id: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed_kmh: number | null;
  recorded_at: string;
  session_id: string | null;
};

const SELECT_COLUMNS =
  'driver_id, trip_id, latitude, longitude, accuracy, heading, speed_kmh, recorded_at, session_id';

/** Fetch the current presence row for a trip (primary tracking seed). */
export async function getDriverPresenceForTrip(
  tripId: string,
): Promise<{ presence: DriverPresenceRow | null; error: Error | null }> {
  const { data, error } = await supabase()
    .from('driver_presence')
    .select(SELECT_COLUMNS)
    .eq('trip_id', tripId)
    .maybeSingle();

  if (error) return { presence: null, error: new Error(error.message) };
  return { presence: (data as DriverPresenceRow | null), error: null };
}

/** Fetch presence by driver id (fallback when trip_id is not yet linked). */
export async function getDriverPresenceByDriverId(
  driverId: string,
): Promise<{ presence: DriverPresenceRow | null; error: Error | null }> {
  const { data, error } = await supabase()
    .from('driver_presence')
    .select(SELECT_COLUMNS)
    .eq('driver_id', driverId)
    .maybeSingle();

  if (error) return { presence: null, error: new Error(error.message) };
  return { presence: (data as DriverPresenceRow | null), error: null };
}

/**
 * Batch variant for fleet-wide views — one query for N trips instead of N,
 * grouped client-side by trip_id.
 */
export async function getDriverPresenceForTrips(
  tripIds: string[],
): Promise<{ presenceByTripId: Map<string, DriverPresenceRow>; error: Error | null }> {
  if (tripIds.length === 0) return { presenceByTripId: new Map(), error: null };
  const { data, error } = await supabase()
    .from('driver_presence')
    .select(SELECT_COLUMNS)
    .in('trip_id', tripIds);

  if (error) return { presenceByTripId: new Map(), error: new Error(error.message) };

  const presenceByTripId = new Map<string, DriverPresenceRow>();
  for (const row of (data ?? []) as DriverPresenceRow[]) {
    if (row.trip_id) presenceByTripId.set(row.trip_id, row);
  }
  return { presenceByTripId, error: null };
}
