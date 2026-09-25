import type { DriverSesJoinRow } from '../driverStopExecution.types';
import {
  deriveCurrentStop,
  emptyDriverStopExecution,
  normalizeDriverStopExecution,
  shouldShowDriverMultiStop,
} from '../normalizeDriverStopExecution';
import {
  buildDriverStopTransitionPatch,
  canShowArriveAction,
  canShowCompleteAction,
  mergeStopExecutionRowIntoBundle,
  resolveConditionalStopTransition,
  shouldApplyDriverStopMutationResult,
} from '../resolveDriverStopTransition';

function plan(id: string) {
  return {
    id,
    stop_type: 'pickup',
    display_name: `Name ${id}`,
    address_line: `${id} rd`,
    city: 'Pune',
    state: 'MH',
    pincode: '411001',
    latitude: 1,
    longitude: 2,
    contact_name: 'Ada',
    contact_phone: '1',
    pod_required: false,
  };
}

function row(
  tripId: string,
  stopId: string,
  sequence: number,
  status: string,
  extras: Partial<DriverSesJoinRow> = {},
): DriverSesJoinRow {
  return {
    trip_id: tripId,
    stop_id: stopId,
    sequence,
    status,
    driver_id: 'drv-1',
    arrived_at: extras.arrived_at ?? null,
    completed_at: extras.completed_at ?? null,
    skip_reason: null,
    failure_reason: null,
    execution_plan_stops: plan(stopId),
    ...extras,
  };
}

describe('buildDriverStopTransitionPatch', () => {
  it('arrive only sets status + arrived_at', () => {
    const patch = buildDriverStopTransitionPatch('arrive', '2026-09-13T10:00:00.000Z');
    expect(patch).toEqual({ status: 'arrived', arrived_at: '2026-09-13T10:00:00.000Z' });
    expect(patch).not.toHaveProperty('driver_id');
    expect(patch).not.toHaveProperty('sequence');
    expect(patch).not.toHaveProperty('display_name');
    expect(patch).not.toHaveProperty('completed_at');
  });

  it('complete only sets status + completed_at', () => {
    const patch = buildDriverStopTransitionPatch('complete', '2026-09-13T10:05:00.000Z');
    expect(patch).toEqual({ status: 'completed', completed_at: '2026-09-13T10:05:00.000Z' });
    expect(patch).not.toHaveProperty('arrived_at');
    expect(patch).not.toHaveProperty('driver_id');
  });
});

describe('resolveConditionalStopTransition', () => {
  it('A. pending → arrived applies with arrived_at', () => {
    const affected = row('t1', 's1', 1, 'arrived', { arrived_at: '2026-09-13T10:00:00.000Z' });
    const resolved = resolveConditionalStopTransition({
      transition: 'arrive',
      affected,
      authoritative: affected,
    });
    expect(resolved.kind).toBe('applied');
    if (resolved.kind === 'applied') {
      expect(resolved.row.status).toBe('arrived');
      expect(resolved.row.arrived_at).toBe('2026-09-13T10:00:00.000Z');
    }
  });

  it('B. arrived → completed applies and preserves arrived_at', () => {
    const affected = row('t1', 's1', 1, 'completed', {
      arrived_at: '2026-09-13T10:00:00.000Z',
      completed_at: '2026-09-13T10:05:00.000Z',
    });
    const resolved = resolveConditionalStopTransition({
      transition: 'complete',
      affected,
      authoritative: affected,
    });
    expect(resolved.kind).toBe('applied');
    if (resolved.kind === 'applied') {
      expect(resolved.row.status).toBe('completed');
      expect(resolved.row.completed_at).toBe('2026-09-13T10:05:00.000Z');
      expect(resolved.row.arrived_at).toBe('2026-09-13T10:00:00.000Z');
    }
  });

  it('C. completed cannot → arrived', () => {
    const auth = row('t1', 's1', 1, 'completed', { arrived_at: 't0', completed_at: 't1' });
    const resolved = resolveConditionalStopTransition({
      transition: 'arrive',
      affected: null,
      authoritative: auth,
    });
    expect(resolved.kind).toBe('stale');
    expect(resolved.row?.status).toBe('completed');
  });

  it('D. pending cannot → completed directly', () => {
    const resolved = resolveConditionalStopTransition({
      transition: 'complete',
      affected: null,
      authoritative: row('t1', 's1', 1, 'pending'),
    });
    expect(resolved.kind).toBe('stale');
    expect(resolved.row?.status).toBe('pending');
  });

  it('E. double arrive is idempotent and does not reset arrived_at', () => {
    const auth = row('t1', 's1', 1, 'arrived', { arrived_at: '2026-09-13T10:00:00.000Z' });
    const resolved = resolveConditionalStopTransition({
      transition: 'arrive',
      affected: null,
      authoritative: auth,
    });
    expect(resolved.kind).toBe('idempotent');
    if (resolved.kind === 'idempotent') {
      expect(resolved.row.arrived_at).toBe('2026-09-13T10:00:00.000Z');
    }
  });

  it('F. double complete is idempotent', () => {
    const auth = row('t1', 's1', 1, 'completed', {
      arrived_at: 'a',
      completed_at: 'c',
    });
    const resolved = resolveConditionalStopTransition({
      transition: 'complete',
      affected: null,
      authoritative: auth,
    });
    expect(resolved.kind).toBe('idempotent');
  });

  it('G. zero affected + unexpected status is stale (refetch required)', () => {
    const resolved = resolveConditionalStopTransition({
      transition: 'arrive',
      affected: null,
      authoritative: row('t1', 's1', 1, 'failed'),
    });
    expect(resolved.kind).toBe('stale');
  });
});

