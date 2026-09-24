import type { DriverStopExecutionStop } from '../execution/driverStopExecution.types';

export type DriverRoutePlanKind = 'pickup' | 'drop' | 'other';

export type DriverRoutePlanMapStop = {
  stopId: string;
  sequence: number;
  /** 1-based index among pickups or among drops. */
  kindIndex: number;
  kind: DriverRoutePlanKind;
  latitude: number;
  longitude: number;
  label: string;
  isCurrent: boolean;
};

export type DriverRoutePlanMap = {
  tripId: string;
  focusKind: 'pickup' | 'drop';
  previewStopId: string | null;
  /** Fit every stop; do not follow a single pin. */
  overview: boolean;
  stops: DriverRoutePlanMapStop[];
};

export function routePlanKind(stopType: string | null | undefined): DriverRoutePlanKind {
  const t = (stopType ?? '').trim().toLowerCase();
  if (t === 'pickup') return 'pickup';
  if (t === 'drop') return 'drop';
  return 'other';
}

function asCoord(lat: number | null | undefined, lon: number | null | undefined): {
  latitude: number;
  longitude: number;
} | null {
  if (lat == null || lon == null) return null;
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export function buildDriverRoutePlanMap(
  tripId: string,
  stops: readonly DriverStopExecutionStop[],
  currentStopId: string | null,
  focusKind: 'pickup' | 'drop',
  previewStopId: string | null = null,
  overview = true,
): DriverRoutePlanMap {
  const mapped: DriverRoutePlanMapStop[] = [];
  for (const stop of stops) {
    const coord = asCoord(stop.latitude, stop.longitude);
    if (!coord) continue;
    mapped.push({
      stopId: stop.stopId,
      sequence: stop.sequence,
      kindIndex: 0,
      kind: routePlanKind(String(stop.stopType)),
      latitude: coord.latitude,
      longitude: coord.longitude,
      label: stop.displayName?.trim() || stop.city?.trim() || stop.addressLine?.trim() || `Stop ${stop.sequence}`,
      isCurrent: stop.stopId === currentStopId,
    });
  }
  mapped.sort((a, b) => a.sequence - b.sequence);
  let pickupN = 0;
  let dropN = 0;
  const numbered = mapped.map((stop) => {
    if (stop.kind === 'pickup') {
      pickupN += 1;
      return { ...stop, kindIndex: pickupN };
    }
    if (stop.kind === 'drop') {
      dropN += 1;
      return { ...stop, kindIndex: dropN };
    }
    return { ...stop, kindIndex: stop.sequence };
  });
  return { tripId, focusKind, previewStopId, overview, stops: numbered };
}

export function buildTripRowRoutePlanMap(
  tripId: string,
  pickup: { latitude: number; longitude: number; label: string } | null,
  drop: { latitude: number; longitude: number; label: string } | null,
): DriverRoutePlanMap {
  const stops: DriverRoutePlanMapStop[] = [];
  if (pickup) {
    stops.push({
      stopId: `${tripId}-pickup`,
      sequence: 1,
      kindIndex: 1,
      kind: 'pickup',
      latitude: pickup.latitude,
      longitude: pickup.longitude,
      label: pickup.label,
      isCurrent: true,
    });
  }
  if (drop) {
    stops.push({
      stopId: `${tripId}-drop`,
      sequence: 2,
      kindIndex: 1,
      kind: 'drop',
      latitude: drop.latitude,
      longitude: drop.longitude,
      label: drop.label,
      isCurrent: false,
    });
  }
  return {
    tripId,
    focusKind: 'pickup',
    previewStopId: null,
    overview: true,
    stops,
  };
}

export function routePlanStopCaption(stop: DriverRoutePlanMapStop): string {
  if (stop.kind === 'drop') return `Drop ${stop.kindIndex}`;
  if (stop.kind === 'pickup') return `Pickup ${stop.kindIndex}`;
  return `Stop ${stop.sequence}`;
}

export function routePlanLeafletMarkerId(stop: DriverRoutePlanMapStop): string {
  if (stop.kind === 'drop') return `drop-${stop.kindIndex}`;
  if (stop.kind === 'pickup') return `pickup-${stop.kindIndex}`;
  return `plan-${stop.stopId}`;
}

export function routePlanPolyline(
  plan: DriverRoutePlanMap | null,
): Array<{ latitude: number; longitude: number }> {
  if (!plan || plan.stops.length < 2) return [];
  return plan.stops.map((s) => ({ latitude: s.latitude, longitude: s.longitude }));
}
