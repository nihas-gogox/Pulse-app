import { useEffect, useRef } from "react";
import type { TripRow } from "@pulse/domain/features/trips/services/trips.service";
import type { DriverLocationSource } from "@pulse/domain/features/driver/services/driverLocation.service";
import {
  LONG_HAUL_STANDARD_PINGS,
  adaptivePingRoutePlanKey,
  calculateNextPingInterval,
  estimateTripEtaMsFromRow,
  fetchLongHaulHealthStatus,
  resolveTotalEtaMsForAdaptivePing,
} from "../utils/calculateNextPingInterval";
import { isTripStatusEligibleForLongHaulPings } from "../utils/long_haul_heartbeat.util";

export interface AdaptiveTripLocationPingLoopParams {
  driver: { id: string; organization_id: string } | null;
  trip: TripRow | null;
  enabled: boolean;
  /** When true, eligible GPS fixes are written to `driver_locations` (and chat mirror server-side). */
  shouldPersistCheckpoint: boolean;
  /** Skip DB write if moved less than this many metres since last successful write; `null` = always send when persisting. */
  minDisplacementM: number | null;
  source: DriverLocationSource;
  reportLocationToDb: (
    tripId: string | null,
    lat: number,
    lng: number,
    accuracy: number | null,
    source: DriverLocationSource,
    extras?: { odometerKm?: number | null; recordedAt?: string },
  ) => Promise<boolean | void>;
  /** Called on every successful GPS read (map / heading), even when DB write is skipped. */
  onLocationFix: (args: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    position: { coords: { latitude: number; longitude: number; heading?: number | null } };
  }) => void;
  /** Skip `v_long_haul_health` read on every tick (location stream uses ETA-only pacing). */
  skipHealthFetchOnTick?: boolean;
  /** Do not await DB write before scheduling the next ping. */
  reportFireAndForget?: boolean;
}

/**
 * Replaces fixed-interval location checkpoints with adaptive spacing:
 * `total_eta / remaining_pings`, 50% faster cadence when `LATE_RISK`, stretch at 3h after 12 pings.
 */
