/**
 * Per-trip driver-control progress markers, stored locally on device.
 *
 * The driver flow has a local-only "LR" sub-step ("Package collected" → upload
 * Lorry Receipt) that sits between server statuses `in_progress` (pickup) and
 * `in_transit`. The server trip status does NOT change when the driver taps
 * "Package collected" (LR can be uploaded at any stage and must not mutate trip
 * status), so this phase has no server representation.
 *
 * Without persistence, any remount / background status re-sync re-derives the
 * step purely from server status (`in_progress` → "pickup") and throws the
 * driver back onto the "Package collected" screen. We persist the LR-phase
 * entry here so the step survives remounts and only changes on explicit driver
 * action. Not synced to Supabase — a private, device-local UI marker.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const LR_PHASE_KEY = (tripId: string) => `q.tripControl.lrPhase.v1:${tripId}`;

/** Mark that the driver has confirmed "Package collected" for this trip. */
export async function markLrPhaseEntered(tripId: string): Promise<void> {
  if (!tripId) return;
  try {
    await AsyncStorage.setItem(LR_PHASE_KEY(tripId), "1");
  } catch {
    // Best-effort marker; a write failure just means the step won't be
    // restored after a remount (pre-existing behaviour), never a crash.
  }
}

/** True when the driver has already entered the LR phase for this trip. */
export async function hasEnteredLrPhase(tripId: string): Promise<boolean> {
  if (!tripId) return false;
  try {
    return (await AsyncStorage.getItem(LR_PHASE_KEY(tripId))) === "1";
  } catch {
    return false;
  }
}

/** Clear the marker once the trip advances past the LR phase (transit+). */
export async function clearLrPhase(tripId: string): Promise<void> {
  if (!tripId) return;
  try {
    await AsyncStorage.removeItem(LR_PHASE_KEY(tripId));
  } catch {
    // Best-effort cleanup; stale markers are harmless (only consulted while
    // server status is still pickup/in_progress).
  }
}
