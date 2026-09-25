import { useMemo } from "react";
import type { TripRow } from "../services/trips.service";

export function useGPSDistanceEstimate(trip: TripRow | null): number | null {
  return useMemo(() => {
    if (!trip) return null;
    if (trip.gps_distance_km != null) return Number(trip.gps_distance_km) || null;
    if (trip.distance == null) return null;
    const parsed =
      typeof trip.distance === "number" ? trip.distance : Number.parseFloat(String(trip.distance));
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 10) / 10 : null;
  }, [trip]);
}