export function useAdaptiveTripLocationPingLoop(params: AdaptiveTripLocationPingLoopParams): void {
  const {
    driver,
    trip,
    enabled,
    shouldPersistCheckpoint,
    minDisplacementM,
    source,
    reportLocationToDb,
    onLocationFix,
    skipHealthFetchOnTick = false,
    reportFireAndForget = false,
  } = params;

  const reportRef = useRef(reportLocationToDb);
  const fixRef = useRef(onLocationFix);
  reportRef.current = reportLocationToDb;
  fixRef.current = onLocationFix;

  const lastSentRef = useRef<{ lat: number; lng: number } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingsUsedRef = useRef(0);
  const stretchRef = useRef(false);
  const healthRef = useRef<string | null>(null);
  const tripIdRef = useRef<string | null>(null);
  const totalEtaMsRef = useRef(estimateTripEtaMsFromRow(null));
  const routePlanKeyRef = useRef<string>("");

  useEffect(() => {
    const tid = trip?.id ?? null;
    if (tid !== tripIdRef.current) {
      tripIdRef.current = tid;
      lastSentRef.current = null;
      pingsUsedRef.current = 0;
      stretchRef.current = false;
      healthRef.current = null;
      routePlanKeyRef.current = "";
      totalEtaMsRef.current = estimateTripEtaMsFromRow(trip ?? null);
    }
  }, [trip?.id]);

  useEffect(() => {
    if (!trip?.id) {
      totalEtaMsRef.current = estimateTripEtaMsFromRow(null);
      routePlanKeyRef.current = "";
      return;
    }
    const key = adaptivePingRoutePlanKey(trip);
    if (!key || key === routePlanKeyRef.current) return;
    routePlanKeyRef.current = key;
    totalEtaMsRef.current = estimateTripEtaMsFromRow(trip);
    let cancelled = false;
    const captured = key;
    void resolveTotalEtaMsForAdaptivePing(trip).then((ms) => {
      if (!cancelled && adaptivePingRoutePlanKey(trip) === captured) {
        totalEtaMsRef.current = ms;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [trip?.id, trip?.pickup_lat, trip?.pickup_lon, trip?.drop_lat, trip?.drop_lon, trip?.distance]);

  useEffect(() => {
    let cancelled = false;

    const clearTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    if (!enabled || !driver || !trip?.id) {
      clearTimer();
      lastSentRef.current = null;
      return;
    }

    const minM =
      minDisplacementM == null || !Number.isFinite(minDisplacementM)
        ? null
        : Math.max(0, minDisplacementM);

    const distanceMeters = (
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number,
    ): number => {
      const R = 6_371_000;
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
    };

    const schedule = (ms: number) => {
      clearTimer();
      const clamped = Math.max(5_000, Math.min(ms, 8 * 60 * 60 * 1000));
      timeoutRef.current = setTimeout(() => void tick(), clamped);
    };

    const tick = async () => {
      if (cancelled || !trip?.id) return;
      let nextMs = 120_000;
      try {
        const Location = await import("expo-location");
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") {
          schedule(120_000);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = pos.coords;
        const acc = pos.coords.accuracy ?? null;

        fixRef.current({ latitude, longitude, accuracy: acc, position: pos });

        if (!shouldPersistCheckpoint) {
          schedule(90_000);
          return;
        }

        let health = healthRef.current;
        if (
          !skipHealthFetchOnTick &&
          isTripStatusEligibleForLongHaulPings(trip.status)
        ) {
          const h = await fetchLongHaulHealthStatus(trip.id);
          if (!cancelled && h) healthRef.current = h;
          if (h) health = h;
        }

        const stretch = stretchRef.current;
        const remaining = stretch ? 1 : Math.max(1, LONG_HAUL_STANDARD_PINGS - pingsUsedRef.current);
        const totalEtaMs = totalEtaMsRef.current;
        nextMs = calculateNextPingInterval({
          totalEtaMs,
          remainingPings: remaining,
          healthStatus: health,
          stretchMode: stretch,
        });

        const last = lastSentRef.current;
        const dispOk =
          minM == null ||
          !last ||
          distanceMeters(last.lat, last.lng, latitude, longitude) >= minM;

        if (dispOk) {
          if (cancelled) return;
          const recordedAt = new Date().toISOString();
          if (reportFireAndForget) {
            void reportRef.current(trip.id, latitude, longitude, acc, source, {
              odometerKm: null,
              recordedAt,
            });
            lastSentRef.current = { lat: latitude, lng: longitude };
            if (isTripStatusEligibleForLongHaulPings(trip.status)) {
              pingsUsedRef.current += 1;
              if (pingsUsedRef.current >= LONG_HAUL_STANDARD_PINGS) {
                stretchRef.current = true;
              }
            }
          } else {
            const ok = await reportRef.current(trip.id, latitude, longitude, acc, source, {
              odometerKm: null,
              recordedAt,
            });
            const saved = ok !== false;
            if (saved) {
              lastSentRef.current = { lat: latitude, lng: longitude };
              if (isTripStatusEligibleForLongHaulPings(trip.status)) {
                pingsUsedRef.current += 1;
                if (pingsUsedRef.current >= LONG_HAUL_STANDARD_PINGS) {
                  stretchRef.current = true;
                }
              }
            }
          }
        }

        schedule(nextMs);
      } catch {
        schedule(120_000);
      }
    };

    void tick();

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [
    driver?.id,
    driver?.organization_id,
    enabled,
    trip?.id,
    trip?.status,
    trip?.distance,
    shouldPersistCheckpoint,
    minDisplacementM,
    source,
    skipHealthFetchOnTick,
    reportFireAndForget,
  ]);
}
