import type { DriverSesJoinRow } from '../driverStopExecution.types';
import {
  deriveCurrentStop,
  deriveNextStop,
  emptyDriverStopExecution,
  isStaleDriverStopHydration,
  normalizeDriverStopExecution,
  shouldShowDriverMultiStop,
} from '../normalizeDriverStopExecution';

function planStop(
  id: string,
  extras: Partial<NonNullable<DriverSesJoinRow['execution_plan_stops']>> = {},
) {
  return {
    id,
    stop_type: extras && 'stop_type' in extras ? extras.stop_type : id.includes('p') ? 'pickup' : 'drop',
    display_name: `Stop ${id}`,
    address_line: `${id} street`,
    city: 'Pune',
    state: 'MH',
    pincode: '411001',
    latitude: 18.5,
    longitude: 73.8,
    contact_name: 'Ada',
    contact_phone: '999',
    pod_required: false,
    ...extras,
  };
}

function sesRow(
  tripId: string,
  stopId: string,
  sequence: number,
  status = 'pending',
  plan: DriverSesJoinRow['execution_plan_stops'] = planStop(stopId),
): DriverSesJoinRow {
  return {
    trip_id: tripId,
    stop_id: stopId,
    sequence,
    status,
    driver_id: 'drv-1',
    arrived_at: null,
    completed_at: null,
    skip_reason: null,
    failure_reason: null,
    execution_plan_stops: plan,
  };
}

describe('normalizeDriverStopExecution', () => {
  it('canonical 4-stop trip → 4 stops', () => {
    const tripId = 'trip-4';
    const bundle = normalizeDriverStopExecution(tripId, [
      sesRow(tripId, 's4', 4),
      sesRow(tripId, 's1', 1),
      sesRow(tripId, 's3', 3),
      sesRow(tripId, 's2', 2),
    ]);
    expect(bundle.tripId).toBe(tripId);
    expect(bundle.stops).toHaveLength(4);
    expect(bundle.stops.map((s) => s.stopId)).toEqual(['s1', 's2', 's3', 's4']);
    expect(bundle.stops.map((s) => s.sequence)).toEqual([1, 2, 3, 4]);
    expect(shouldShowDriverMultiStop(bundle.stops)).toBe(true);
  });

  it('1-stop trip → 1 stop', () => {
    const bundle = normalizeDriverStopExecution('trip-1', [sesRow('trip-1', 'only', 1)]);
    expect(bundle.stops).toHaveLength(1);
    expect(bundle.stops[0].stopId).toBe('only');
    expect(shouldShowDriverMultiStop(bundle.stops)).toBe(true);
  });

  it('legacy trip → 0 stops → scalar UI', () => {
    const bundle = normalizeDriverStopExecution('legacy', []);
    expect(bundle).toEqual(emptyDriverStopExecution('legacy'));
    expect(shouldShowDriverMultiStop(bundle.stops)).toBe(false);
  });

  it('mover-asset → 0 stops → scalar UI', () => {
    const bundle = normalizeDriverStopExecution('mover', null);
    expect(bundle.stops).toHaveLength(0);
    expect(shouldShowDriverMultiStop(bundle.stops)).toBe(false);
  });

  it('SES read error path keeps scalar (empty bundle)', () => {
    const bundle = emptyDriverStopExecution('trip-err');
    expect(shouldShowDriverMultiStop(bundle.stops)).toBe(false);
  });

  it('sequence ordering preserved', () => {
    const tripId = 'trip-ord';
    const bundle = normalizeDriverStopExecution(tripId, [
      sesRow(tripId, 'c', 30),
      sesRow(tripId, 'a', 10),
      sesRow(tripId, 'b', 20),
    ]);
    expect(bundle.stops.map((s) => s.sequence)).toEqual([10, 20, 30]);
  });

  it('duplicate stop rows do not create duplicate UI stops', () => {
    const tripId = 'trip-dup';
    const bundle = normalizeDriverStopExecution(tripId, [
      sesRow(tripId, 's1', 1, 'pending'),
      sesRow(tripId, 's1', 1, 'arrived'),
      sesRow(tripId, 's2', 2),
    ]);
    expect(bundle.stops).toHaveLength(2);
    expect(bundle.stops[0].status).toBe('pending');
  });

  it('does not mix another trip id into the active bundle', () => {
    const bundle = normalizeDriverStopExecution('trip-a', [
      sesRow('trip-a', 'a1', 1),
      sesRow('trip-b', 'b1', 1),
    ]);
    expect(bundle.stops.map((s) => s.stopId)).toEqual(['a1']);
  });
});

describe('deriveCurrentStop / deriveNextStop', () => {
  const tripId = 'trip-cur';
  const stops = normalizeDriverStopExecution(tripId, [
    sesRow(tripId, 's1', 1, 'completed'),
    sesRow(tripId, 's2', 2, 'skipped'),
    sesRow(tripId, 's3', 3, 'pending'),
    sesRow(tripId, 's4', 4, 'pending'),
  ]).stops;

  it('current stop derived correctly (lowest open sequence)', () => {
    const current = deriveCurrentStop(stops);
    expect(current?.stopId).toBe('s3');
    expect(deriveNextStop(stops, current)?.stopId).toBe('s4');
  });

  it('completed/skipped stops excluded from current', () => {
    expect(deriveCurrentStop(stops)?.status).toBe('pending');
    expect(stops.filter((s) => s.status === 'completed' || s.status === 'skipped')).toHaveLength(2);
  });

  it('failed stop remains current (not treated as skipped/completed)', () => {
    const failed = normalizeDriverStopExecution(tripId, [
      sesRow(tripId, 's1', 1, 'failed'),
      sesRow(tripId, 's2', 2, 'pending'),
    ]).stops;
    expect(deriveCurrentStop(failed)?.stopId).toBe('s1');
  });
});

describe('isStaleDriverStopHydration', () => {
  it('trip switch does not display previous trip stops', () => {
    expect(isStaleDriverStopHydration('trip-old', 'trip-new')).toBe(true);
    expect(isStaleDriverStopHydration('trip-new', 'trip-new')).toBe(false);
    expect(isStaleDriverStopHydration('trip-old', null)).toBe(true);
  });
});
