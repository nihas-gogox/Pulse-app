import { supabase } from "@pulse/core/lib/supabase";
import type {
  ReimbursementState,
  TripFuelEntry,
  TripOtherExpenseEntry,
  TripTollEntry,
} from "../types";
import {
  canTransitionReimbursementState,
} from "./reimbursementState";
import { appendTripOperationalTimelineEventSafe } from "../timeline/timelineEvents.service";

export async function updateFuelReimbursementState(input: {
  entryId: string;
  nextState: ReimbursementState;
  actorUserId: string | null;
  notes?: string | null;
}): Promise<{ error: Error | null; entry: TripFuelEntry | null }> {
  const rowRes = await supabase()
    .from("trip_fuel_entries")
    .select("*")
    .eq("id", input.entryId)
    .single();
  if (rowRes.error || !rowRes.data) {
    return { error: new Error(rowRes.error?.message ?? "Fuel entry not found"), entry: null };
  }
  const current = rowRes.data as TripFuelEntry;
  const currentState = current.reimbursement_state ?? "reported";
  if (!canTransitionReimbursementState(currentState, input.nextState)) {
    return {
      error: new Error(
        `Invalid reimbursement transition: ${currentState} -> ${input.nextState}`,
      ),
      entry: null,
    };
  }
  const patch = {
    reimbursement_state: input.nextState,
    reimbursement_updated_at: new Date().toISOString(),
    reimbursed_at:
      input.nextState === "reimbursed" ? new Date().toISOString() : current.reimbursed_at ?? null,
    reimbursed_by:
      input.nextState === "reimbursed" ? input.actorUserId : current.reimbursed_by ?? null,
    reimbursement_notes: input.notes ?? current.reimbursement_notes ?? null,
  };
  const updateRes = await supabase()
    .from("trip_fuel_entries")
    .update(patch)
    .eq("id", input.entryId)
    .select("*")
    .single();
  if (updateRes.error) return { error: new Error(updateRes.error.message), entry: null };
  await appendTripOperationalTimelineEventSafe({
    tripId: String(updateRes.data.trip_id),
    eventType: "reimbursement_flagged",
    sourceType: "fuel",
    sourceId: input.entryId,
    actorUserId: input.actorUserId,
    payload: { reimbursementState: input.nextState },
  });
  return { error: null, entry: updateRes.data as TripFuelEntry };
}

export async function updateTollReimbursementState(input: {
  entryId: string;
  nextState: ReimbursementState;
  actorUserId: string | null;
  notes?: string | null;
}): Promise<{ error: Error | null; entry: TripTollEntry | null }> {
  const rowRes = await supabase()
    .from("trip_toll_entries")
    .select("*")
    .eq("id", input.entryId)
    .single();
  if (rowRes.error || !rowRes.data) {
    return { error: new Error(rowRes.error?.message ?? "Toll entry not found"), entry: null };
  }
  const current = rowRes.data as TripTollEntry;
  const currentState = current.reimbursement_state ?? "reported";
  if (!canTransitionReimbursementState(currentState, input.nextState)) {
    return {
      error: new Error(
        `Invalid reimbursement transition: ${currentState} -> ${input.nextState}`,
      ),
      entry: null,
    };
  }
  const patch = {
    reimbursement_state: input.nextState,
    reimbursement_updated_at: new Date().toISOString(),
    reimbursed_at:
      input.nextState === "reimbursed" ? new Date().toISOString() : current.reimbursed_at ?? null,
    reimbursed_by:
      input.nextState === "reimbursed" ? input.actorUserId : current.reimbursed_by ?? null,
    reimbursement_notes: input.notes ?? current.reimbursement_notes ?? null,
  };
  const updateRes = await supabase()
    .from("trip_toll_entries")
    .update(patch)
    .eq("id", input.entryId)
    .select("*")
    .single();
  if (updateRes.error) return { error: new Error(updateRes.error.message), entry: null };
  await appendTripOperationalTimelineEventSafe({
    tripId: String(updateRes.data.trip_id),
    eventType: "reimbursement_flagged",
    sourceType: "toll",
    sourceId: input.entryId,
    actorUserId: input.actorUserId,
    payload: { reimbursementState: input.nextState },
  });
  return { error: null, entry: updateRes.data as TripTollEntry };
}

export async function updateOtherReimbursementState(input: {
  entryId: string;
  nextState: ReimbursementState;
  actorUserId: string | null;
  notes?: string | null;
}): Promise<{ error: Error | null; entry: TripOtherExpenseEntry | null }> {
  const rowRes = await supabase()
    .from("trip_other_expenses")
    .select("*")
    .eq("id", input.entryId)
    .single();
  if (rowRes.error || !rowRes.data) {
    return { error: new Error(rowRes.error?.message ?? "Expense entry not found"), entry: null };
  }
  const current = rowRes.data as TripOtherExpenseEntry;
  const currentState = current.reimbursement_state ?? "reported";
  if (!canTransitionReimbursementState(currentState, input.nextState)) {
    return {
      error: new Error(
        `Invalid reimbursement transition: ${currentState} -> ${input.nextState}`,
      ),
      entry: null,
    };
  }
  const patch = {
    reimbursement_state: input.nextState,
    reimbursement_updated_at: new Date().toISOString(),
    reimbursed_at:
      input.nextState === "reimbursed" ? new Date().toISOString() : current.reimbursed_at ?? null,
    reimbursed_by:
      input.nextState === "reimbursed" ? input.actorUserId : current.reimbursed_by ?? null,
    reimbursement_notes: input.notes ?? current.reimbursement_notes ?? null,
  };
  const updateRes = await supabase()
    .from("trip_other_expenses")
    .update(patch)
    .eq("id", input.entryId)
    .select("*")
    .single();
  if (updateRes.error) return { error: new Error(updateRes.error.message), entry: null };
  await appendTripOperationalTimelineEventSafe({
    tripId: String(updateRes.data.trip_id),
    eventType: "reimbursement_flagged",
    sourceType: "trip_expense",
    sourceId: input.entryId,
    actorUserId: input.actorUserId,
    payload: { reimbursementState: input.nextState },
  });
  return { error: null, entry: updateRes.data as TripOtherExpenseEntry };
}
