/**
 * Ledger state and derived data for the Finance screen. Uses TanStack Query cache.
 */
import type { ClientRow } from "@/features/clients/services/clients.service";
import type { SupplierRow } from "@/features/suppliers/services/suppliers.service";
import {
    isAggregateExecutionTrip,
    isAssetExecutionTrip,
} from "@/features/trips/domain/tripExecutionModel";
import { getTripDisplayNumber, type TripRow } from "@/features/trips/services/trips.service";
import {
    buildUniqueLinkedOrgIdMap,
    isCrossOrgIntegrationTrip,
    isLoadBasedTrip,
} from "@/features/trips/visibility/tripVisibility";
import type { VehicleRow } from "@/features/vehicles/services/vehicles.service";
import { useTransactionsQuery, useTransactionTotalsQuery } from "@/lib/queries/useTransactionsQuery";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    filterLedgerByPeriod,
    type LedgerPeriodFilterOptions,
} from "../lib/filterLedgerByPeriod";
import { ledgerTotals } from "../lib/ledgerTotals";
import type { LedgerRow } from "../services/finance.service";
import {
    LEDGER_CATEGORIES,
    LEDGER_CATEGORY_STORAGE_KEY,
    type FinancePeriodFilter,
    type LedgerCategory,
    type LedgerSortKey,
} from "../types";

export interface UseFinanceLedgerArgs {
  organizationId: string | null;
  canAccess: boolean;
  tripRows: TripRow[];
  vehicleRows: VehicleRow[];
  clients?: ClientRow[];
  suppliers?: SupplierRow[];
}

export interface UseFinanceLedgerResult {
  ledgerTransactions: LedgerRow[] | null;
  ledgerLoading: boolean;
  ledgerFetchError: string | null;
  ledgerRefreshKey: number;
  setLedgerTransactions: React.Dispatch<
    React.SetStateAction<LedgerRow[] | null>
  >;
  setLedgerRefreshKey: (fn: (k: number) => number) => void;
  /** Refetch ledger and return a promise so callers can await and clear refresh state. */
  refetchLedger: () => Promise<unknown>;
  fetchNextLedgerPage: () => void;
  hasNextLedgerPage: boolean;
  ledgerPageLoading: boolean;
  financePeriodFilter: FinancePeriodFilter;
  setFinancePeriodFilter: (v: FinancePeriodFilter) => void;
  financeCustomRangeFrom: string | null;
  financeCustomRangeTo: string | null;
  setFinanceCustomRange: (from: string, to: string) => void;
  sourceSupplyFilter: "all" | "asset" | "aggregate";
  setSourceSupplyFilter: (v: "all" | "asset" | "aggregate") => void;
  ledgerSortKey: LedgerSortKey;
  setLedgerSortKey: (v: LedgerSortKey) => void;
  ledgerSortDir: "asc" | "desc";
  setLedgerSortDir: (v: "asc" | "desc") => void;
  selectedLedgerCategory: LedgerCategory;
  setSelectedLedgerCategory: (v: LedgerCategory) => void;
  cashDirectionFilter: "all" | "in" | "out";
  setCashDirectionFilter: (v: "all" | "in" | "out") => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filteredLedger: LedgerRow[];
  filteredLedgerBySource: LedgerRow[];
  filteredLedgerForDisplay: LedgerRow[];
  /** Kanban columns — period/source/search only (not ledger category or cash-in/out chips). */
  filteredLedgerForKanban: LedgerRow[];
  ledgerTotalsData: { totalIn: number; totalOut: number };
  ledgerCategoryCounts: Record<LedgerCategory, number>;
  selectedEntityTotals: {
    totalIn: number;
    totalOut: number;
    count: number;
  } | null;
  tripCountByParty: Record<string, number>;
  tripById: Map<string, TripRow>;
  getVehicleNumberForTripId: (tripId: string | null) => string | null;
  tripPartyMap: Record<
    string,
    {
      client_id?: string | null;
      supplier_id?: string | null;
      driver_id?: string | null;
    }
  >;
  tripDetailsMap: Record<
    string,
    {
      trip_number: string;
      drop_location?: string;
      pickup_area?: string;
      client_name?: string;
      pickup_date?: string | null;
      vehicle_number?: string | null;
      vehicle_type?: string | null;
      vehicle_body_type?: string | null;
      client_price?: number | null;
      supplier_rate?: number | null;
      /** Driver commission for driver statement (To pay). */
      driver_commission?: number | null;
      /** Resolved partner name for Cash/ledger when party_name on row is a placeholder. */
      supplier_display_name?: string | null;
    }
  >;
  clearFilters: () => void;
  isAnyFilterActive: boolean;
}

