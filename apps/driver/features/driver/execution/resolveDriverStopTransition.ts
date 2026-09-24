import type {
  DriverSesJoinRow,
  DriverStopExecutionBundle,
  DriverStopExecutionStop,
} from './driverStopExecution.types';
import { normalizeDriverStopExecution } from './normalizeDriverStopExecution';

export type DriverStopTransition = 'arrive' | 'complete';

export function expectedStatusForTransition(
  transition: DriverStopTransition,
): 'pending' | 'arrived' {
  return transition === 'arrive' ? 'pending' : 'arrived';
}

export function targetStatusForTransition(
  transition: DriverStopTransition,
): 'arrived' | 'completed' {
  return transition === 'arrive' ? 'arrived' : 'completed';
}

/** Only execution fields. Never planning columns, sequence, or driver_id. */
export function buildDriverStopTransitionPatch(
  transition: DriverStopTransition,
  nowIso: string,
): { status: 'arrived'; arrived_at: string } | { status: 'completed'; completed_at: string } {
  if (transition === 'arrive') {
    return { status: 'arrived', arrived_at: nowIso };
  }
  return { status: 'completed', completed_at: nowIso };
}

export function canShowArriveAction(
  stop: DriverStopExecutionStop,
  currentStopId: string | null,
): boolean {
  return stop.stopId === currentStopId && stop.status === 'pending';
}

export function canShowCompleteAction(
  stop: DriverStopExecutionStop,
  currentStopId: string | null,
): boolean {
  return stop.stopId === currentStopId && stop.status === 'arrived';
}

export function shouldApplyDriverStopMutationResult(
  request: { tripId: string; stopId: string },
  activeTripId: string | null | undefined,
): boolean {
  return !!activeTripId && request.tripId === activeTripId && !!request.stopId;
}

export type ResolvedStopTransition =
  | { kind: 'applied'; row: DriverSesJoinRow }
  | { kind: 'idempotent'; row: DriverSesJoinRow }
  | { kind: 'stale'; row: DriverSesJoinRow | null; error: Error };

/**
 * Conditional write returned 0 rows → use authoritative SES row.
 * Already at target = idempotent (do not reset timestamps).
 * Wrong status = stale / illegal transition (do not fabricate success).
 */
export function resolveConditionalStopTransition(args: {
  transition: DriverStopTransition;
  affected: DriverSesJoinRow | null;
  authoritative: DriverSesJoinRow | null;
}): ResolvedStopTransition {
  const target = targetStatusForTransition(args.transition);
  if (args.affected?.status === target) {
    return { kind: 'applied', row: args.affected };
  }

  const auth = args.authoritative;
  if (auth?.status === target) {
    return { kind: 'idempotent', row: auth };
  }

  if (args.transition === 'arrive' && auth?.status === 'completed') {
    return {
      kind: 'stale',
      row: auth,
      error: new Error('Stop is already completed'),
    };
  }
  if (args.transition === 'complete' && auth?.status === 'pending') {
    return {
      kind: 'stale',
      row: auth,
      error: new Error('Arrive at this stop before completing it'),
    };
  }

  return {
    kind: 'stale',
    row: auth,
    error: new Error('Stop state changed. Refreshing.'),
  };
}

/** Merge one SES row's execution fields into the hydrated bundle. Planning fields stay. */
export function mergeStopExecutionRowIntoBundle(
  bundle: DriverStopExecutionBundle,
  row: DriverSesJoinRow,
): DriverStopExecutionBundle {
  if (row.trip_id && row.trip_id !== bundle.tripId) return bundle;

  const next = normalizeDriverStopExecution(bundle.tripId, [row]);
  const updated = next.stops[0];
  if (!updated) return bundle;

  const hasStop = bundle.stops.some((s) => s.stopId === updated.stopId);
  if (!hasStop) {
    return {
      tripId: bundle.tripId,
      stops: [...bundle.stops, updated].sort((a, b) => a.sequence - b.sequence),
    };
  }

  return {
    tripId: bundle.tripId,
    stops: bundle.stops.map((s) =>
      s.stopId === updated.stopId
        ? {
            ...s,
            status: updated.status,
            arrivedAt: updated.arrivedAt,
            completedAt: updated.completedAt,
            skipReason: updated.skipReason,
            failureReason: updated.failureReason,
          }
        : s,
    ),
  };
}
