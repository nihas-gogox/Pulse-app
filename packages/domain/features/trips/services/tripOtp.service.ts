/**
 * Trip OTP service — generate, regenerate, claim by OTP, get for display.
 * Used for aggregate trips: driver claims with OTP then links phone for tracking.
 * All operations O(1) via indexed RPCs.
 */
import { supabase } from '@pulse/core/lib/supabase';
import type { TripRow } from './trips.service';

/** Default TTL minutes (configurable via EXPO_PUBLIC_TRIP_OTP_TTL_MINUTES). */
export const TRIP_OTP_TTL_MINUTES = typeof process.env.EXPO_PUBLIC_TRIP_OTP_TTL_MINUTES !== 'undefined'
  ? Math.max(1, Math.min(1440, Number(process.env.EXPO_PUBLIC_TRIP_OTP_TTL_MINUTES) || 15))
  : 15;

/** Max failed attempts before "ask for new OTP" (configurable via EXPO_PUBLIC_TRIP_OTP_MAX_ATTEMPTS). */
export const TRIP_OTP_MAX_ATTEMPTS = typeof process.env.EXPO_PUBLIC_TRIP_OTP_MAX_ATTEMPTS !== 'undefined'
  ? Math.max(1, Math.min(20, Number(process.env.EXPO_PUBLIC_TRIP_OTP_MAX_ATTEMPTS) || 5))
  : 5;

export interface TripOtpResult {
  code: string;
  expires_at: string;
}

export interface ClaimTripByOtpResult {
  ok: boolean;
  trip_id?: string;
  organization_id?: string;
  driver_id?: string;
  error?: string;
}

/**
 * Pending aggregate trip that is pre-assigned by phone and waiting for OTP claim.
 * Shape matches trips rows so driver UI can render it like any other trip card.
 */
export interface PendingOtpTripRow extends TripRow {
  /** Marker so callers know this came from the pending-OTP RPC. */
  requires_otp?: boolean | null;
}

/**
 * Generate OTP for an aggregate trip. Upsert by trip_id; regeneration overwrites. O(1).
 * Call after trip create when supplier_id is set.
 */
export async function generateTripOtp(
  tripId: string,
  ttlMinutes?: number
): Promise<{ error: Error | null; code: string | null; expires_at: string | null }> {
  const ttl = ttlMinutes ?? TRIP_OTP_TTL_MINUTES;
  const { data, error } = await supabase().rpc('generate_trip_otp', {
    p_trip_id: tripId,
    p_ttl_minutes: Math.max(1, Math.min(1440, ttl)),
  });
  if (error) return { error: new Error(error.message), code: null, expires_at: null };
  const rows = (data ?? []) as TripOtpResult[];
  const row = rows[0];
  if (!row) return { error: new Error('No OTP returned'), code: null, expires_at: null };
  return { error: null, code: row.code, expires_at: row.expires_at };
}

/**
 * Regenerate OTP for a trip; old code is invalidated. O(1).
 */
export async function regenerateTripOtp(
  tripId: string,
  ttlMinutes?: number
): Promise<{ error: Error | null; code: string | null; expires_at: string | null }> {
  const ttl = ttlMinutes ?? TRIP_OTP_TTL_MINUTES;
  const { data, error } = await supabase().rpc('regenerate_trip_otp', {
    p_trip_id: tripId,
    p_ttl_minutes: Math.max(1, Math.min(1440, ttl)),
  });
  if (error) return { error: new Error(error.message), code: null, expires_at: null };
  const rows = (data ?? []) as TripOtpResult[];
  const row = rows[0];
  if (!row) return { error: new Error('No OTP returned'), code: null, expires_at: null };
  return { error: null, code: row.code, expires_at: row.expires_at };
}

/**
 * Get current valid OTP for a trip (for display). Returns null if used or expired. O(1).
 */
export async function getTripOtpForDisplay(
  tripId: string
): Promise<{ error: Error | null; code: string | null; expires_at: string | null }> {
  const { data, error } = await supabase().rpc('get_trip_otp', { p_trip_id: tripId });
  if (error) return { error: new Error(error.message), code: null, expires_at: null };
  const rows = (data ?? []) as TripOtpResult[];
  const row = rows[0];
  if (!row) return { error: null, code: null, expires_at: null };
  return { error: null, code: row.code, expires_at: row.expires_at };
}

/**
 * Claim trip by OTP. Validates, marks used, finds/creates driver for auth.uid(), sets trip.driver_id. O(1), race-safe.
 * Edge cases: expired/used/max attempts -> generic error; trip already claimed -> explicit error.
 */
export async function claimTripByOtp(
  code: string,
  maxAttempts?: number
): Promise<{ error: Error | null; result: ClaimTripByOtpResult | null }> {
  const max = maxAttempts ?? TRIP_OTP_MAX_ATTEMPTS;
  const { data, error } = await supabase().rpc('claim_trip_by_otp', {
    p_code: (code ?? '').trim(),
    p_max_attempts: Math.max(1, Math.min(20, max)),
  });
  if (error) return { error: new Error(error.message), result: null };
  const obj = data as ClaimTripByOtpResult | null;
  if (!obj) return { error: new Error('No response'), result: null };
  return { error: null, result: obj };
}

/**
 * Count of trips pre-assigned to current user's phone (driver for tracking) waiting for OTP claim.
 * Driver app uses this to show "You have N trip(s) waiting — enter OTP to claim".
 */
export async function getPendingOtpClaimCount(): Promise<{ error: Error | null; count: number }> {
  const { data, error } = await supabase().rpc('get_pending_otp_claim_count');
  if (error) return { error: new Error(error.message), count: 0 };
  const obj = data as { count?: number } | null;
  const rawCount = typeof obj?.count === 'number' ? obj.count : 0;
  const count = rawCount > 0 ? 1 : 0;
  return { error: null, count };
}

/**
 * List of trips pre-assigned to the current user's phone (tracking-only driver) that
 * are waiting for OTP claim. Backed by RPC get_pending_otp_trips (defined in pulse-unified-base).
 * O(n) over that driver's pending aggregate trips; typically very small.
 */
export async function getPendingOtpTrips(): Promise<{
  error: Error | null;
  trips: PendingOtpTripRow[];
}> {
  const { data, error } = await supabase().rpc('get_pending_otp_trips');
  if (error) return { error: new Error(error.message), trips: [] };
  const rows = (data ?? []) as PendingOtpTripRow[];
  // Ensure marker flag is set for all rows so UI can branch on it if needed.
  const trips = rows.map((row) => ({ ...row, requires_otp: row.requires_otp ?? true }));
  return { error: null, trips };
}
