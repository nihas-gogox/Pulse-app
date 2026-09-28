import { useMemo } from "react";
import { aggregateCustomersFromRpc } from "@/features/finance/aggregation/aggregateCustomersFromRpc";
import { allocateAmountsToLargestDueTrips } from "@/features/finance/utils/allocateToLargestDue";
import { useSuppliersQuery, useTripsQuery, useTripsWhereOrgIsClientQuery } from "@/lib/queries";
import { useCustomerLedgerInputsQuery, useSupplierLedgerAggregationQuery } from "@/lib/queries/useLedgerAggregationQuery";
import { buildUniqueLinkedOrgIdMap, isLoadBasedTrip } from "@/features/trips/visibility/tripVisibility";
import type { TripRow } from "@/features/trips/services/trips.service";
import { isDcoOperatingTrip } from "@/features/trips/domain/tripDcoOperating";

export function useFinanceAlignedClientLedger(
  orgId: string | null,
  clientId: string | null,
) {
  const { data: inputs, isSuccess } = useCustomerLedgerInputsQuery(orgId, true);
  const { data: tripRows = [] } = useTripsQuery(orgId);

  return useMemo(() => {
    if (!isSuccess || !inputs || !clientId) {
      return {
        ready: false as const,
        trips: [] as TripRow[],
        tripIds: [] as string[],
        tripCount: 0,
        billed: 0,
        received: 0,
        pending: 0,
        salesByTripId: {} as Record<string, number>,
        paidByTripId: {} as Record<string, number>,
      };
    }
    const clientKey = clientId.trim().toLowerCase();
    const tripInputs = inputs.trip_inputs.filter(
      (row) => row.client_id.trim().toLowerCase() === clientKey,
    );
    const unlinked = inputs.unlinked_payments.filter(
      (row) => row.client_id.trim().toLowerCase() === clientKey,
    );
    const { rows } = aggregateCustomersFromRpc(
      [{ id: clientId, name: "" }],
      {
        ...inputs,
        trip_inputs: tripInputs,
        unlinked_payments: unlinked,
        ledger_only_parties: [],
      },
    );
    const summary = rows[0];
    const byId = new Map(tripRows.map((trip) => [trip.id, trip]));
    const trips = tripInputs
      .map((row) => byId.get(row.trip_id))
      .filter((trip): trip is TripRow => Boolean(trip));
    const allocated = allocateAmountsToLargestDueTrips(
      tripInputs.map((row) => ({
        tripId: row.trip_id,
        sales: row.sales,
        paid: row.initial_paid,
      })),
      unlinked.map((row) => row.amount_in),
    );
    const salesByTripId: Record<string, number> = {};
    for (const row of tripInputs) salesByTripId[row.trip_id] = row.sales;
    return {
      ready: true as const,
      trips,
      tripIds: tripInputs.map((row) => row.trip_id),
      tripCount: summary?.trips ?? tripInputs.length,
      billed: summary?.billed ?? 0,
      received: summary?.received ?? 0,
      pending: summary?.pending ?? 0,
      salesByTripId,
      paidByTripId: allocated,
    };
  }, [isSuccess, inputs, tripRows, clientId]);
}

export function useFinanceAlignedSupplierLedger(
  orgId: string | null,
  supplierId: string | null,
) {
  const { data: rpcRows = [], isSuccess } = useSupplierLedgerAggregationQuery(
    orgId,
    true,
  );
  const { data: tripRows = [] } = useTripsQuery(orgId);
  const { data: asClientTrips = [] } = useTripsWhereOrgIsClientQuery(orgId);
  const { data: suppliers = [] } = useSuppliersQuery(orgId);

  return useMemo(() => {
    if (!isSuccess || !supplierId || !orgId) {
      return {
        ready: false as const,
        trips: [] as TripRow[],
        tripCount: 0,
        due: 0,
        paid: 0,
        unsettled: 0,
      };
    }
    const financials = rpcRows.find((row) => row.supplier_id === supplierId);
    const uniqueLinked = buildUniqueLinkedOrgIdMap(suppliers);
    const own = tripRows.filter(
      (trip) =>
        trip.organization_id === orgId &&
        trip.supplier_id === supplierId &&
        !isDcoOperatingTrip(trip),
    );
    const seen = new Set(own.map((trip) => trip.id));
    const extra: TripRow[] = [];
    for (const trip of asClientTrips) {
      if (!isLoadBasedTrip(trip) || !trip.organization_id) continue;
      if (uniqueLinked.get(trip.organization_id) !== supplierId) continue;
      if (seen.has(trip.id)) continue;
      seen.add(trip.id);
      extra.push(trip);
    }
    return {
      ready: true as const,
      trips: [...own, ...extra],
      tripCount: financials?.trips_count ?? own.length + extra.length,
      due: financials?.due ?? 0,
      paid: financials?.paid ?? 0,
      unsettled: financials?.unsettled ?? 0,
    };
  }, [isSuccess, rpcRows, supplierId, orgId, tripRows, asClientTrips, suppliers]);
}
