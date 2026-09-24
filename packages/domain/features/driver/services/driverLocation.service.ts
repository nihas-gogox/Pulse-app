/**
 * Driver location reporting — append-only history for live trip tracking.
 * Table: driver_locations (driver_id, trip_id, organization_id, latitude, longitude, accuracy, source).
 * Used when driver is on trip: periodic (3 minutes) and on tap of location badge.
 */
import { supabase } from '@pulse/core/lib/supabase';

export type DriverLocationSource = 'live' | 'tap' | 'background' | 'simulated';

export interface ReportDriverLocationParams {
  driverId: string;
  organizationId: string;
  tripId: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  source: DriverLocationSource;
  /** Hubometer (km) when available from the vehicle / driver input. */
  odometerKm?: number | null;
  /** Explicit capture time (defaults to DB `now()`). */
  recordedAt?: string | null;
  /** Reverse-geocoded city/area for chat copy (no map tiles). */
  addressLabel?: string | null;
  /** Loaded `drivers.user_id` — must match the live session. No extra DB lookup. */
  ownerUserId?: string | null;
}

export interface ReportDriverLocationResult {
  error: Error | null;
  skipped?: boolean;
}

export function shouldPersistDriverLocation(opts: {
  sessionUserId: string | null | undefined;
  ownerUserId: string | null | undefined;
}): boolean {
  const session = (opts.sessionUserId ?? '').trim();
  const owner = (opts.ownerUserId ?? '').trim();
  return session.length > 0 && owner.length > 0 && session === owner;
}

/** Result shape for latest location (read by dispatcher/fleet in Live Tracking). */
export interface DriverLocationRow {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recorded_at: string;
}

/**
 * Insert one location row. RLS: driver can only insert for their own driver_id (user_id = auth.uid()).
 */
export async function reportDriverLocation(
  params: ReportDriverLocationParams
): Promise<ReportDriverLocationResult> {
  const {
    driverId,
    organizationId,
    tripId,
    latitude,
    longitude,
    accuracy,
    source,
    odometerKm,
    recordedAt,
    ownerUserId,
  } = params;
  const { data: sessionData } = await supabase().auth.getSession();
  const sessionUserId = sessionData.session?.user?.id ?? null;
  if (!shouldPersistDriverLocation({ sessionUserId, ownerUserId })) {
    return { error: null, skipped: true };
  }
  // Chat trigger uses address_label; without it the DB falls back to trip
  // pickup/drop (e.g. Maharashtra on a MH→DL route while the phone is in Chennai).
  let addressLabel =
    typeof params.addressLabel === 'string' ? params.addressLabel.trim() : '';
  if (!addressLabel && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    try {
      const { reverseGeocodeCityStateLabel } = await import(
        '../../../lib/reverseGeocodePlace.util'
      );
      const geo = await reverseGeocodeCityStateLabel(latitude, longitude);
      if (geo?.trim()) addressLabel = geo.trim();
    } catch {
      // best-effort — insert still proceeds with coords
    }
  }
  const row: Record<string, unknown> = {
    driver_id: driverId,
    organization_id: organizationId,
    trip_id: tripId,
    latitude,
    longitude,
    accuracy: accuracy ?? null,
    source,
  };
  if (odometerKm != null && Number.isFinite(odometerKm)) {
    row.odometer_km = odometerKm;
  }
  if (typeof recordedAt === 'string' && recordedAt.trim() !== '') {
    row.recorded_at = recordedAt.trim();
  }
  if (addressLabel) {
    row.address_label = addressLabel;
  }
  const { error } = await supabase().from('driver_locations').insert(row);
  if (error) {
    if (__DEV__) {
      console.warn('[driver_locations] save failed', {
        driverId,
        tripId,
        source,
        error: error.message,
      });
    }
    return { error: new Error(error.message) };
  }
  if (__DEV__) {
    console.log('[driver_locations] saved', {
      driverId,
      organizationId,
      tripId,
      source,
      latitude,
      longitude,
      accuracy: accuracy ?? null,
    });
  }
  return { error: null };
}

