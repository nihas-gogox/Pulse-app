/**
 * Driver quick-status lines stored in `trips.notes` as `[UPDATE|step|iso|message]`.
 * The driver chat UI also mirrors each tap into `trip_messages` so dispatchers see it in Command Hub.
 */
import { supabase } from '@pulse/core/lib/supabase';
import type { TripRow } from '@pulse/domain/features/trips/services/trips.service';
import { deriveTripStage, type TripStage } from '@pulse/domain/features/trips/domain/tripStage';

export type DriverFlowStepId = TripStage;

export interface ParsedDriverStatusNote {
  step: string;
  timestamp: string;
  message: string;
}

export const DRIVER_PREDEFINED_STATUS_BY_STEP: Record<DriverFlowStepId, string[]> = {
  accepted: [
    'On my way to pickup',
    'Arrived at pickup location',
    'Loading in progress',
    'Slight delay — will arrive soon',
    'Waiting at gate',
  ],
  pickup: [
    'Loading complete',
    'Documents collected',
    'Package secured',
    'Ready to depart',
    'Waiting for documents',
  ],
  lr: [
    'LR collected',
    'Loading slip attached',
    'Goods loaded and sealed',
    'Departing with LR',
  ],
  transit: [
    'En route to destination',
    'Traffic ahead — slight delay',
    'Taking alternate route',
    'Approaching destination',
    'Stopped for mandatory break',
  ],
  reached: [
    'Arrived at destination',
    'Unloading in progress',
    'Delivery confirmed by recipient',
    'Recipient not available',
    'Documents handed over',
  ],
  completed: [],
};

/** Parse [UPDATE|step|timestamp|message] entries from trip.notes (newest first). */
export function parseDriverUpdatesFromNotes(notes: string | null): ParsedDriverStatusNote[] {
  if (!notes) return [];
  return notes
    .split('\n')
    .filter((l) => l.startsWith('[UPDATE|'))
    .map((l) => {
      const inner = l.slice(8, -1);
      const [step, timestamp, ...msgParts] = inner.split('|');
      return { step, timestamp, message: msgParts.join('|') };
    })
    .reverse();
}

// Moved to features/trips/domain/tripStage.ts (deriveTripStage) — this was a
// byte-for-byte duplicate of DriverHomeScreen.tsx's former
// deriveDriverGuidanceStep. Kept as a thin re-export so existing call sites
// (DriverTripFlowCard.tsx) don't need to change their import.
export const deriveDriverFlowStepFromTrip = deriveTripStage as (
  t: TripRow,
) => DriverFlowStepId;

export async function appendDriverStatusNote(
  tripId: string,
  step: DriverFlowStepId,
  message: string,
): Promise<{ error?: string }> {
  const id = String(tripId ?? '').trim();
  if (!id) return { error: 'Missing trip' };
  const now = new Date().toISOString();
  const entry = `[UPDATE|${step}|${now}|${message}]`;

  const { data: row, error: fetchError } = await supabase()
    .from('trips_driver_view')
    .select('instructions')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };

  const existing = (row as { instructions?: string | null } | null)?.instructions?.trim() || '';
  const { error } = await supabase()
    .from('trips')
    .update({ notes: existing ? `${existing}\n${entry}` : entry })
    .eq('id', id);

  return error ? { error: error.message } : {};
}