export function useFinanceLedger({
  organizationId,
  canAccess,
  tripRows,
  vehicleRows,
  clients,
  suppliers,
}: UseFinanceLedgerArgs): UseFinanceLedgerResult {
  const orgId = canAccess ? organizationId : null;
  const {
    data: ledgerTransactionsData,
    isLoading: ledgerQueryLoading,
    isError: ledgerQueryIsError,
    error: ledgerQueryError,
    refetch,
    isFetching: ledgerRefetching,
  } = useTransactionsQuery(orgId);
  const ledgerTransactions = ledgerTransactionsData ?? null;
  /** Unbounded fetch, used only for headline totals — see ledgerTotalsData below. */
  const { data: ledgerTotalsSourceData } = useTransactionTotalsQuery(orgId);
  /** isLoading — first fetch only; keeps cached rows visible while refetching. */
  const ledgerLoading = Boolean(orgId) && ledgerQueryLoading;
  const ledgerFetchError =
    ledgerQueryIsError && ledgerTransactions === null
      ? ledgerQueryError instanceof Error
        ? ledgerQueryError.message
        : "Ledger could not be loaded."
      : null;

  const [ledgerRefreshKey, setLedgerRefreshKeyState] = useState(0);
  const setLedgerRefreshKey = useCallback(
    (fn: (k: number) => number) => {
      setLedgerRefreshKeyState((prev) => fn(prev));
      refetch();
    },
    [refetch],
  );

  const refetchLedger = useCallback(() => refetch(), [refetch]);

  const [financePeriodFilter, setFinancePeriodFilter] =
    useState<FinancePeriodFilter>("RANGE");
  const [financeCustomRangeFrom, setFinanceCustomRangeFrom] = useState<
    string | null
  >(null);
  const [financeCustomRangeTo, setFinanceCustomRangeTo] = useState<
    string | null
  >(null);

  const setFinanceCustomRange = useCallback((from: string, to: string) => {
    setFinanceCustomRangeFrom(from.slice(0, 10));
    setFinanceCustomRangeTo(to.slice(0, 10));
    setFinancePeriodFilter("CUSTOM");
  }, []);

  const setFinancePeriodFilterWrapped = useCallback(
    (v: FinancePeriodFilter) => {
      if (v !== "CUSTOM") {
        setFinanceCustomRangeFrom(null);
        setFinanceCustomRangeTo(null);
      }
      setFinancePeriodFilter(v);
    },
    [],
  );
  const [sourceSupplyFilter, setSourceSupplyFilter] = useState<
    "all" | "asset" | "aggregate"
  >("all");
  const [ledgerSortKey, setLedgerSortKey] = useState<LedgerSortKey>("date");
  const [ledgerSortDir, setLedgerSortDir] = useState<"asc" | "desc">("desc");
  const [selectedLedgerCategory, setSelectedLedgerCategory] =
    useState<LedgerCategory>("all");
  const [cashDirectionFilter, setCashDirectionFilter] = useState<
    "all" | "in" | "out"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  const clearFilters = useCallback(() => {
    setFinancePeriodFilterWrapped("RANGE");
    setSourceSupplyFilter("all");
    setCashDirectionFilter("all");
    setSelectedLedgerCategory("all");
    setSearchQuery("");
  }, [setFinancePeriodFilterWrapped]);

  const periodOpts: LedgerPeriodFilterOptions = useMemo(
    () => ({
      customFrom: financeCustomRangeFrom,
      customTo: financeCustomRangeTo,
    }),
    [financeCustomRangeFrom, financeCustomRangeTo],
  );

  const isAnyFilterActive = useMemo(
    () =>
      financePeriodFilter !== "RANGE" ||
      sourceSupplyFilter !== "all" ||
      cashDirectionFilter !== "all" ||
      selectedLedgerCategory !== "all" ||
      searchQuery.trim() !== "",
    [
      financePeriodFilter,
      sourceSupplyFilter,
      cashDirectionFilter,
      selectedLedgerCategory,
      searchQuery,
    ],
  );

  useEffect(() => {
    AsyncStorage.getItem(LEDGER_CATEGORY_STORAGE_KEY).then((saved) => {
      if (
        saved != null &&
        (LEDGER_CATEGORIES as readonly string[]).includes(saved)
      ) {
        setSelectedLedgerCategory(saved as LedgerCategory);
      }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(LEDGER_CATEGORY_STORAGE_KEY, selectedLedgerCategory);
  }, [selectedLedgerCategory]);

  // When viewing Suppliers or Driver category, show all (in + out) so payouts are visible
  useEffect(() => {
    if (
      selectedLedgerCategory === "suppliers" ||
      selectedLedgerCategory === "driver"
    ) {
      setCashDirectionFilter("all");
    }
  }, [selectedLedgerCategory]);

  const filteredLedger = useMemo(
    () =>
      filterLedgerByPeriod(
        ledgerTransactions ?? [],
        financePeriodFilter,
        periodOpts,
      ),
    [ledgerTransactions, financePeriodFilter, periodOpts],
  );

  const tripCountByParty = useMemo(() => {
    const tripIdsByKey = new Map<string, Set<string>>();
    const txs = ledgerTransactions ?? [];
    for (const row of txs) {
      const key =
        row.contact_type &&
        (row.contact_type === "client" || row.contact_type === "supplier") &&
        row.contact_id
          ? row.contact_id
          : (row.party_name ?? "").trim().toLowerCase() || "—";
      if (!tripIdsByKey.has(key)) tripIdsByKey.set(key, new Set());
      if (row.trip_id) tripIdsByKey.get(key)!.add(row.trip_id);
    }
    const out: Record<string, number> = {};
    tripIdsByKey.forEach((set, k) => {
      out[k] = set.size;
    });
    return out;
  }, [ledgerTransactions]);

  const ledgerSearchLower = searchQuery.trim().toLowerCase();
  const tripById = useMemo(
    () => new Map(tripRows.map((t) => [t.id, t])),
    [tripRows],
  );
  const vehicleById = useMemo(
    () => new Map(vehicleRows.map((v) => [v.id, v])),
    [vehicleRows],
  );
  const tripVehicleNumberByTripId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const trip of tripRows) {
      const vehicleNumber = trip.vehicle_id
        ? vehicleById.get(trip.vehicle_id)?.vehicle_number ?? null
        : null;
      map.set(trip.id, vehicleNumber);
    }
    return map;
  }, [tripRows, vehicleById]);

  const getVehicleNumberForTripId = useCallback(
    (tripId: string | null): string | null => {
      if (!tripId) return null;
      return tripVehicleNumberByTripId.get(tripId) ?? null;
    },
    [tripVehicleNumberByTripId],
  );

  const tripPartyMap = useMemo(() => {
    const map: Record<
      string,
      {
        client_id?: string | null;
        supplier_id?: string | null;
        driver_id?: string | null;
      }
    > = {};
    const linkedClientIdByOrgId = buildUniqueLinkedOrgIdMap(clients ?? []);
    const linkedSupplierIdByOrgId = buildUniqueLinkedOrgIdMap(suppliers ?? []);

    for (let i = 0; i < tripRows.length; i++) {
      const t = tripRows[i];
      let cid = t.client_id ?? null;
      let sid = t.supplier_id ?? null;

      // Integration: cross-org load (indent) or aggregate partner trip — map to local client/supplier rows.
      if (isCrossOrgIntegrationTrip(t, organizationId)) {
        const ownerOrgId = t.organization_id!;
        const linkedCid = linkedClientIdByOrgId.get(ownerOrgId);
        if (linkedCid) cid = linkedCid;

        const linkedSid = linkedSupplierIdByOrgId.get(ownerOrgId);
        if (linkedSid) sid = linkedSid;
      }

      map[t.id] = {
        client_id: cid,
        supplier_id: sid,
        driver_id: t.driver_id ?? null,
      };
    }
    return map;
  }, [tripRows, clients, suppliers, organizationId]);

  const applySourceSupplyFilter = useCallback(
    (rows: LedgerRow[]) => {
      if (sourceSupplyFilter === "all") return rows;
      return rows.filter((r) => {
        if (!r.trip_id) {
          // Party-level postings without a trip link belong on aggregate cash view.
          return sourceSupplyFilter === "aggregate";
        }
        const trip = tripById.get(r.trip_id);
        if (!trip) return sourceSupplyFilter === "aggregate";
        const isAggregate = isAggregateExecutionTrip(trip);
        return sourceSupplyFilter === "aggregate"
          ? isAggregate
          : isAssetExecutionTrip(trip);
      });
    },
    [sourceSupplyFilter, tripById],
  );

  const filteredLedgerBySource = useMemo(
    () => applySourceSupplyFilter(filteredLedger),
    [filteredLedger, applySourceSupplyFilter],
  );

  /**
   * Headline totals, computed from the unbounded totals fetch (not the
   * capped display list) so they stay correct for orgs with more than 500
   * transactions — same period + source filters as the displayed ledger,
   * applied to the full transaction set.
   */
  const ledgerTotalsSource = useMemo(
    () =>
      filterLedgerByPeriod(
        ledgerTotalsSourceData ?? [],
        financePeriodFilter,
        periodOpts,
      ),
    [ledgerTotalsSourceData, financePeriodFilter, periodOpts],
  );
  const filteredLedgerTotalsBySource = useMemo(
    () => applySourceSupplyFilter(ledgerTotalsSource),
    [ledgerTotalsSource, applySourceSupplyFilter],
  );

  const ledgerRowsByCategory = useMemo(() => {
    const match = (
      r: { contact_type?: "client" | "supplier" | "driver" | "dco" | null },
      cat: LedgerCategory,
    ): boolean => {
      if (cat === "all") return true;
      const ct = r.contact_type;
      if (cat === "customers") return ct === "client";
      if (cat === "suppliers") return ct === "supplier" || ct === "dco";
      if (cat === "driver") return ct === "driver";
      if (cat === "vehicle") return ct != null ? false : true;
      return true;
    };
    return (base: LedgerRow[], cat: LedgerCategory) =>
      cat === "all" ? base : base.filter((r) => match(r, cat));
  }, []);

  const filteredLedgerForDisplay = useMemo(() => {
    let base = ledgerRowsByCategory(
      filteredLedgerBySource,
      selectedLedgerCategory,
    );
    if (cashDirectionFilter === "in") {
      base = base.filter((r) => (r.amount_in ?? 0) > 0);
    } else if (cashDirectionFilter === "out") {
      base = base.filter((r) => (r.amount_out ?? 0) > 0);
    }
    if (ledgerSearchLower) {
      base = base.filter(
        (r) =>
          (r.party_name || "").toLowerCase().includes(ledgerSearchLower) ||
          (r.description || "").toLowerCase().includes(ledgerSearchLower) ||
          (r.trip_number || "").toLowerCase().includes(ledgerSearchLower) ||
          (getVehicleNumberForTripId(r.trip_id ?? null) || "")
            .toLowerCase()
            .includes(ledgerSearchLower),
      );
    }
    const sorted = [...base].sort((a, b) => {
      const mult = ledgerSortDir === "asc" ? 1 : -1;
      if (ledgerSortKey === "entity") {
        const entityFor = (r: LedgerRow) =>
          (r.amount_out ?? 0) > 0
            ? getVehicleNumberForTripId(r.trip_id ?? null) || r.party_name || ""
            : r.party_name || "";
        const nameA = entityFor(a);
        const nameB = entityFor(b);
        const nameCmp = nameA.localeCompare(nameB, undefined, {
          sensitivity: "base",
        });
        if (nameCmp !== 0) return mult * nameCmp;
        return mult * (a.description || "").localeCompare(b.description || "");
      }
      if (ledgerSortKey === "source") {
        const sourceA =
          a.trip_number || getVehicleNumberForTripId(a.trip_id ?? null) || "";
        const sourceB =
          b.trip_number || getVehicleNumberForTripId(b.trip_id ?? null) || "";
        return mult * sourceA.localeCompare(sourceB);
      }
      if (ledgerSortKey === "cash_in") {
        return mult * ((a.amount_in ?? 0) - (b.amount_in ?? 0));
      }
      if (ledgerSortKey === "cash_out") {
        return mult * ((a.amount_out ?? 0) - (b.amount_out ?? 0));
      }
      const dateA = a.transaction_date || a.created_at || "";
      const dateB = b.transaction_date || b.created_at || "";
      return mult * dateA.localeCompare(dateB);
    });
    return sorted;
  }, [
    filteredLedgerBySource,
    ledgerRowsByCategory,
    selectedLedgerCategory,
    cashDirectionFilter,
    ledgerSearchLower,
    ledgerSortKey,
    ledgerSortDir,
    getVehicleNumberForTripId,
  ]);

  const filteredLedgerForKanban = useMemo(() => {
    let base = filteredLedgerBySource;
    if (ledgerSearchLower) {
      base = base.filter(
        (r) =>
          (r.party_name || "").toLowerCase().includes(ledgerSearchLower) ||
          (r.description || "").toLowerCase().includes(ledgerSearchLower) ||
          (r.trip_number || "").toLowerCase().includes(ledgerSearchLower) ||
          (getVehicleNumberForTripId(r.trip_id ?? null) || "")
            .toLowerCase()
            .includes(ledgerSearchLower),
      );
    }
    const mult = ledgerSortDir === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
      if (ledgerSortKey === "entity") {
        const entityFor = (r: LedgerRow) =>
          (r.amount_out ?? 0) > 0
            ? getVehicleNumberForTripId(r.trip_id ?? null) || r.party_name || ""
            : r.party_name || "";
        const nameCmp = entityFor(a).localeCompare(entityFor(b), undefined, {
          sensitivity: "base",
        });
        if (nameCmp !== 0) return mult * nameCmp;
        return mult * (a.description || "").localeCompare(b.description || "");
      }
      if (ledgerSortKey === "source") {
        const sourceA =
          a.trip_number || getVehicleNumberForTripId(a.trip_id ?? null) || "";
        const sourceB =
          b.trip_number || getVehicleNumberForTripId(b.trip_id ?? null) || "";
        return mult * sourceA.localeCompare(sourceB);
      }
      if (ledgerSortKey === "cash_in") {
        return mult * ((a.amount_in ?? 0) - (b.amount_in ?? 0));
      }
      if (ledgerSortKey === "cash_out") {
        return mult * ((a.amount_out ?? 0) - (b.amount_out ?? 0));
      }
      const dateA = a.transaction_date || a.created_at || "";
      const dateB = b.transaction_date || b.created_at || "";
      return mult * dateA.localeCompare(dateB);
    });
  }, [
    filteredLedgerBySource,
    ledgerSearchLower,
    ledgerSortKey,
    ledgerSortDir,
    getVehicleNumberForTripId,
  ]);

  const ledgerTotalsData = useMemo(
    () => ledgerTotals(filteredLedgerTotalsBySource),
    [filteredLedgerTotalsBySource],
  );

  const ledgerCategoryCounts = useMemo(() => {
    const base = filteredLedgerBySource;
    const match = (
      r: { contact_type?: "client" | "supplier" | "driver" | "dco" | null },
      cat: LedgerCategory,
    ): boolean => {
      if (cat === "all") return true;
      const ct = r.contact_type;
      if (cat === "customers") return ct === "client";
      if (cat === "suppliers") return ct === "supplier" || ct === "dco";
      if (cat === "driver") return ct === "driver";
      if (cat === "vehicle") return ct == null;
      return true;
    };
    return {
      all: base.length,
      customers: base.filter((r) => match(r, "customers")).length,
      suppliers: base.filter((r) => match(r, "suppliers")).length,
      vehicle: base.filter((r) => match(r, "vehicle")).length,
      driver: base.filter((r) => match(r, "driver")).length,
    };
  }, [filteredLedgerBySource]);

  const selectedEntityTotals = useMemo(() => {
    if (selectedLedgerCategory === "all") return null;
    return {
      totalIn: filteredLedgerForDisplay.reduce(
        (s, r) => s + (r.amount_in ?? 0),
        0,
      ),
      totalOut: filteredLedgerForDisplay.reduce(
        (s, r) => s + (r.amount_out ?? 0),
        0,
      ),
      count: filteredLedgerForDisplay.length,
    };
  }, [selectedLedgerCategory, filteredLedgerForDisplay]);

  const tripDetailsMap = useMemo(() => {
    const map: Record<
      string,
      {
        trip_number: string;
        drop_location?: string;
        pickup_area?: string;
        client_name?: string;
        pickup_date?: string | null;
        vehicle_number?: string | null;
        vehicle_type?: string | null;
        vehicle_body_type?: string | null;
        client_price?: number | null;
        supplier_rate?: number | null;
        driver_commission?: number | null;
        supplier_id?: string | null;
        supplier_display_name?: string | null;
      }
    > = {};
    const linkedClientIdByOrgId = buildUniqueLinkedOrgIdMap(clients ?? []);
    const linkedSupplierIdByOrgId = buildUniqueLinkedOrgIdMap(suppliers ?? []);
    const clientById = new Map((clients ?? []).map(c => [c.id, c]));
    const supplierById = new Map((suppliers ?? []).map((s) => [s.id, s]));

    const tripLedgerOutMap = new Map<string, number>();
    for (const row of ledgerTransactions ?? []) {
      if (row.trip_id && (row.amount_out ?? 0) > 0) {
        tripLedgerOutMap.set(row.trip_id, (tripLedgerOutMap.get(row.trip_id) ?? 0) + (row.amount_out ?? 0));
      }
    }

    for (const t of tripRows) {
      const vehicle = t.vehicle_id ? vehicleById.get(t.vehicle_id) ?? null : null;
      const vehicleNumber = vehicle?.vehicle_number ?? null;

      let resolvedClientName = t.client_name || undefined;
      let resolvedClientPrice = t.client_price ?? null;
      let resolvedSupplierRate = t.supplier_rate ?? null;
      const isIntegratedCarrierPerspective = t.organization_id && t.organization_id !== organizationId && isLoadBasedTrip(t);

      if (isIntegratedCarrierPerspective) {
        const linkedCid = linkedClientIdByOrgId.get(t.organization_id);
        if (linkedCid) {
          resolvedClientName = clientById.get(linkedCid)?.name || resolvedClientName;
        }
        // From carrier perspective: what shipper pays us (supplier_rate) is our revenue (client_price)
        resolvedClientPrice = t.supplier_rate ?? null;
        // For our costs, we use the sum of our ledger "Out" entries for this trip, 
        // since the trip record's supplier_rate field is already occupied by our revenue.
        resolvedSupplierRate = tripLedgerOutMap.get(t.id) ?? 0;
      }

      const tripSupplierName = ((t as { supplier_name?: string | null }).supplier_name ?? "")
        .trim() || null;
      let supplierDisplayName: string | null = tripSupplierName;
      if (isCrossOrgIntegrationTrip(t, organizationId) && t.organization_id) {
        const localSid = linkedSupplierIdByOrgId.get(t.organization_id) ?? null;
        if (localSid) {
          const srow = supplierById.get(localSid);
          const nm =
            (srow?.name ?? "").trim() ||
            (srow?.company_name ?? "").trim() ||
            (srow?.contact_person ?? "").trim();
          if (nm) supplierDisplayName = nm;
        }
      }

      map[t.id] = {
        trip_number: getTripDisplayNumber(t),
        drop_location: t.drop_location || undefined,
        pickup_area: t.pickup_area || undefined,
        client_name: resolvedClientName,
        pickup_date: t.pickup_date ?? t.created_at ?? undefined,
        vehicle_number: vehicleNumber ?? undefined,
        vehicle_type: vehicle?.vehicle_type ?? undefined,
        vehicle_body_type: vehicle?.vehicle_body_type ?? undefined,
        client_price: resolvedClientPrice,
        supplier_rate: resolvedSupplierRate,
        driver_commission: t.driver_commission ?? null,
        supplier_id: t.supplier_id ?? null,
        supplier_display_name: supplierDisplayName,
      };
    }
    return map;
  }, [tripRows, vehicleById, clients, suppliers, organizationId, ledgerTransactions]);

  const setLedgerTransactionsNoop = useCallback(
    (_action: React.SetStateAction<LedgerRow[] | null>) => {
      refetch();
    },
    [refetch],
  );

  return {
    ledgerTransactions,
    ledgerLoading,
    ledgerFetchError,
    ledgerRefreshKey,
    setLedgerTransactions: setLedgerTransactionsNoop,
    setLedgerRefreshKey,
    refetchLedger,
    financePeriodFilter,
    setFinancePeriodFilter: setFinancePeriodFilterWrapped,
    financeCustomRangeFrom,
    financeCustomRangeTo,
    setFinanceCustomRange,
    sourceSupplyFilter,
    setSourceSupplyFilter,
    ledgerSortKey,
    setLedgerSortKey,
    ledgerSortDir,
    setLedgerSortDir,
    selectedLedgerCategory,
    setSelectedLedgerCategory,
    cashDirectionFilter,
    setCashDirectionFilter,
    searchQuery,
    setSearchQuery,
    filteredLedger,
    filteredLedgerBySource,
    filteredLedgerForDisplay,
    filteredLedgerForKanban,
    ledgerTotalsData,
    ledgerCategoryCounts,
    selectedEntityTotals,
    tripCountByParty,
    tripById,
    getVehicleNumberForTripId,
    tripPartyMap,
    tripDetailsMap,
    clearFilters,
    isAnyFilterActive,
    fetchNextLedgerPage: () => {},
    hasNextLedgerPage: false,
    ledgerPageLoading: ledgerRefetching,
  };
}