/**
 * Fetch latest driver location for a trip. Uses RPC (SECURITY DEFINER) so org members
 * get the row even when RLS on driver_locations blocks direct SELECT. Falls back to
 * direct table select if RPC is not available.
 */
export async function getLatestDriverLocationForTrip(
  tripId: string
): Promise<{ error: Error | null; location: DriverLocationRow | null }> {
  const { data, error } = await supabase().rpc('get_latest_driver_location_for_trip', {
    p_trip_id: tripId,
  });
  if (!error && data != null && typeof data === 'object' && 'latitude' in data) {
    const row = data as { latitude: number; longitude: number; accuracy?: number | null; recorded_at: string };
    return {
      error: null,
      location: {
        latitude: row.latitude,
        longitude: row.longitude,
        accuracy: row.accuracy ?? null,
        recorded_at: row.recorded_at,
      },
    };
  }
  if (!error) return { error: null, location: null };
  if (error) {
    const { data: tableData, error: tableError } = await supabase()
      .from('driver_locations')
      .select('latitude, longitude, accuracy, recorded_at')
      .eq('trip_id', tripId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tableError) return { error: new Error(tableError.message), location: null };
    return { error: null, location: tableData as DriverLocationRow | null };
  }
  return { error: null, location: null };
}

/**
 * Fetch location history for a trip. Uses RPC (SECURITY DEFINER) so org members get rows.
 * Falls back to direct table select if RPC is not available.
 */
export interface TripAppLocationPoint {
  latitude: number;
  longitude: number;
  recorded_at: string;
  address_label: string | null;
  source: string | null;
}

/**
 * App GPS pings for a trip timeline. Prefers rows tied to the trip, then the
 * driver's own pings in the trip window when trip_id was not set.
 */
export async function getTripAppLocationsForTimeline(
  tripId: string,
  driverId: string | null | undefined,
  windowStartIso: string | null | undefined,
  windowEndIso: string | null | undefined,
): Promise<{ error: Error | null; points: TripAppLocationPoint[] }> {
  const { data, error } = await supabase()
    .from('driver_locations')
    .select('latitude, longitude, recorded_at, address_label, source')
    .eq('trip_id', tripId)
    .order('recorded_at', { ascending: true })
    .limit(200);

  if (!error && (data?.length ?? 0) > 0) {
    return { error: null, points: data as TripAppLocationPoint[] };
  }

  if (!driverId) {
    return { error: error ? new Error(error.message) : null, points: [] };
  }

  let query = supabase()
    .from('driver_locations')
    .select('latitude, longitude, recorded_at, address_label, source')
    .eq('driver_id', driverId)
    .order('recorded_at', { ascending: true })
    .limit(200);

  if (windowStartIso) {
    const start = new Date(new Date(windowStartIso).getTime() - 15 * 60 * 1000).toISOString();
    query = query.gte('recorded_at', start);
  }
  if (windowEndIso) {
    const end = new Date(new Date(windowEndIso).getTime() + 15 * 60 * 1000).toISOString();
    query = query.lte('recorded_at', end);
  }

  const { data: driverRows, error: driverError } = await query;
  if (driverError) return { error: new Error(driverError.message), points: [] };
  return { error: null, points: (driverRows ?? []) as TripAppLocationPoint[] };
}

export async function getTripLocationHistory(
  tripId: string,
  limit = 100
): Promise<{ error: Error | null; points: { latitude: number; longitude: number; recorded_at: string }[] }> {
  const { data, error } = await supabase().rpc('get_driver_location_history_for_trip', {
    p_trip_id: tripId,
    p_limit: limit,
  });
  if (!error && Array.isArray(data)) {
    const points = data.map((row: { latitude: number; longitude: number; recorded_at: string }) => ({
      latitude: row.latitude,
      longitude: row.longitude,
      recorded_at: row.recorded_at,
    }));
    return { error: null, points };
  }
  if (error) {
    const { data: tableData, error: tableError } = await supabase()
      .from('driver_locations')
      .select('latitude, longitude, recorded_at')
      .eq('trip_id', tripId)
      .order('recorded_at', { ascending: true })
      .limit(limit);
    if (tableError) return { error: new Error(tableError.message), points: [] };
    const points = (tableData ?? []) as { latitude: number; longitude: number; recorded_at: string }[];
    return { error: null, points };
  }
  return { error: null, points: [] };
}

