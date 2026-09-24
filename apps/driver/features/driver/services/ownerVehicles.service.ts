/**
 * Fleet Owner personal vehicles — owner_user_id ownership (not org).
 * @see docs/DRIVER_FLEET_OWNER_PHASE1.md
 */
import { supabase } from '@pulse/core/lib/supabase';

export type OwnerVehicleStatus = 'active' | 'inactive' | 'maintenance';

export type OwnerVehicleRow = {
  id: string;
  owner_user_id: string;
  vehicle_number: string;
  vehicle_type: string | null;
  capacity: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_body_type: string | null;
  vehicle_size: string | null;
  vehicle_axle: string | null;
  fuel_type: string | null;
  status: OwnerVehicleStatus;
  documents: Record<string, unknown>;
  avatar_url: string | null;
  avatar_seed: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OwnerVehicleInsert = {
  vehicle_number: string;
  vehicle_type?: string | null;
  capacity?: string | null;
  vehicle_brand?: string | null;
  vehicle_model?: string | null;
  vehicle_body_type?: string | null;
  vehicle_size?: string | null;
  vehicle_axle?: string | null;
  fuel_type?: string | null;
  status?: OwnerVehicleStatus;
};

function trimOrNull(v: string | null | undefined): string | null {
  const t = (v ?? '').trim();
  return t.length > 0 ? t : null;
}

export async function listOwnerVehicles(
  ownerUserId: string,
): Promise<{ error: Error | null; vehicles: OwnerVehicleRow[] }> {
  if (!ownerUserId) return { error: null, vehicles: [] };
  const { data, error } = await supabase()
    .from('owner_vehicles')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) return { error: new Error(error.message), vehicles: [] };
  return { error: null, vehicles: (data ?? []) as OwnerVehicleRow[] };
}

export async function getOwnerVehicleById(
  ownerUserId: string,
  vehicleId: string,
): Promise<{ error: Error | null; vehicle: OwnerVehicleRow | null }> {
  const { data, error } = await supabase()
    .from('owner_vehicles')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .eq('id', vehicleId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) return { error: new Error(error.message), vehicle: null };
  return { error: null, vehicle: (data as OwnerVehicleRow | null) ?? null };
}

export async function createOwnerVehicle(
  ownerUserId: string,
  payload: OwnerVehicleInsert,
): Promise<{ error: Error | null; vehicle: OwnerVehicleRow | null }> {
  const vehicleNumber = (payload.vehicle_number ?? '').trim().toUpperCase();
  const { data, error } = await supabase()
    .from('owner_vehicles')
    .insert({
      owner_user_id: ownerUserId,
      vehicle_number: vehicleNumber,
      vehicle_type: trimOrNull(payload.vehicle_type),
      capacity: trimOrNull(payload.capacity),
      vehicle_brand: trimOrNull(payload.vehicle_brand),
      vehicle_model: trimOrNull(payload.vehicle_model),
      vehicle_body_type: trimOrNull(payload.vehicle_body_type),
      vehicle_size: trimOrNull(payload.vehicle_size),
      vehicle_axle: trimOrNull(payload.vehicle_axle),
      fuel_type: trimOrNull(payload.fuel_type),
      status: payload.status ?? 'active',
      documents: {},
    } as Record<string, unknown>)
    .select()
    .single();
  if (error) {
    const message =
      error.message?.includes('idx_owner_vehicles_owner_number_active') ||
      error.message?.includes('duplicate key')
        ? 'You already have a vehicle with this registration number.'
        : error.message;
    return { error: new Error(message), vehicle: null };
  }
  return { error: null, vehicle: data as OwnerVehicleRow };
}

export async function softDeleteOwnerVehicle(
  ownerUserId: string,
  vehicleId: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase()
    .from('owner_vehicles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('owner_user_id', ownerUserId)
    .eq('id', vehicleId)
    .is('deleted_at', null);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/**
 * Explicitly set or clear a trip's owner_vehicle_id via set_trip_owner_vehicle().
 * Caller must be the trip's assigned driver; setting (non-null) also requires
 * the vehicle to belong to the caller, be non-deleted, and active. Passing
 * `ownerVehicleId: null` explicitly clears any existing value — there is no
 * separate clear endpoint (mirrors updateTripAssignment's own vehicle_id
 * convention). Never auto-selects a vehicle on the caller's behalf.
 */
export async function setTripOwnerVehicle(
  tripId: string,
  ownerVehicleId: string | null,
): Promise<{ error: Error | null; ownerVehicleId: string | null }> {
  const { data, error } = await supabase().rpc('set_trip_owner_vehicle', {
    p_trip_id: tripId,
    p_owner_vehicle_id: ownerVehicleId,
  });
  if (error) return { error: new Error(error.message), ownerVehicleId: null };
  const result = data as { owner_vehicle_id?: string | null } | null;
  return { error: null, ownerVehicleId: result?.owner_vehicle_id ?? null };
}

export function ownerVehicleTitle(v: Pick<OwnerVehicleRow, 'vehicle_number'>): string {
  return (v.vehicle_number ?? '').trim() || 'Vehicle';
}

export function ownerVehicleSubtitle(
  v: Pick<
    OwnerVehicleRow,
    'vehicle_brand' | 'vehicle_model' | 'capacity' | 'vehicle_type'
  >,
): string {
  const makeModel = [v.vehicle_brand, v.vehicle_model].filter(Boolean).join(' ');
  const bits = [makeModel || v.vehicle_type, v.capacity].filter(Boolean);
  return bits.join(' · ') || 'Owner vehicle';
}
