import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LedgerRow } from "@/features/finance";
import { fetchClientPageBootstrap } from "@/features/clients/services/clientPageBootstrap.service";
import { useFinanceAlignedClientLedger } from "@/features/finance/hooks/useFinanceAlignedPartyTrips";
import type { ClientRow } from "@/features/clients/services/clients.service";
import type { TripRow } from "@/features/trips/services/trips.service";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/contexts/AuthContext";

export function useClientAnalyticsData(clientId: string) {
  const { t } = useLanguage();
  const { currentOrganization } = useOrganization();
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const [client, setClient] = useState<ClientRow | null>(null);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const financeAligned = useFinanceAlignedClientLedger(
    currentOrganization?.id ?? null,
    clientId,
  );
  const [transactions, setTransactions] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const isRefreshingRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  const load = useCallback(() => {
    if (!clientId || !currentOrganization?.id || status === "restoring") {
      setLoading(false);
      return;
    }
    if (!isRefreshingRef.current && !initialLoadDoneRef.current) setLoading(true);
    setError(null);
    const orgId = currentOrganization.id;

    const finish = () => {
      setLoading(false);
      initialLoadDoneRef.current = true;
      isRefreshingRef.current = false;
      setRefreshing(false);
    };

    const cached = queryClient.getQueryData<{
      client: ClientRow;
      trips: TripRow[];
      transactions: LedgerRow[];
    }>(queryKeys.clients.pageBootstrap(orgId, clientId));
    if (cached?.client) {
      setClient(cached.client);
      if (!financeAligned.ready) setTrips(cached.trips ?? []);
      setTransactions(cached.transactions ?? []);
      setLoading(false);
    }

    queryClient
      .fetchQuery({
        queryKey: queryKeys.clients.pageBootstrap(orgId, clientId),
        queryFn: async () => {
          const r = await fetchClientPageBootstrap(orgId, clientId);
          if (r.error) throw r.error;
          return r.bundle;
        },
        staleTime: 60_000,
      })
      .then((bundle) => {
        if (bundle?.client) {
          setClient(bundle.client);
          if (!financeAligned.ready) setTrips(bundle.trips);
          setTransactions(bundle.transactions);
        } else if (!cached?.client) {
          setError("Client not found");
        }
      })
      .catch((err: unknown) => {
        if (!cached?.client) {
          setError(err instanceof Error ? err.message : "Failed to load client analytics");
        }
      })
      .finally(finish);
  }, [clientId, currentOrganization?.id, status, queryClient]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!financeAligned.ready) return;
    setTrips(financeAligned.trips);
  }, [financeAligned.ready, financeAligned.trips]);

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

  const displayName =
    (client?.name || client?.contact_person || "").trim() || t("client");

  return {
    t,
    client,
    displayName,
    trips,
    transactions,
    orgId: currentOrganization?.id ?? null,
    loading,
    error,
    refreshing,
    refresh,
  };
}
