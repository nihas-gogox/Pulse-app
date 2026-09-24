import { emptyDriverTripStopOrderMission } from '../../commerce-mission/normalizeDriverTripStopOrders';
import type { DriverTripStopOrderStop } from '../../commerce-mission/driverTripStopOrders.types';
import type { DriverStopExecutionStop } from '../../execution/driverStopExecution.types';
import type { DriverStopExecutionController } from '../../hooks/useDriverStopExecution';
import {
  fallbackSesStopsFromTrip,
  overlayCommerceStopsOnExecution,
  ROUTE_SETUP_PENDING_MESSAGE,
  sesStopsFromCommerceMission,
} from '../sesStopsFromCommerceMission';
import type { TripRow } from '@pulse/domain/features/trips/services/trips.service';

function commerceStop(
  extras: Partial<DriverTripStopOrderStop> & Pick<DriverTripStopOrderStop, 'stopId' | 'sequence'>,
): DriverTripStopOrderStop {
  return {
    stopType: 'drop',
    sourceType: 'customer',
    displayName: extras.displayName ?? extras.stopId,
    label: extras.stopId,
    addressLine: '1 Main',
    city: 'Chennai',
    state: 'TN',
    pincode: '600001',
    contactName: 'Ada',
    contactPhone: '90000',
    latitude: 13.08,
    longitude: 80.27,
    podRequired: true,
    stopExecutionStatus: 'pending',
    arrivedAt: null,
    completedAt: null,
    failureReason: null,
    stopDistinctDropOrderCount: 1,
    orders: [],
    ...extras,
  };
}

function controller(stops: DriverStopExecutionStop[]): DriverStopExecutionController {
  return {
    tripId: 'trip-1',
    stops,
    currentStop: stops[0] ?? null,
    nextStop: stops[1] ?? null,
    mutating: null,
    hydrated: true,
    arrive: jest.fn(),
    complete: jest.fn(),
  };
}

describe('sesStopsFromCommerceMission', () => {
  it('maps Primitive A stops in sequence', () => {
    const mission = {
      ...emptyDriverTripStopOrderMission('trip-1'),
      executionPlanId: 'plan-1',
      stops: [
        commerceStop({ stopId: 'd1', sequence: 2, stopType: 'drop', displayName: 'Drop 1' }),
        commerceStop({ stopId: 'p1', sequence: 1, stopType: 'pickup', displayName: 'Pickup 1' }),
      ],
    };
    const stops = sesStopsFromCommerceMission(mission);
    expect(stops.map((s) => s.stopId)).toEqual(['p1', 'd1']);
    expect(stops[0].stopType).toBe('pickup');
    expect(stops[1].podRequired).toBe(true);
  });

  it('keeps SES stops when they already exist', () => {
    const ses = controller([
      {
        stopId: 'ses-1',
        sequence: 1,
        stopType: 'pickup',
        displayName: 'Warehouse',
        addressLine: null,
        city: null,
        state: null,
        pincode: null,
        latitude: null,
        longitude: null,
        contactName: null,
        contactPhone: null,
        podRequired: false,
        status: 'pending',
        driverId: null,
        arrivedAt: null,
        completedAt: null,
        skipReason: null,
        failureReason: null,
      },
    ]);
    const mission = {
      ...emptyDriverTripStopOrderMission('trip-1'),
      executionPlanId: 'plan-1',
      stops: [commerceStop({ stopId: 'p1', sequence: 1, stopType: 'pickup' })],
    };
    const trip = { id: 'trip-1', pickup_area: 'A', drop_location: 'B' } as TripRow;
    const merged = overlayCommerceStopsOnExecution(ses, mission, trip);
    expect(merged.stops[0].stopId).toBe('ses-1');
    expect(merged.arrive).toBe(ses.arrive);
    expect(merged.complete).toBe(ses.complete);
  });

  it('falls back to trip pickup/drop when commerce has a plan but no stop rows', async () => {
    const ses = controller([]);
    const mission = {
      ...emptyDriverTripStopOrderMission('trip-1'),
      executionPlanId: 'plan-1',
      stops: [],
    };
    const trip = {
      id: 'trip-1',
      pickup_area: 'Primary warehouse, Chennai',
      drop_location: 'Customer',
      pickup_lat: 13,
      pickup_lon: 80.2,
      drop_lat: 13.1,
      drop_lon: 80.3,
    } as TripRow;
    const merged = overlayCommerceStopsOnExecution(ses, mission, trip);
    expect(merged.stops.map((s) => s.stopType)).toEqual(['pickup', 'drop']);
    expect(fallbackSesStopsFromTrip(trip)).toHaveLength(2);
    await expect(merged.arrive()).resolves.toEqual({
      ok: false,
      error: expect.objectContaining({ message: ROUTE_SETUP_PENDING_MESSAGE }),
    });
    await expect(merged.complete()).resolves.toEqual({
      ok: false,
      error: expect.objectContaining({ message: ROUTE_SETUP_PENDING_MESSAGE }),
    });
    expect(ses.arrive).not.toHaveBeenCalled();
    expect(ses.complete).not.toHaveBeenCalled();
  });

  it('does not mutate when overlaying Primitive A stops onto empty SES', async () => {
    const ses = controller([]);
    const mission = {
      ...emptyDriverTripStopOrderMission('trip-1'),
      executionPlanId: 'plan-1',
      stops: [commerceStop({ stopId: 'plan-stop-1', sequence: 1, stopType: 'pickup' })],
    };
    const trip = { id: 'trip-1' } as TripRow;
    const merged = overlayCommerceStopsOnExecution(ses, mission, trip);
    expect(merged.stops[0].stopId).toBe('plan-stop-1');
    await merged.arrive();
    await merged.complete();
    expect(ses.arrive).not.toHaveBeenCalled();
    expect(ses.complete).not.toHaveBeenCalled();
  });
});
