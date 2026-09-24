import { supabase } from '@pulse/core/lib/supabase';
import type { DriverSesJoinRow } from './driverStopExecution.types';
import {
  emptyDriverStopExecution,
  normalizeDriverStopExecution,
} from './normalizeDriverStopExecution';
import type { DriverStopExecutionBundle } from './driverStopExecution.types';

/**
 * trip.id → stop_execution_state.trip_id → stop_id → execution_plan_stops.id
 * Do not join indents. Do not require trips.execution_plan_id.
 */
export const SES_STOPS_SELECT = `
  trip_id,
  stop_id,
  sequence,
  status,
  driver_id,
  arrived_at,
  completed_at,
  skip_reason,
  failure_reason,
  execution_plan_stops!stop_execution_state_stop_id_fkey (
    id,
    stop_type,
    display_name,
    label,
    address_line,
    city,
    state,
    pincode,
    latitude,
    longitude,
    contact_name,
    contact_phone,
    pod_required
  )
`.trim();

export type FetchDriverStopExecutionResult =
  | { ok: true; bundle: DriverStopExecutionBundle }
  | { ok: false; bundle: DriverStopExecutionBundle; error: Error };

export async function fetchDriverStopExecution(
  tripId: string,
): Promise<FetchDriverStopExecutionResult> {
  const empty = emptyDriverStopExecution(tripId);
  if (!tripId) return { ok: true, bundle: empty };

  const { data, error } = await supabase()
    .from('stop_execution_state')
    .select(SES_STOPS_SELECT)
    .eq('trip_id', tripId);

  if (error) {
    return {
      ok: false,
      bundle: empty,
      error: new Error(error.message),
    };
  }

  return {
    ok: true,
    bundle: normalizeDriverStopExecution(tripId, (data ?? []) as DriverSesJoinRow[]),
  };
}
