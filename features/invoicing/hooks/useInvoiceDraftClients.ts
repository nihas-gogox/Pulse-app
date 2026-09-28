import {
  fetchInvoiceDraftClientsForTrips,
} from '@/features/invoicing/services/invoicePreviewClients.service';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

export function useInvoiceDraftClientsQuery(
  orgId: string | null,
  clientIds: string[],
  clientNames: string[] = [],
) {
  const ids = useMemo(
    () => Array.from(new Set(clientIds.map((id) => id.trim()).filter(Boolean))).sort(),
    [clientIds],
  );
  const names = useMemo(
    () =>
      Array.from(
        new Set(
          clientNames
            .map((n) => (n ?? '').replace(/\s+/g, ' ').trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [clientNames],
  );
  const idsKey = ids.join(',');
  const namesKey = names.map((n) => n.toLowerCase()).join('|');

  return useQuery({
    queryKey: orgId && (idsKey || namesKey)
      ? (['q', 'invoicing', 'draft-clients', orgId, idsKey, namesKey] as const)
      : (['q', 'invoicing', 'draft-clients', 'none'] as const),
    queryFn: () => fetchInvoiceDraftClientsForTrips(orgId!, ids, names),
    enabled: Boolean(orgId) && (ids.length > 0 || names.length > 0),
    staleTime: 30_000,
  });
}
