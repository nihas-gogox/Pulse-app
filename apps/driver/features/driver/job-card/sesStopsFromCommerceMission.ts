import type { DriverTripStopOrderMission } from '../commerce-mission/driverTripStopOrders.types';
import type {
  DriverStopExecutionStatus,
  DriverStopExecutionStop,
} from '../execution/driverStopExecution.types';
import {
  deriveCurrentStop,
  deriveNextStop,
} from '../execution/normalizeDriverStopExecution';
import type { DriverStopExecutionController } from '../hooks/useDriverStopExecution';
import type { TripRow } from '@pulse/domain/features/trips/services/trips.service';

export const ROUTE_SETUP_PENDING_MESSAGE =
  'Route setup pending. Arrive and complete are unavailable until stop execution is ready.';

const BLOCKED_EXECUTION_RESULT = {
  ok: false as const,
  error: new Error(ROUTE_SETUP_PENDING_MESSAGE),
};

const KNOWN_STATUSES: ReadonlySet<string> = new Set([
  'pending',
  'arrived',
  'completed',
  'skipped',
  'failed',
]);

function asStatus(value: string | null | undefined): DriverStopExecutionStatus {
  const s = (value ?? 'pending').trim().toLowerCase();
  if (KNOWN_STATUSES.has(s)) return s as DriverStopExecutionStatus;
  return 'pending';
}

/** Map Primitive A stops onto the SES shape the Job Card already renders. */
export function sesStopsFromCommerceMission(
  mission: DriverTripStopOrderMission | null | undefined,
): DriverStopExecutionStop[] {
  if (!mission?.stops.length) return [];
  return [...mission.stops]
    .sort((a, b) => a.sequence - b.sequence)
    .map((stop) => ({
      stopId: stop.stopId,
      sequence: stop.sequence,
      stopType: (stop.stopType ?? '').trim() || 'stop',
      displayName:
        stop.displayName?.trim() || stop.label?.trim() || `Stop ${stop.sequence}`,
      addressLine: stop.addressLine,
      city: stop.city,
      state: stop.state,
      pincode: stop.pincode,
      latitude: stop.latitude,
      longitude: stop.longitude,
      contactName: stop.contactName,
      contactPhone: stop.contactPhone,
      podRequired: stop.podRequired,
      status: asStatus(stop.stopExecutionStatus),
      driverId: null,
      arrivedAt: stop.arrivedAt,
      completedAt: stop.completedAt,
      skipReason: null,
      failureReason: stop.failureReason,
    }));
}

export function fallbackSesStopsFromTrip(trip: TripRow): DriverStopExecutionStop[] {
  const pickupName = trip.pickup_area?.trim() || 'Pickup';
  const dropName = trip.drop_location?.trim() || 'Drop';
  return [
    {
      stopId: `${trip.id}-pickup`,
      sequence: 1,
      stopType: 'pickup',
      displayName: pickupName,
      addressLine: pickupName,
      city: null,
      state: null,
      pincode: null,
      latitude: trip.pickup_lat ?? null,
      longitude: trip.pickup_lon ?? null,
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
    {
      stopId: `${trip.id}-drop`,
      sequence: 2,
      stopType: 'drop',
      displayName: dropName,
      addressLine: dropName,
      city: null,
      state: null,
      pincode: null,
      latitude: trip.drop_lat ?? null,
      longitude: trip.drop_lon ?? null,
      contactName: null,
      contactPhone: null,
      podRequired: true,
      status: 'pending',
      driverId: null,
      arrivedAt: null,
      completedAt: null,
      skipReason: null,
      failureReason: null,
    },
  ];
}

export function overlayCommerceStopsOnExecution(
  stopExecution: DriverStopExecutionController,
  mission: DriverTripStopOrderMission | null | undefined,
  trip: TripRow,
): DriverStopExecutionController {
  if (stopExecution.stops.length > 0) return stopExecution;
  const fromMission = sesStopsFromCommerceMission(mission);
  const stops = fromMission.length > 0 ? fromMission : fallbackSesStopsFromTrip(trip);
  const currentStop = deriveCurrentStop(stops);
  return {
    ...stopExecution,
    stops,
    currentStop,
    nextStop: deriveNextStop(stops, currentStop),
    arrive: () => Promise.resolve(BLOCKED_EXECUTION_RESULT),
    complete: () => Promise.resolve(BLOCKED_EXECUTION_RESULT),
  };
}
