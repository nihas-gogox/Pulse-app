import { supabase } from "@pulse/core/lib/supabase";

export type OperationalTimelineEventType =
  | "fuel_logged"
  | "toll_logged"
  | "other_expense_logged"
  | "odometer_added"
  | "discrepancy_detected"
  | "approval_changed"
  | "posting_completed"
  | "posting_failed"
  | "reimbursement_flagged"
  | "maintenance_logged"
  | "replay_completed"
  | "replay_failed";

export interface TripOperationalTimelineEvent {
  id: string;
  organization_id: string;
  trip_id: string;
  event_type: OperationalTimelineEventType;
  source_type: string | null;
  source_id: string | null;
  actor_user_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export async function appendTripOperationalTimelineEvent(input: {
  organizationId?: string | null;
  tripId: string;
  eventType: OperationalTimelineEventType;
  sourceType?: string | null;
  sourceId?: string | null;
  actorUserId?: string | null;
  payload?: Record<string, unknown>;
}) {
  let organizationId = String(input.organizationId ?? "").trim();
  if (!organizationId) {
    const tripRes = await supabase()
      .from("trips")
      .select("organization_id")
      .eq("id", input.tripId)
      .maybeSingle();
    organizationId = String(
      (tripRes.data as { organization_id?: string | null } | null)?.organization_id ?? "",
    ).trim();
  }
  if (!organizationId) {
    return { error: new Error("organization_id missing for timeline event") };
  }
  const payload = {
    organization_id: organizationId,
    trip_id: input.tripId,
    event_type: input.eventType,
    source_type: input.sourceType ?? null,
    source_id: input.sourceId ?? null,
    actor_user_id: input.actorUserId ?? null,
    payload: input.payload ?? {},
  };
  const { error } = await supabase().from("trip_operational_timeline_events").insert(payload);
  return { error: error ? new Error(error.message) : null };
}

export async function appendTripOperationalTimelineEventSafe(input: {
  organizationId?: string | null;
  tripId: string;
  eventType: OperationalTimelineEventType;
  sourceType?: string | null;
  sourceId?: string | null;
  actorUserId?: string | null;
  payload?: Record<string, unknown>;
}) {
  try {
    await appendTripOperationalTimelineEvent(input);
  } catch {
    // keep operations non-blocking; timeline failures should never block primary workflows
  }
}

export async function getTripOperationalTimelineEvents(input: {
  tripId: string;
  limit?: number;
}): Promise<{ error: Error | null; events: TripOperationalTimelineEvent[] }> {
  const { data, error } = await supabase()
    .from("trip_operational_timeline_events")
    .select("*")
    .eq("trip_id", input.tripId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 60);
  if (error) return { error: new Error(error.message), events: [] };
  return { error: null, events: (data ?? []) as TripOperationalTimelineEvent[] };
}
