/**
 * Geo/distance/ETA formatting helpers, moved verbatim from
 * DriverHomeScreen.tsx. Pure functions of coordinates/seconds/km values —
 * distance and ETA themselves still depend on a live route fetch (driver's
 * current position + routing API result), not on the trip row alone, so
 * there is no single `getTripStage(trip).eta` shortcut yet; callers compute
 * the route separately and format the result with these.
 */

/** Approximate distance in metres between two WGS84 points (Haversine-style). */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000; // Earth radius in metres
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Approx initial bearing (degrees 0-360) from one lat/lon to another. */
export function bearingDegrees(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number | null {
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const theta = Math.atan2(y, x);
  const deg = (theta * 180) / Math.PI;
  if (!Number.isFinite(deg)) return null;
  return (deg + 360) % 360;
}

/** Keep fitToCoordinates responsive on long hauls (many vertices). */
export function subsampleRouteCoordinates<
  T extends { latitude: number; longitude: number },
>(coords: T[], maxPoints: number): T[] {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const out: T[] = [];
  for (let i = 0; i < coords.length; i += step) out.push(coords[i]);
  const last = coords[coords.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

export function formatRoadDistanceM(meters: number): string {
  const km = meters / 1000;
  if (!Number.isFinite(km) || km < 0) return "—";
  return `${km.toFixed(1)} km`;
}

/** ETA from routing API remaining duration (seconds). */
export function formatEtaFromRouteSeconds(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const totalMin = Math.max(1, Math.round(seconds / 60));
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

export function formatEtaArrivalClock(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  try {
    const d = new Date(Date.now() + seconds * 1000);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return null;
  }
}

export function formatTripDistance(distance: unknown): string {
  if (distance == null) return "—";
  const raw = typeof distance === "string" ? distance.trim() : "";
  if (typeof distance === "string" && raw === "") return "—";

  // DB can return numeric km; other flows may return strings like "980 km" or "1,420 KM".
  const km =
    typeof distance === "number"
      ? distance
      : (() => {
          const n = parseFloat(
            String(distance)
              .replace(/,/g, "")
              .replace(/[^0-9.]/g, ""),
          );
          return Number.isFinite(n) ? n : NaN;
        })();

  if (!Number.isFinite(km) || km < 0) return "—";
  return `${Math.round(km).toLocaleString("en-IN")} km`;
}
