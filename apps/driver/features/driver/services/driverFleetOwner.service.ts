/**
 * Driver Fleet Owner capability — explicit owner profile (not employment).
 * @see docs/DRIVER_FLEET_OWNER_PHASE1.md
 */
import { supabase } from '@pulse/core/lib/supabase';

export type FleetOwnerPreferredView = 'driver' | 'fleet_owner';

export type DriverFleetOwnerProfile = {
  userId: string;
  enabledAt: string;
  preferredView: FleetOwnerPreferredView;
};

type DbRow = {
  user_id: string;
  enabled_at: string;
  preferred_view: string;
};

function mapRow(row: DbRow): DriverFleetOwnerProfile {
  return {
    userId: row.user_id,
    enabledAt: row.enabled_at,
    preferredView:
      row.preferred_view === 'fleet_owner' ? 'fleet_owner' : 'driver',
  };
}

/** Load Fleet Owner profile for the signed-in user (null if not enabled). */
export async function getDriverFleetOwnerProfile(
  userId: string,
): Promise<{ error: Error | null; profile: DriverFleetOwnerProfile | null }> {
  if (!userId) {
    return { error: null, profile: null };
  }
  const { data, error } = await supabase()
    .from('driver_fleet_owner_profiles')
    .select('user_id, enabled_at, preferred_view')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return { error: new Error(error.message), profile: null };
  }
  if (!data) return { error: null, profile: null };
  return { error: null, profile: mapRow(data as DbRow) };
}

/** Idempotent: enable Fleet Owner for the current driver (RPC). */
export async function enableDriverFleetOwner(): Promise<{
  error: Error | null;
  profile: DriverFleetOwnerProfile | null;
}> {
  const { data, error } = await supabase().rpc('enable_driver_fleet_owner');
  if (error) {
    return { error: new Error(error.message), profile: null };
  }
  if (!data) {
    return { error: new Error('No fleet owner profile returned'), profile: null };
  }
  return { error: null, profile: mapRow(data as DbRow) };
}
