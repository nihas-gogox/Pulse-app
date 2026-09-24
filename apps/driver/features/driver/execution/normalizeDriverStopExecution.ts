import type {
  DriverPlanStopRow,
  DriverSesJoinRow,
  DriverStopExecutionBundle,
  DriverStopExecutionStatus,
  DriverStopExecutionStop,
} from './driverStopExecution.types';

const TERMINAL_FOR_CURRENT: ReadonlySet<string> = new Set(['completed', 'skipped']);

const KNOWN_STATUSES: ReadonlySet<string> = new Set([
  'pending',
  'arrived',
  'completed',
  'skipped',
  'failed',
]);

export function emptyDriverStopExecution(tripId: string): DriverStopExecutionBundle {
  return { tripId, stops: [] };
}

/** True when this trip has Core SES rows — Job Card multi-order mode. */
export function shouldShowDriverMultiStop(stops: readonly DriverStopExecutionStop[]): boolean {
  return stops.length > 0;
}

function unwrapPlanStop(
  embedded: DriverSesJoinRow['execution_plan_stops'],
): DriverPlanStopRow | null {
  if (!embedded) return null;
  if (Array.isArray(embedded)) return embedded[0] ?? null;
  return embedded;
}

function asNumber(value: number | string | null | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asNullableNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asStatus(value: string | null | undefined): DriverStopExecutionStatus {
  const s = (value ?? 'pending').trim().toLowerCase();
  if (KNOWN_STATUSES.has(s)) return s as DriverStopExecutionStatus;
  return 'pending';
}

function displayNameFromPlan(
  plan: ReturnType<typeof unwrapPlanStop>,
  sequence: number,
): string {
  const name = plan?.display_name?.trim() || plan?.label?.trim();
  if (name) return name;
  return `Stop ${sequence}`;
}

export function normalizeDriverStopExecution(
  tripId: string,
  rows: readonly DriverSesJoinRow[] | null | undefined,
): DriverStopExecutionBundle {
  if (!rows?.length) return emptyDriverStopExecution(tripId);

  const byStopId = new Map<string, DriverStopExecutionStop>();

  for (const row of rows) {
    if (row.trip_id && row.trip_id !== tripId) continue;
    const stopId = (row.stop_id ?? '').trim();
    if (!stopId) continue;
    if (byStopId.has(stopId)) continue;

    const plan = unwrapPlanStop(row.execution_plan_stops);
    const sequence = asNumber(row.sequence, Number.MAX_SAFE_INTEGER);

    byStopId.set(stopId, {
      stopId,
      sequence,
      stopType: (plan?.stop_type ?? '').trim() || 'stop',
      displayName: displayNameFromPlan(plan, Number.isFinite(sequence) ? sequence : byStopId.size),
      addressLine: plan?.address_line?.trim() || null,
      city: plan?.city?.trim() || null,
      state: plan?.state?.trim() || null,
      pincode: plan?.pincode?.trim() || null,
      latitude: asNullableNumber(plan?.latitude),
      longitude: asNullableNumber(plan?.longitude),
      contactName: plan?.contact_name?.trim() || null,
      contactPhone: plan?.contact_phone?.trim() || null,
      podRequired: plan?.pod_required === true,
      status: asStatus(row.status),
      driverId: row.driver_id ?? null,
      arrivedAt: row.arrived_at ?? null,
      completedAt: row.completed_at ?? null,
      skipReason: row.skip_reason ?? null,
      failureReason: row.failure_reason ?? null,
    });
  }

  const stops = Array.from(byStopId.values()).sort((a, b) => {
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    return a.stopId.localeCompare(b.stopId);
  });

  return { tripId, stops };
}

/** Lowest sequence whose status is not completed or skipped. */
export function deriveCurrentStop(
  stops: readonly DriverStopExecutionStop[],
): DriverStopExecutionStop | null {
  if (!stops.length) return null;
  const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);
  return ordered.find((s) => !TERMINAL_FOR_CURRENT.has(s.status)) ?? null;
}

export function deriveNextStop(
  stops: readonly DriverStopExecutionStop[],
  current: DriverStopExecutionStop | null = deriveCurrentStop(stops),
): DriverStopExecutionStop | null {
  if (!current || !stops.length) return null;
  const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);
  const idx = ordered.findIndex((s) => s.stopId === current.stopId);
  if (idx < 0) return null;
  return ordered[idx + 1] ?? null;
}

/** Ignore SES results that belong to a trip the card is no longer showing. */
export function isStaleDriverStopHydration(
  requestTripId: string,
  activeTripId: string | null | undefined,
): boolean {
  return !activeTripId || requestTripId !== activeTripId;
}
