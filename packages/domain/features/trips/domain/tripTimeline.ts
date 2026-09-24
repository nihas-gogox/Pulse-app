import { supabase } from "@pulse/core/lib/supabase";
import { throwIfCancelled, withAbortSignal } from "@pulse/core/lib/supabaseAbort.util";
import {
  getTripWorkflowEvents,
  getTripWorkflowEventsForTrips,
  type TripWorkflowEvent,
} from "../services/tripWorkflow.service";

/**
 * Operational timeline — Layer 1 (service). Collects real events from
 * across the platform for one trip, normalizes them into a single
 * UI-agnostic shape, and returns them sorted chronologically. Knows nothing
 * about rendering; features/trips/components/trip-detail/TripTrackingBlock.tsx
 * (Layer 2) is what turns this into rows on screen.
 *
 * Replaces the inferred mission log (buildMissionLog in TripTrackingBlock),
 * which reconstructed only 4 coarse steps from trips.created_at/started_at/
 * updated_at/completed_at. This is built from actual recorded events instead.
 *
 * Deliberately NOT included, because no event source exists for them yet:
 * navigation started, package collection started/collected (as distinct from
 * geofence exit), fuel stop, rest break. Adding rows for these without a real
 * writer would be fabricating data. When those get instrumented, add a case
 * here rather than inventing a placeholder now.
 */

export type TripTimelineEventType =
  | "assigned"
  | "driver_accepted"
  | "entered_pickup"
  | "exited_pickup"
  | "entered_drop"
  | "exited_drop"
  | "pod_uploaded"
  | "completed";

export type TripTimelineSeverity = "info" | "success" | "warning";

export interface TripTimelineEvent {
  id: string;
  occurredAt: string;
  type: TripTimelineEventType;
  title: string;
  description?: string;
  severity: TripTimelineSeverity;
  location?: { latitude: number; longitude: number } | null;
}

const GEOFENCE_EVENT_TITLES: Record<
  string,
  { type: TripTimelineEventType; title: string; description: string }
> = {
  enter_pickup: {
    type: "entered_pickup",
    title: "Entered pickup",
    description: "Driver reached the pickup location.",
  },
  exit_pickup: {
    type: "exited_pickup",
    title: "Left pickup",
    description: "Driver departed the pickup location.",
  },
  enter_drop: {
    type: "entered_drop",
    title: "Entered drop",
    description: "Driver reached the drop-off location.",
  },
  exit_drop: {
    type: "exited_drop",
    title: "Left drop",
    description: "Driver departed the drop-off location.",
  },
};

interface GeofenceEventRow {
  id: string;
  trip_id: string;
  event_type: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
}

function mapGeofenceRow(row: GeofenceEventRow): TripTimelineEvent | null {
  const meta = GEOFENCE_EVENT_TITLES[row.event_type];
  if (!meta) return null;
  return {
    id: `geofence:${row.id}`,
    occurredAt: row.recorded_at,
    type: meta.type,
    title: meta.title,
    description: meta.description,
    severity: "info",
    location: { latitude: row.latitude, longitude: row.longitude },
  };
}

async function getGeofenceTimelineEvents(
  tripId: string,
  signal?: AbortSignal,
): Promise<{ error: Error | null; events: TripTimelineEvent[] }> {
  const { data, error } = await withAbortSignal(
    supabase()
      .from("geofence_events")
      .select("id, trip_id, event_type, latitude, longitude, recorded_at")
      .eq("trip_id", tripId)
      .order("recorded_at", { ascending: true }),
    signal,
  );

  if (error) return { error: new Error(error.message), events: [] };
  const events = ((data ?? []) as GeofenceEventRow[])
    .map(mapGeofenceRow)
    .filter((e): e is TripTimelineEvent => e !== null);
  return { error: null, events };
}

