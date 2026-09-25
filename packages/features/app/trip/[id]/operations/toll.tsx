import { CenteredLoadingView } from "@pulse/ui/components/CenteredLoadingView";
import { useAuth } from "@pulse/domain/contexts/AuthContext";
import { TollEntryScreen } from "../../../../features/trips/operations/toll/TollEntryScreen";
import { driverExpenseEntryHref } from "@pulse/domain/features/trips/operations/shared/driverExpenseCategoryNav.util";
import { getAccessibleTripById, type TripRow } from "@pulse/domain/features/trips/services/trips.service";
import { type Href, Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";

function readParam(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? "";
  return "";
}

function TripTollScreenRoute({
  tripId,
  entryId,
}: {
  tripId: string;
  entryId: string | null;
}) {
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void getAccessibleTripById(tripId).then((res) => {
      if (!mounted) return;
      setTrip(res.trip ?? null);
      setError(res.error ? res.error.message : res.trip ? null : "Trip not found.");
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [tripId]);

  return useMemo(() => {
    if (loading) return <CenteredLoadingView message="Loading toll entry..." />;
    if (error || !trip) {
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
          <Text style={{ color: "#64748b", fontSize: 14 }}>{error ?? "Trip not found"}</Text>
        </View>
      );
    }
    return <TollEntryScreen trip={trip} entryId={entryId} />;
  }, [entryId, error, loading, trip]);
}

export default function TripTollEntryRoute() {
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ id?: string | string[]; entryId?: string | string[] }>();
  const tripId = readParam(params.id);
  const entryId = readParam(params.entryId);

  if (!tripId) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
        <Text style={{ color: "#64748b", fontSize: 14 }}>Trip not found.</Text>
      </View>
    );
  }

  // Drivers use the unified expense form (fuel / toll / other chips).
  if (!entryId && profile?.role === "driver") {
    return (
      <Redirect href={driverExpenseEntryHref(tripId, { kind: "toll" }) as Href} />
    );
  }

  return <TripTollScreenRoute tripId={tripId} entryId={entryId || null} />;
}
