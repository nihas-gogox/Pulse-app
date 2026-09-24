import { useState, useCallback, useEffect } from "react";
import * as driverLocationService from "@pulse/domain/features/driver/services/driverLocation.service";
import { resolveMapLocationLabel } from "@pulse/domain/lib/mapLocationLabel.service";
import { TRIP_TRACKING_HISTORY_FETCH_LIMIT } from "@pulse/core/lib/trackingLocation.constants";
import { subscribeSharedPostgresChanges } from "@pulse/core/lib/realtimeRegistry";
import { useAuth } from "@pulse/domain/contexts/AuthContext";

export function useDriverLocation(tripId: string | undefined) {
  const { status } = useAuth();
  const [driverLocation, setDriverLocation] =
    useState<driverLocationService.DriverLocationRow | null>(null);
  const [driverLocationLoading, setDriverLocationLoading] = useState(false);
  const [tripLocationPoints, setTripLocationPoints] = useState<
    { latitude: number; longitude: number; recorded_at: string }[]
  >([]);
  const [driverLocationAddress, setDriverLocationAddress] = useState<
    string | null
  >(null);

  const fetchDriverLocationFromDb = useCallback(async () => {
    if (!tripId || status === "restoring") return;
    setDriverLocationLoading(true);
    try {
      const [locRes, histRes] = await Promise.all([
        driverLocationService.getLatestDriverLocationForTrip(tripId),
        driverLocationService.getTripLocationHistory(
          tripId,
          TRIP_TRACKING_HISTORY_FETCH_LIMIT,
        ),
      ]);
      setDriverLocation(locRes.error ? null : locRes.location ?? null);
      setTripLocationPoints(histRes.error ? [] : histRes.points ?? []);
    } catch {
      setDriverLocation(null);
      setTripLocationPoints([]);
    } finally {
      setDriverLocationLoading(false);
    }
  }, [tripId, status]);

  useEffect(() => {
    if (!tripId || status === "restoring") return;

    // Initial fetch (location + history)
    fetchDriverLocationFromDb();

    // Realtime subscription for live location updates — replaces 30s polling.
    // Shared registry channel (ref-counted, cap/grace/prune) instead of a
    // private per-hook channel; same filter + payload handling.
    return subscribeSharedPostgresChanges(
      `driver_location:${tripId}`,
      [
        {
          event: '*',
          schema: 'public',
          table: 'driver_locations',
          filter: `trip_id=eq.${tripId}`,
        },
      ],
      (payload) => {
        if (payload.new && typeof payload.new === 'object') {
          setDriverLocation(payload.new as driverLocationService.DriverLocationRow);
        }
      },
    );
  }, [tripId, status, fetchDriverLocationFromDb]);

  useEffect(() => {
    if (!driverLocation) {
      setDriverLocationAddress(null);
      return;
    }
    let cancelled = false;
    void resolveMapLocationLabel(
      driverLocation.latitude,
      driverLocation.longitude,
      { mode: "full" },
    ).then((label) => {
      if (!cancelled) setDriverLocationAddress(label);
    });
    return () => {
      cancelled = true;
    };
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  return {
    driverLocation,
    driverLocationLoading,
    tripLocationPoints,
    driverLocationAddress,
    fetchDriverLocationFromDb,
  };
}
