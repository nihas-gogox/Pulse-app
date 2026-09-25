import { supabase } from '@pulse/core/lib/supabase';
import type { DriverSesJoinRow } from './driverStopExecution.types';
import type { DriverStopExecutionBundle } from './driverStopExecution.types';
import { fetchDriverStopExecution, SES_STOPS_SELECT } from './fetchDriverStopExecution';
import {
  buildDriverStopTransitionPatch,
  expectedStatusForTransition,
  resolveConditionalStopTransition,
  type DriverStopTransition,
} from './resolveDriverStopTransition';

export type TransitionDriverStopResult =
  | {
      ok: true;
      kind: 'applied' | 'idempotent';
      row: DriverSesJoinRow;
      refetchedBundle: DriverStopExecutionBundle | null;
    }
  | {
      ok: false;
      error: Error;
      refetchedBundle: DriverStopExecutionBundle | null;
    };

/**
 * Conditional SES update. Authorization is RLS
 * (trips.driver_id → drivers.user_id = auth.uid()).
 * Never writes driver_id, sequence, or planning columns.
 * Never touches trips.status.
 */
export async function transitionDriverStopExecution(input: {
  tripId: string;
  stopId: string;
  transition: DriverStopTransition;
  nowIso?: string;
}): Promise<TransitionDriverStopResult> {
  const { tripId, stopId, transition } = input;
  if (!tripId || !stopId) {
    return { ok: false, error: new Error('Missing trip or stop'), refetchedBundle: null };
  }

  const expected = expectedStatusForTransition(transition);
  const patch = buildDriverStopTransitionPatch(
    transition,
    input.nowIso ?? new Date().toISOString(),
  );

  const { data, error } = await supabase()
    .from('stop_execution_state')
    .update(patch)
    .eq('trip_id', tripId)
    .eq('stop_id', stopId)
    .eq('status', expected)
    .select(SES_STOPS_SELECT)
    .maybeSingle();

  if (error) {
    return { ok: false, error: new Error(error.message), refetchedBundle: null };
  }

  const affected = (data ?? null) as DriverSesJoinRow | null;
  if (affected?.status) {
    const resolved = resolveConditionalStopTransition({
      transition,
      affected,
      authoritative: affected,
    });
    if (resolved.kind === 'applied' || resolved.kind === 'idempotent') {
      return { ok: true, kind: resolved.kind, row: resolved.row, refetchedBundle: null };
    }
  }

  const refetch = await fetchDriverStopExecution(tripId);
  if (!refetch.ok) {
    return { ok: false, error: refetch.error, refetchedBundle: null };
  }

  const authoritative: DriverSesJoinRow | null =
    refetch.bundle.stops
      .map((stop) => ({
        trip_id: tripId,
        stop_id: stop.stopId,
        sequence: stop.sequence,
        status: stop.status,
        driver_id: stop.driverId,
        arrived_at: stop.arrivedAt,
        completed_at: stop.completedAt,
        skip_reason: stop.skipReason,
        failure_reason: stop.failureReason,
      }))
      .find((row) => row.stop_id === stopId) ?? null;

  const resolved = resolveConditionalStopTransition({
    transition,
    affected: null,
    authoritative,
  });

  if (resolved.kind === 'applied' || resolved.kind === 'idempotent') {
    return {
      ok: true,
      kind: resolved.kind,
      row: resolved.row,
      refetchedBundle: refetch.bundle,
    };
  }

  return {
    ok: false,
    error: resolved.error,
    refetchedBundle: refetch.bundle,
  };
}