/**
 * Fetch latest driver location for a trip, with a safe fallback to driver_id
 * in case trip_id was not set on driver_locations rows.
 */
export async function getLatestDriverLocationForTripOrDriver(
  tripId: string | null,
  driverId: string | null | undefined
): Promise<{ error: Error | null; location: DriverLocationRow | null }> {
  if (!tripId && !driverId) return { error: null, location: null };

  if (tripId) {
    const byTrip = await getLatestDriverLocationForTrip(tripId);
    if (!byTrip.error && byTrip.location) return byTrip;
    if (!driverId || byTrip.error) {
      if (!driverId) return byTrip;
    }
  }

  if (!driverId) return { error: null, location: null };

  const { data, error } = await supabase()
    .from('driver_locations')
    .select('latitude, longitude, accuracy, recorded_at')
    .eq('driver_id', driverId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { error: new Error(error.message), location: null };
  return { error: null, location: data as DriverLocationRow | null };
}

/**
 * Fetch the most recent N location pings for a trip (newest first). Dev use: last-3 trail.
 * Requires "Drivers read own locations" RLS policy on driver_locations.
 * For all trip stakeholders (owner + client + supplier) use getLastNLocationsForTripViaRpc.
 */
export async function getLastNLocationsForTrip(
  tripId: string,
  n = 3,
): Promise<{ error: Error | null; points: { latitude: number; longitude: number; recorded_at: string }[] }> {
  const { data, error } = await supabase()
    .from('driver_locations')
    .select('latitude, longitude, recorded_at')
    .eq('trip_id', tripId)
    .order('recorded_at', { ascending: false })
    .limit(n);

  if (error) return { error: new Error(error.message), points: [] };
  return { error: null, points: (data ?? []) as { latitude: number; longitude: number; recorded_at: string }[] };
}

/**
 * Partner-safe: last N location pings via SECURITY DEFINER RPC.
 * Works for fleet org, client org, and supplier org members.
 * Points are returned newest-first by the DB; caller receives them in that order.
 */
export async function getLastNLocationsForTripViaRpc(
  tripId: string,
  n = 3,
): Promise<{ error: Error | null; points: { latitude: number; longitude: number; recorded_at: string }[] }> {
  const { data, error } = await supabase().rpc('get_last_n_locations_for_trip', {
    p_trip_id: tripId,
    p_n: n,
  });
  if (error) {
    console.warn('[tracking] get_last_n_locations_for_trip RPC error', { tripId, n, error: error.message });
    return { error: new Error(error.message), points: [] };
  }
  const points = (Array.isArray(data) ? data : []) as { latitude: number; longitude: number; recorded_at: string }[];
  console.log('[tracking] getLastNLocationsForTripViaRpc', { tripId, n, returned: points.length });
  return { error: null, points };
}

/**
 * Fetch location history for a driver (fallback when trip_id is null on rows).
 */
export async function getDriverLocationHistoryByDriverId(
  driverId: string,
  limit = 100
): Promise<{ error: Error | null; points: { latitude: number; longitude: number; recorded_at: string }[] }> {
  const { data, error } = await supabase()
    .from('driver_locations')
    .select('latitude, longitude, recorded_at')
    .eq('driver_id', driverId)
    .order('recorded_at', { ascending: true })
    .limit(limit);

  if (error) return { error: new Error(error.message), points: [] };
  const points = (data ?? []) as { latitude: number; longitude: number; recorded_at: string }[];
  return { error: null, points };
}
