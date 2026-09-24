import { useCallback, useMemo } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";

import {
  driverOpsTripCapabilities,
  resolveDefaultOdometerVerificationSide,
  resolveDriverOpsActiveTrip,
} from "../utils/driverActiveOpsTrip.util";
import type { TripRow } from "@pulse/domain/features/trips/services/trips.service";
import { ROUTES } from "@pulse/core/lib/routes";

type Options = {
  trips: TripRow[];
  pendingTrips?: TripRow[];
  acceptedTripId?: string | null;
  /** Optional explicit override (e.g. dashboard focus trip). */
  activeTrip?: TripRow | null;
};

export function useDriverTripOpsActions({
  trips,
  pendingTrips,
  acceptedTripId,
  activeTrip,
}: Options) {
  const router = useRouter();

  const resolvedActiveTrip = useMemo(
    () =>
      activeTrip ??
      resolveDriverOpsActiveTrip({ trips, pendingTrips, acceptedTripId }),
    [activeTrip, trips, pendingTrips, acceptedTripId],
  );

  const activeTripId = resolvedActiveTrip?.id ?? null;
  const caps = useMemo(
    () => driverOpsTripCapabilities(resolvedActiveTrip),
    [resolvedActiveTrip],
  );

  const alertNoActiveTrip = useCallback(() => {
    Alert.alert(
      "No active trip",
      "Accept or start a trip before logging expenses or odometer readings. For completed trips, open the trip from Trips and use Add expense or Odometer there.",
      [{ text: "OK" }],
    );
  }, []);

  const alertUnsupportedTrip = useCallback((kind: "expense" | "odometer") => {
    Alert.alert(
      kind === "expense" ? "Expense not available" : "Odometer not available",
      kind === "expense"
        ? "This trip type does not support in-app expense logging."
        : "Odometer readings apply to asset fleet trips only.",
      [{ text: "OK" }],
    );
  }, []);

  const openExpense = useCallback(() => {
    if (!activeTripId) {
      alertNoActiveTrip();
      return;
    }
    if (!caps.showExpense) {
      alertUnsupportedTrip("expense");
      return;
    }
    router.push(ROUTES.tripOtherExpenseEntry(activeTripId) as never);
  }, [activeTripId, alertNoActiveTrip, alertUnsupportedTrip, caps.showExpense, router]);

  const openOdometer = useCallback(() => {
    if (!activeTripId) {
      alertNoActiveTrip();
      return;
    }
    if (!caps.showOdometer) {
      alertUnsupportedTrip("odometer");
      return;
    }
    const side = resolveDefaultOdometerVerificationSide(resolvedActiveTrip);
    router.push(ROUTES.tripVerification(activeTripId, side) as never);
  }, [
    activeTripId,
    alertNoActiveTrip,
    alertUnsupportedTrip,
    caps.showOdometer,
    resolvedActiveTrip,
    router,
  ]);

  return {
    activeTrip: resolvedActiveTrip,
    activeTripId,
    caps,
    openExpense,
    openOdometer,
  };
}
