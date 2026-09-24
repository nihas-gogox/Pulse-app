import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../queryKeys";

type InvalidationTask = () => void;

const pendingByScope = new Map<string, InvalidationTask[]>();
const timerByScope = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleBatchedInvalidation(
  scopeKey: string,
  task: InvalidationTask,
  debounceMs = 80,
) {
  const list = pendingByScope.get(scopeKey) ?? [];
  list.push(task);
  pendingByScope.set(scopeKey, list);
  const existing = timerByScope.get(scopeKey);
  if (existing) return;
  const timer = setTimeout(() => {
    timerByScope.delete(scopeKey);
    const tasks = pendingByScope.get(scopeKey) ?? [];
    pendingByScope.delete(scopeKey);
    for (const run of tasks) run();
  }, debounceMs);
  timerByScope.set(scopeKey, timer);
}

export function invalidateTripOperationalState(input: {
  queryClient: QueryClient;
  tripId: string;
  organizationId?: string | null;
}) {
  const scope = `trip:${input.tripId}`;
  scheduleBatchedInvalidation(scope, () => {
    const qc = input.queryClient;
    qc.invalidateQueries({ queryKey: queryKeys.trips.detail(input.tripId) });
    qc.invalidateQueries({ queryKey: queryKeys.trips.bundle(input.tripId) });
    qc.invalidateQueries({ queryKey: queryKeys.trips.operationsSummary(input.tripId) });
    qc.invalidateQueries({ queryKey: queryKeys.trips.operationsTimeline(input.tripId) });
    qc.invalidateQueries({ queryKey: queryKeys.trips.fuelEntries(input.tripId) });
    qc.invalidateQueries({ queryKey: queryKeys.trips.tollEntries(input.tripId) });
    qc.invalidateQueries({ queryKey: queryKeys.trips.otherEntries(input.tripId) });
    qc.invalidateQueries({ queryKey: queryKeys.trips.verification(input.tripId) });
    qc.invalidateQueries({ queryKey: queryKeys.trips.verificationPhotos(input.tripId) });
    qc.invalidateQueries({
      queryKey: queryKeys.operations.postingReconciliationByTrip(input.tripId),
    });
    qc.invalidateQueries({
      queryKey: queryKeys.operations.ledgerReconciliationByTrip(input.tripId),
    });
    qc.invalidateQueries({ queryKey: queryKeys.operations.observabilityByTrip(input.tripId) });
    if (input.organizationId) {
      qc.invalidateQueries({
        queryKey: queryKeys.operations.controlCenter(input.organizationId),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.operations.healthSnapshot(input.organizationId),
      });
    }
  });
}

export function invalidateLedgerState(input: {
  queryClient: QueryClient;
  organizationId: string;
  tripId?: string | null;
  vehicleId?: string | null;
}) {
  const scope = `ledger:${input.organizationId}`;
  scheduleBatchedInvalidation(scope, () => {
    const qc = input.queryClient;
    qc.invalidateQueries({ queryKey: ["q", "vehicle-ledger"] });
    qc.invalidateQueries({ queryKey: ["q", "garage"] });
    qc.invalidateQueries({ queryKey: ["q", "business-pulse"] });
    qc.invalidateQueries({ queryKey: queryKeys.transactions.all(input.organizationId) });
    qc.invalidateQueries({ queryKey: queryKeys.transactions.finite(input.organizationId) });
    qc.invalidateQueries({ queryKey: queryKeys.invoicing.trips(input.organizationId) });
    qc.invalidateQueries({ queryKey: queryKeys.invoicing.summary(input.organizationId) });
    qc.invalidateQueries({ queryKey: queryKeys.analytics.all(input.organizationId) });
    if (input.vehicleId) {
      qc.invalidateQueries({
        queryKey: queryKeys.trips.vehicleOperationsLedger(
          input.organizationId,
          input.vehicleId,
        ),
      });
      qc.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            key[0] === "q" &&
            key[1] === "trips" &&
            key[2] === "operations" &&
            key[3] === "vehicle" &&
            key[4] === input.organizationId &&
            key[5] === input.vehicleId
          );
        },
      });
    }
    if (input.tripId) {
      qc.invalidateQueries({ queryKey: queryKeys.trips.detail(input.tripId) });
    }
  });
}

export function invalidateReconciliationState(input: {
  queryClient: QueryClient;
  organizationId: string;
  tripId?: string | null;
}) {
  const scope = `recon:${input.organizationId}`;
  scheduleBatchedInvalidation(scope, () => {
    const qc = input.queryClient;
    qc.invalidateQueries({
      queryKey: queryKeys.operations.ledgerReconciliationByOrg(input.organizationId),
    });
    qc.invalidateQueries({
      queryKey: queryKeys.operations.controlCenter(input.organizationId),
    });
    qc.invalidateQueries({
      queryKey: queryKeys.operations.healthSnapshot(input.organizationId),
    });
    if (input.tripId) {
      qc.invalidateQueries({
        queryKey: queryKeys.operations.postingReconciliationByTrip(input.tripId),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.operations.ledgerReconciliationByTrip(input.tripId),
      });
    }
  });
}

export function invalidateOperationalIdentity(input: {
  queryClient: QueryClient;
  organizationId: string;
  tripId?: string | null;
}) {
  const scope = `identity:${input.organizationId}`;
  scheduleBatchedInvalidation(scope, () => {
    const qc = input.queryClient;
    qc.invalidateQueries({ queryKey: queryKeys.trips.all(input.organizationId) });
    qc.invalidateQueries({ queryKey: queryKeys.trips.finite(input.organizationId) });
    qc.invalidateQueries({ queryKey: queryKeys.indents.all(input.organizationId) });
    if (input.tripId) {
      qc.invalidateQueries({ queryKey: queryKeys.trips.detail(input.tripId) });
      qc.invalidateQueries({ queryKey: queryKeys.trips.bundle(input.tripId) });
    }
  });
}
