/**
 * Module bus for live driver GPS — avoids React setState on every fix.
 * Imperative consumers (camera, markers) subscribe; React commits are throttled separately.
 */

export type DriverLiveLatLng = { latitude: number; longitude: number };

type Listener = (pos: DriverLiveLatLng | null) => void;

let current: DriverLiveLatLng | null = null;
const listeners = new Set<Listener>();

export function getDriverLivePosition(): DriverLiveLatLng | null {
  return current;
}

export function setDriverLivePosition(pos: DriverLiveLatLng | null): void {
  current = pos;
  listeners.forEach((l) => {
    try {
      l(pos);
    } catch {
      /* ignore */
    }
  });
}

export function subscribeDriverLivePosition(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True if React should re-commit (first fix, force, moved ≥ minM, or age ≥ minMs). */
export function shouldCommitDriverMapPosition(opts: {
  prev: DriverLiveLatLng | null;
  next: DriverLiveLatLng;
  lastCommitAt: number;
  now?: number;
  minDisplacementM?: number;
  minIntervalMs?: number;
  force?: boolean;
}): boolean {
  const {
    prev,
    next,
    lastCommitAt,
    force,
    minDisplacementM = 40,
    minIntervalMs = 4000,
  } = opts;
  const now = opts.now ?? Date.now();
  if (force) return true;
  if (!prev) return true;
  if (now - lastCommitAt >= minIntervalMs) return true;
  const dlat = next.latitude - prev.latitude;
  const dlng = next.longitude - prev.longitude;
  // Rough metres at mid-latitudes (~111km per degree).
  const movedM = Math.sqrt(dlat * dlat + dlng * dlng) * 111_000;
  return movedM >= minDisplacementM;
}