describe('current stop after complete', () => {
  it('H. next sequence becomes current; I. order preserved', () => {
    const tripId = 't-cur';
    let bundle = normalizeDriverStopExecution(tripId, [
      row(tripId, 's1', 1, 'pending'),
      row(tripId, 's2', 2, 'pending'),
      row(tripId, 's3', 3, 'pending'),
    ]);
    expect(bundle.stops.map((s) => s.sequence)).toEqual([1, 2, 3]);
    expect(deriveCurrentStop(bundle.stops)?.stopId).toBe('s1');

    bundle = mergeStopExecutionRowIntoBundle(
      bundle,
      row(tripId, 's1', 1, 'arrived', { arrived_at: 'a' }),
    );
    expect(deriveCurrentStop(bundle.stops)?.stopId).toBe('s1');
    expect(deriveCurrentStop(bundle.stops)?.status).toBe('arrived');

    bundle = mergeStopExecutionRowIntoBundle(
      bundle,
      row(tripId, 's1', 1, 'completed', { arrived_at: 'a', completed_at: 'c' }),
    );
    expect(deriveCurrentStop(bundle.stops)?.stopId).toBe('s2');
    expect(bundle.stops.map((s) => s.displayName)).toEqual(['Name s1', 'Name s2', 'Name s3']);
  });
});

describe('legacy / mover / trip switch / actions', () => {
  it('J. legacy zero SES → scalar', () => {
    expect(shouldShowDriverMultiStop(emptyDriverStopExecution('legacy').stops)).toBe(false);
  });

  it('K. mover-asset zero SES → scalar', () => {
    expect(shouldShowDriverMultiStop(emptyDriverStopExecution('mover').stops)).toBe(false);
  });

  it('L. trip switch must not apply previous trip mutation', () => {
    expect(
      shouldApplyDriverStopMutationResult({ tripId: 'trip-a', stopId: 's1' }, 'trip-b'),
    ).toBe(false);
    expect(
      shouldApplyDriverStopMutationResult({ tripId: 'trip-b', stopId: 's1' }, 'trip-b'),
    ).toBe(true);
  });

  it('actions only on current pending/arrived', () => {
    const pending = normalizeDriverStopExecution('t', [row('t', 's1', 1, 'pending')]).stops[0];
    const arrived = normalizeDriverStopExecution('t', [row('t', 's1', 1, 'arrived')]).stops[0];
    const done = normalizeDriverStopExecution('t', [row('t', 's1', 1, 'completed')]).stops[0];
    expect(canShowArriveAction(pending, 's1')).toBe(true);
    expect(canShowCompleteAction(pending, 's1')).toBe(false);
    expect(canShowArriveAction(arrived, 's1')).toBe(false);
    expect(canShowCompleteAction(arrived, 's1')).toBe(true);
    expect(canShowArriveAction(done, 's1')).toBe(false);
    expect(canShowCompleteAction(done, 's1')).toBe(false);
    expect(canShowArriveAction(pending, 'other')).toBe(false);
  });
});
