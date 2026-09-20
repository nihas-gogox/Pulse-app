/**
 * TanStack Query hooks for ledger/transactions. Cached by orgId.
 */
import { useCallback } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAllTransactionsByOrganizationForTotals,
  getTransactionsByOrganization,
  type LedgerRow,
} from '@/features/finance/services/finance.service';
import { clearDomainCacheMeta } from '@/lib/cache/cacheMetadataStore';
import { refetchOnMountIfEntityListEmpty } from '@/lib/queries/entityListQueryOptions';
import { queryKeys } from '@/lib/queryKeys';
import { STALE } from '@/lib/queryClient';
import { LEDGER_PAGE_SIZE } from '@/lib/pagination';

/** Full list (no pagination). Use for aggregation e.g. Trips tab "received by trip". */
export function useTransactionsQuery(orgId: string | null) {
  return useQuery({
    queryKey: queryKeys.transactions.finite(orgId ?? ''),
    queryFn: async () => {
      // Skip delta-sync (`get_transactions_delta` max ~15s here). That RPC plus
      // a follow-up full fetch stacked past the 12s client timeout and left
      // Finance on Loading. Direct org-scoped select is enough for the tab.
      const res = await getTransactionsByOrganization(orgId!);
      if (res.error) throw res.error;
      return res.transactions;
    },
    enabled: !!orgId,
    staleTime: STALE.realtime,
    refetchOnMount: refetchOnMountIfEntityListEmpty<LedgerRow[]>(),
  });
}

/**
 * Unbounded, join-free fetch used ONLY to compute the Cash tab's headline
 * totals correctly for orgs with more transactions than the capped display
 * list (`useTransactionsQuery`) shows. Kept separate from the bounded/
 * paginated display data — do not use this for rendering the ledger table.
 */
export function useTransactionTotalsQuery(orgId: string | null) {
  return useQuery({
    queryKey: queryKeys.transactions.totals(orgId ?? ''),
    queryFn: async () => {
      const res = await getAllTransactionsByOrganizationForTotals(orgId!);
      if (res.error) throw res.error;
      return res.transactions;
    },
    enabled: !!orgId,
    staleTime: STALE.realtime,
  });
}

/** Paginated ledger (e.g. Finance Ledger tab). */
export function useTransactionsInfiniteQuery(orgId: string | null, opts?: { pageSize?: number }) {
  const pageSize = opts?.pageSize ?? LEDGER_PAGE_SIZE;
  return useInfiniteQuery({
    queryKey: queryKeys.transactions.infinite(orgId ?? '', pageSize),
    queryFn: async ({ pageParam = 0 }) => {
      const res = await getTransactionsByOrganization(orgId!, { limit: pageSize, offset: pageParam });
      if (res.error) throw res.error;
      return {
        transactions: res.transactions,
        hasMore: res.hasMore ?? false,
        nextOffset: pageParam + pageSize,
      };
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextOffset : undefined),
    initialPageParam: 0,
    enabled: !!orgId,
    staleTime: STALE.realtime,
  });
}

export function useInvalidateTransactions() {
  const qc = useQueryClient();
  return useCallback((orgId: string) => {
    void clearDomainCacheMeta('transactions', orgId);
    void qc.invalidateQueries({ queryKey: queryKeys.transactions.all(orgId) });
    void qc.invalidateQueries({ queryKey: queryKeys.transactions.finite(orgId) });
    void qc.invalidateQueries({ queryKey: ['q', 'transactions', orgId, 'infinite'] });
  }, [qc]);
}
