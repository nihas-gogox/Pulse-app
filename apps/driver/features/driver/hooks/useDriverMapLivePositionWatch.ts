import type { LocationObject } from "expo-location";
import { useEffect, useRef } from "react";
import { startForegroundPositionWatch } from "../../../lib/safeForegroundPositionWatch";

export type DriverMapLiveFixArgs = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  position: LocationObject;
};

/**
 * Foreground GPS/watch updates for map UI only. Does not write to `driver_locations`;
 * DB persistence stays on {@link useDriverLocationStream} (write-only, no per-tick reads).
 */
export function useDriverMapLivePositionWatch(opts: {
  enabled: boolean;
  onFix: (args: DriverMapLiveFixArgs) => void;
}): void {
  const { enabled, onFix } = opts;
  const onFixRef = useRef(onFix);
  onFixRef.current = onFix;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let watchHandle: { remove: () => void } | null = null;

    void (async () => {
      try {
        const Location = await import("expo-location");
        const { status } = await Location.getForegroundPermissionsAsync();
        if (cancelled || status !== "granted") return;

        watchHandle = await startForegroundPositionWatch(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            // Higher than before so map UI / approach keys are not spammed every 2m.
            distanceInterval: 25,
          },
          (location) => {
            if (cancelled) return;
            onFixRef.current({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy ?? null,
              position: location,
            });
          },
        );
        if (cancelled) {
          watchHandle?.remove();
          watchHandle = null;
        }
      } catch {
        // Map still updates from adaptive ping ticks.
      }
    })();

    return () => {
      cancelled = true;
      watchHandle?.remove();
      watchHandle = null;
    };
  }, [enabled]);
}