/** Batch variant — one query for N trips, grouped client-side. */
async function getGeofenceTimelineEventsForTrips(
  tripIds: string[],
): Promise<{ error: Error | null; eventsByTripId: Map<string, TripTimelineEvent[]> }> {
  if (tripIds.length === 0) return { error: null, eventsByTripId: new Map() };
  const { data, error } = await supabase()
    .from("geofence_events")
    .select("id, trip_id, event_type, latitude, longitude, recorded_at")
    .in("trip_id", tripIds)
    .order("recorded_at", { ascending: true });

  if (error) return { error: new Error(error.message), eventsByTripId: new Map() };

  const eventsByTripId = new Map<string, TripTimelineEvent[]>();
  for (const row of (data ?? []) as GeofenceEventRow[]) {
    const mapped = mapGeofenceRow(row);
    if (!mapped) continue;
    const list = eventsByTripId.get(row.trip_id) ?? [];
    list.push(mapped);
    eventsByTripId.set(row.trip_id, list);
  }
  return { error: null, eventsByTripId };
}

interface DriverAcceptedAuditRow {
  id: string;
  trip_id: string;
  changed_at: string;
}

function mapDriverAcceptedRow(row: DriverAcceptedAuditRow): TripTimelineEvent {
  return {
    id: `assignment_audit:${row.id}`,
    occurredAt: row.changed_at,
    type: "driver_accepted",
    title: "Driver accepted",
    severity: "info",
  };
}

async function getDriverAcceptedTimelineEvents(
  tripId: string,
  signal?: AbortSignal,
): Promise<{ error: Error | null; events: TripTimelineEvent[] }> {
  const { data, error } = await withAbortSignal(
    supabase()
      .from("trip_assignment_audit")
      .select("id, trip_id, changed_at")
      .eq("trip_id", tripId)
      .eq("event_type", "driver_accepted")
      .order("changed_at", { ascending: true }),
    signal,
  );

  if (error) return { error: new Error(error.message), events: [] };
  const events = ((data ?? []) as DriverAcceptedAuditRow[]).map(mapDriverAcceptedRow);
  return { error: null, events };
}

/** Batch variant — one query for N trips, grouped client-side. */
async function getDriverAcceptedTimelineEventsForTrips(
  tripIds: string[],
): Promise<{ error: Error | null; eventsByTripId: Map<string, TripTimelineEvent[]> }> {
  if (tripIds.length === 0) return { error: null, eventsByTripId: new Map() };
  const { data, error } = await supabase()
    .from("trip_assignment_audit")
    .select("id, trip_id, changed_at")
    .in("trip_id", tripIds)
    .eq("event_type", "driver_accepted")
    .order("changed_at", { ascending: true });

  if (error) return { error: new Error(error.message), eventsByTripId: new Map() };

  const eventsByTripId = new Map<string, TripTimelineEvent[]>();
  for (const row of (data ?? []) as DriverAcceptedAuditRow[]) {
    const list = eventsByTripId.get(row.trip_id) ?? [];
    list.push(mapDriverAcceptedRow(row));
    eventsByTripId.set(row.trip_id, list);
  }
  return { error: null, eventsByTripId };
}

function mapWorkflowRow(row: TripWorkflowEvent): TripTimelineEvent | null {
  if (row.event_type === "pod.uploaded") {
    return {
      id: `workflow:${row.id}`,
      occurredAt: row.created_at,
      type: "pod_uploaded",
      title: "POD uploaded",
      severity: "info",
    };
  }
  if (row.event_type === "trip.completed") {
    return {
      id: `workflow:${row.id}`,
      occurredAt: row.created_at,
      type: "completed",
      title: "Trip completed",
      severity: "success",
    };
  }
  // invoice.generated / supplier.payment_recorded / client.payment_received
  // are finance-track events, not part of the driver-facing operational
  // sequence -- deliberately excluded here.
  return null;
}

async function getWorkflowTimelineEvents(
  tripId: string,
  signal?: AbortSignal,
): Promise<{ error: Error | null; events: TripTimelineEvent[] }> {
  const { error, events: workflowEvents } = await getTripWorkflowEvents(tripId, signal);
  if (error) return { error, events: [] };
  const events = workflowEvents
    .map(mapWorkflowRow)
    .filter((e): e is TripTimelineEvent => e !== null);
  return { error: null, events };
}

