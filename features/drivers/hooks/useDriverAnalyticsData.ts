import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LedgerRow } from "@/features/finance";
import {
  getDriverDetailBundle,
  getDriverOffersByOrganization,
  type DriverRow,
} from "@/features/drivers/services/drivers.service";
import type { SalaryRequestRow } from "@/features/drivers/services/salaryRequests.service";
import type { RatingRow } from "@/features/ratings/services/ratings.service";
import { getTripsForOrg, type TripRow } from "@/features/trips/services/trips.service";
import { queryKeys } from "@/lib/queryKeys";

export function useDriverAnalyticsData(driverId: string) {
  const { t } = useLanguage();
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [driverTransactions, setDriverTransactions] = useState<LedgerRow[]>([]);
  const [driverRequests, setDriverRequests] = useState<SalaryRequestRow[]>([]);
  const [driverRatings, setDriverRatings] = useState<RatingRow[]>([]);
  const [driverOffer, setDriverOffer] = useState<{
    payableAmount: number | null;
    commissionPercent: number | null;
    commissionPerKm: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const isRefreshingRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  const load = useCallback(() => {
    if (!driverId || !currentOrganization?.id) {
      setLoading(false);
      return;
    }
    if (!isRefreshingRef.current && !initialLoadDoneRef.current) setLoading(true);
    setError(null);
    const orgId = currentOrganization.id;
    // Reuse Trips tab cache — avoid a second get_trips_for_org round-trip.
    const tripsPromise = queryClient.ensureQueryData({
      queryKey: queryKeys.trips.finite(orgId),
      queryFn: async () => {
        const res = await getTripsForOrg(orgId);
        if (res.error) throw res.error;
        return res.trips;
      },
    });

    Promise.all([
      getDriverDetailBundle(orgId, driverId),
      tripsPromise,
      getDriverOffersByOrganization(orgId),
    ])
      .then(([bundleRes, allTrips, offersRes]) => {
        const driverRow = bundleRes.error ? null : (bundleRes.driver ?? null);
        if (bundleRes.error) {
          setError(bundleRes.error.message);
          setDriver(null);
          setTrips([]);
          setDriverTransactions([]);
          return;
        }
        setDriver(driverRow);
        const txs = (bundleRes.transactions ?? []) as LedgerRow[];
        const tripIdsFromDriverTx = new Set(
          txs
            .filter(
              (tx) =>
                tx.contact_type === "driver" &&
                tx.contact_id != null &&
                String(tx.contact_id).trim() === String(driverId).trim() &&
                tx.trip_id != null,
            )
            .map((tx) => String(tx.trip_id).trim().toLowerCase()),
        );
        const tripMatchesDriver = (trip: TripRow) => {
          if (trip.driver_id === driverId) return true;
          if (tripIdsFromDriverTx.has(String(trip.id).trim().toLowerCase())) return true;
          if (!driverRow) return false;
          const displayName = (trip.driver_display_name ?? "").trim();
          if (!displayName) return false;
          const nameMatch =
            (driverRow.name ?? "").trim().toLowerCase() === displayName.toLowerCase();
          const phoneNorm = (p: string) => (p ?? "").replace(/\s/g, "").replace(/\D/g, "");
          const phoneMatch =
            (driverRow.phone ?? "").trim() !== "" &&
            phoneNorm(displayName).length >= 10 &&
            phoneNorm(driverRow.phone ?? "") === phoneNorm(displayName);
          return nameMatch || phoneMatch;
        };
        setTrips(allTrips.filter(tripMatchesDriver));
        setDriverRatings(bundleRes.ratings ?? []);
        setDriverRequests(
          (bundleRes.salaryRequests as SalaryRequestRow[]).filter((r) => r.status === "pending"),
        );
        const offer = offersRes.error ? undefined : offersRes.offersByDriverId?.[driverId];
        setDriverOffer(
          offer
            ? {
                payableAmount: offer.payableAmount ?? null,
                commissionPercent: offer.commissionPercent ?? null,
                commissionPerKm: offer.commissionPerKm ?? null,
              }
            : null,
        );
        setDriverTransactions(bundleRes.transactions ?? []);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load driver analytics");
      })
      .finally(() => {
        setLoading(false);
        initialLoadDoneRef.current = true;
        isRefreshingRef.current = false;
        setRefreshing(false);
      });
  }, [driverId, currentOrganization?.id, queryClient]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = useCallback(() => {
    isRefreshingRef.current = true;
    setRefreshing(true);
    load();
  }, [load]);

  return {
    t,
    driver,
    displayName: (driver?.name ?? "").trim() || t("driver"),
    trips,
    driverTransactions,
    driverRequests,
    driverOffer,
    driverRatings,
    orgId: currentOrganization?.id ?? null,
    loading,
    error,
    refreshing,
    refresh,
  };
}
