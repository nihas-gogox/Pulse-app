import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";

import { useAuth } from "@pulse/domain/contexts/AuthContext";
import { useDriverTripOpsActions } from "../features/driver/hooks/useDriverTripOpsActions";
import {
  driverOpsTripCapabilities,
  resolveDriverOpsActiveTrip,
} from "../features/driver/utils/driverActiveOpsTrip.util";
import * as tripsService from "@pulse/domain/features/trips/services/trips.service";
import { useDriverUiTripsQuery } from "@pulse/domain/lib/queries/useDriverUiTripsQuery";
import { usePendingOtpTripsQuery } from "@pulse/domain/lib/queries/usePendingOtpTripsQuery";
import { ROUTES } from "@pulse/core/lib/routes";

const DRIVER_ACCEPTED_TRIP_ID_KEY = "driver_accepted_trip_id";

type DriverTripOpsContextValue = {
  hasTargetTrip: boolean;
  showExpenseOps: boolean;
  showOdometerOps: boolean;
  /** Short route/label for the expense capture card. */
  activeTripSummary: string | null;
  openExpense: () => void;
  openTripExpense: () => void;
  openOdometer: () => void;
  registerContextTrip: (trip: tripsService.TripRow | null) => void;
};

const DriverTripOpsContext = createContext<DriverTripOpsContextValue | null>(null);

export function DriverTripOpsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { profile } = useAuth();
  const uid = profile?.uid ?? null;
  const pendingOtpQuery = usePendingOtpTripsQuery(uid);
  const tripsQuery = useDriverUiTripsQuery(uid, !!uid);

  const [acceptedTripId, setAcceptedTripId] = useState<string | null>(null);
  const [contextTrip, setContextTrip] = useState<tripsService.TripRow | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void AsyncStorage.getItem(DRIVER_ACCEPTED_TRIP_ID_KEY).then((id) => {
        if (!cancelled) setAcceptedTripId(id?.trim() ? id : null);
      });
      void tripsQuery.refetch();
      return () => {
        cancelled = true;
      };
    }, [tripsQuery.refetch]),
  );

  const allTrips = tripsQuery.trips;
  const pendingTrips = pendingOtpQuery.pendingTrips;

  const activeTrip = useMemo(
    () => resolveDriverOpsActiveTrip({ trips: allTrips, pendingTrips, acceptedTripId }),
    [acceptedTripId, allTrips, pendingTrips],
  );

  const targetTrip = activeTrip ?? contextTrip;

  const baseOps = useDriverTripOpsActions({
    trips: allTrips,
    pendingTrips,
    acceptedTripId,
    activeTrip: targetTrip,
  });

  const caps = useMemo(() => driverOpsTripCapabilities(targetTrip), [targetTrip]);

  const registerContextTrip = useCallback((trip: tripsService.TripRow | null) => {
    setContextTrip(trip);
  }, []);

  const alertNoActiveTrip = useCallback(() => {
    Alert.alert(
      "No active trip",
      "Accept or start a delivery to log expenses for that trip.",
      [
        {
          text: "Open History",
          onPress: () => router.push("/(driver)/trip-history" as never),
        },
        { text: "OK", style: "cancel" },
      ],
    );
  }, [router]);

  const openTripExpense = useCallback(() => {
    if (!targetTrip?.id) {
      alertNoActiveTrip();
      return;
    }
    // Always attach to the active / context trip while delivery is incomplete.
    router.push(ROUTES.tripOtherExpenseEntry(targetTrip.id) as never);
  }, [alertNoActiveTrip, router, targetTrip?.id]);

  const openExpense = openTripExpense;

  const openOdometer = useCallback(() => {
    if (!targetTrip?.id) {
      alertNoActiveTrip();
      return;
    }
    if (!caps.showOdometer) {
      Alert.alert(
        "Odometer not available",
        "Odometer readings apply to asset fleet trips only.",
        [{ text: "OK" }],
      );
      return;
    }
    baseOps.openOdometer();
  }, [alertNoActiveTrip, baseOps, caps.showOdometer, targetTrip?.id]);

  const activeTripSummary = useMemo(() => {
    if (!targetTrip?.id) return null;
    const from = targetTrip.pickup_area?.trim() || "Origin";
    const to = targetTrip.drop_location?.trim() || "Destination";
    return `${from} → ${to}`;
  }, [targetTrip]);

  const value = useMemo<DriverTripOpsContextValue>(
    () => ({
      hasTargetTrip: Boolean(targetTrip?.id),
      showExpenseOps: Boolean(targetTrip?.id),
      showOdometerOps: caps.showOdometer,
      activeTripSummary,
      openExpense,
      openTripExpense,
      openOdometer,
      registerContextTrip,
    }),
    [
      activeTripSummary,
      caps.showOdometer,
      openExpense,
      openOdometer,
      openTripExpense,
      registerContextTrip,
      targetTrip?.id,
    ],
  );

  return (
    <DriverTripOpsContext.Provider value={value}>
      {children}
    </DriverTripOpsContext.Provider>
  );
}

export function useDriverTripOps() {
  const ctx = useContext(DriverTripOpsContext);
  if (!ctx) {
    throw new Error("useDriverTripOps must be used within DriverTripOpsProvider");
  }
  return ctx;
}

/** Optional hook for screens outside provider (should not happen in driver app). */
export function useOptionalDriverTripOps() {
  return useContext(DriverTripOpsContext);
}

export function useRegisterDriverContextTrip(trip: tripsService.TripRow | null | undefined) {
  const ctx = useOptionalDriverTripOps();
  useFocusEffect(
    useCallback(() => {
      if (!ctx) return undefined;
      ctx.registerContextTrip(trip ?? null);
      return () => ctx.registerContextTrip(null);
    }, [ctx, trip]),
  );
}