/** Batch variant — one query for N trips, grouped client-side. */
async function getWorkflowTimelineEventsForTrips(
  tripIds: string[],
): Promise<{ error: Error | null; eventsByTripId: Map<string, TripTimelineEvent[]> }> {
  const { error, eventsByTripId: rowsByTripId } = await getTripWorkflowEventsForTrips(tripIds);
  if (error) return { error, eventsByTripId: new Map() };

  const eventsByTripId = new Map<string, TripTimelineEvent[]>();
  for (const [tripId, rows] of rowsByTripId) {
    const mapped = rows.map(mapWorkflowRow).filter((e): e is TripTimelineEvent => e !== null);
    eventsByTripId.set(tripId, mapped);
  }
  return { error: null, eventsByTripId };
}

/**
 * Collect -> sort -> normalize -> return. `assignedAt` is accepted directly
 * (rather than re-fetching the trip row) because every caller already has
 * the trip loaded.
 */
function assignedEvent(tripId: string, assignedAt: string | null): TripTimelineEvent[] {
  if (!assignedAt) return [];
  return [
    {
      id: `assigned:${tripId}`,
      occurredAt: assignedAt,
      type: "assigned",
      title: "Assigned",
      severity: "info",
    },
  ];
}

function mergeSorted(...groups: TripTimelineEvent[][]): TripTimelineEvent[] {
  return groups
    .flat()
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
}

export async function getTripTimeline(params: {
  tripId: string;
  assignedAt: string | null;
  signal?: AbortSignal;
}): Promise<{ error: Error | null; events: TripTimelineEvent[] }> {
  const signal = params.signal;
  const [geofence, accepted, workflow] = await Promise.all([
    getGeofenceTimelineEvents(params.tripId, signal),
    getDriverAcceptedTimelineEvents(params.tripId, signal),
    getWorkflowTimelineEvents(params.tripId, signal),
  ]);

  const error = geofence.error ?? accepted.error ?? workflow.error;
  if (error) {
    throwIfCancelled(signal, error);
    return { error, events: [] };
  }

  const events = mergeSorted(
    assignedEvent(params.tripId, params.assignedAt),
    accepted.events,
    geofence.events,
    workflow.events,
  );

  return { error: null, events };
}

/**
 * Batch variant for fleet-wide views (e.g. an operations dashboard): 3
 * queries total instead of 3-per-trip. Same collect/sort/normalize contract
 * as getTripTimeline, just returning a map keyed by trip_id.
 */
export async function getTripTimelinesForTrips(params: {
  /** trip_id -> trips.created_at, since callers already have the trip rows loaded. */
  assignedAtByTripId: Map<string, string | null>;
}): Promise<{ error: Error | null; timelinesByTripId: Map<string, TripTimelineEvent[]> }> {
  const tripIds = Array.from(params.assignedAtByTripId.keys());
  const [geofence, accepted, workflow] = await Promise.all([
    getGeofenceTimelineEventsForTrips(tripIds),
    getDriverAcceptedTimelineEventsForTrips(tripIds),
    getWorkflowTimelineEventsForTrips(tripIds),
  ]);

  const error = geofence.error ?? accepted.error ?? workflow.error;
  if (error) return { error, timelinesByTripId: new Map() };

  const timelinesByTripId = new Map<string, TripTimelineEvent[]>();
  for (const [tripId, assignedAt] of params.assignedAtByTripId) {
    timelinesByTripId.set(
      tripId,
      mergeSorted(
        assignedEvent(tripId, assignedAt),
        accepted.eventsByTripId.get(tripId) ?? [],
        geofence.eventsByTripId.get(tripId) ?? [],
        workflow.eventsByTripId.get(tripId) ?? [],
      ),
    );
  }
  return { error: null, timelinesByTripId };
}
