/**
 * Phase 2A-3: one batched clients fetch for draft preview.
 * Pulls the same ledger fields shown on the client finance profile.
 * Does not persist, allocate, or issue invoices.
 */

import { supabase } from '@/lib/supabase';

export type InvoiceDraftClientRow = {
  id: string;
  organization_id: string;
  name: string;
  legal_name: string | null;
  gstin: string | null;
  pan: string | null;
  billing_address: string | null;
  state: string | null;
  email: string | null;
  contact_person: string | null;
  phone: string | null;
};

const CLIENT_DRAFT_SELECT =
  'id, organization_id, name, legal_name, gstin, pan_number, billing_address, registered_address, address, state, email, contact_person, phone';

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed : null;
}

export function normalizeInvoiceClientName(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

type ClientsTableRow = {
  id: string;
  organization_id: string;
  name?: string | null;
  legal_name?: string | null;
  gstin?: string | null;
  pan_number?: string | null;
  billing_address?: string | null;
  registered_address?: string | null;
  address?: string | null;
  state?: string | null;
  email?: string | null;
  contact_person?: string | null;
  phone?: string | null;
};

function mapClientRow(row: ClientsTableRow): InvoiceDraftClientRow {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    name: String(row.name ?? ''),
    legal_name: trimOrNull(row.legal_name),
    gstin: trimOrNull(row.gstin),
    pan: trimOrNull(row.pan_number),
    // Match client ledger Tax Identity: billing_address → registered → address
    billing_address:
      trimOrNull(row.billing_address) ??
      trimOrNull(row.registered_address) ??
      trimOrNull(row.address),
    state: trimOrNull(row.state),
    email: trimOrNull(row.email),
    contact_person: trimOrNull(row.contact_person),
    phone: trimOrNull(row.phone),
  };
}

function mergeClientRows(rows: InvoiceDraftClientRow[]): InvoiceDraftClientRow[] {
  const byId = new Map<string, InvoiceDraftClientRow>();
  for (const row of rows) {
    byId.set(row.id, row);
  }
  return Array.from(byId.values());
}

/** Single `.in(id)` query scoped to the active workspace. */
export async function fetchInvoiceDraftClients(
  orgId: string,
  clientIds: string[],
): Promise<InvoiceDraftClientRow[]> {
  const ids = Array.from(new Set(clientIds.map((id) => id.trim()).filter(Boolean)));
  if (!orgId || ids.length === 0) return [];

  const { data, error } = await supabase()
    .from('clients')
    .select(CLIENT_DRAFT_SELECT)
    .eq('organization_id', orgId)
    .in('id', ids);

  if (error) throw error;
  return (data ?? []).map((row) => mapClientRow(row as ClientsTableRow));
}

/** Escape `%` / `_` so ilike acts as case-insensitive exact match. */
function escapeIlikeExact(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Fetch clients by display/legal name when trips lack client_id (or id miss).
 * Case-insensitive exact match after whitespace normalize.
 */
export async function fetchInvoiceDraftClientsByNames(
  orgId: string,
  clientNames: string[],
): Promise<InvoiceDraftClientRow[]> {
  const names = Array.from(
    new Set(
      clientNames
        .map((n) => (n ?? '').replace(/\s+/g, ' ').trim())
        .filter(Boolean),
    ),
  );
  if (!orgId || names.length === 0) return [];

  const batches = await Promise.all(
    names.slice(0, 12).map(async (name) => {
      const pattern = escapeIlikeExact(name);
      try {
        const [byName, byLegal] = await Promise.all([
          supabase()
            .from('clients')
            .select(CLIENT_DRAFT_SELECT)
            .eq('organization_id', orgId)
            .ilike('name', pattern)
            .limit(8),
          supabase()
            .from('clients')
            .select(CLIENT_DRAFT_SELECT)
            .eq('organization_id', orgId)
            .ilike('legal_name', pattern)
            .limit(8),
        ]);
        if (byName.error) throw byName.error;
        if (byLegal.error) throw byLegal.error;
        return [
          ...(byName.data ?? []).map((row) => mapClientRow(row as ClientsTableRow)),
          ...(byLegal.data ?? []).map((row) => mapClientRow(row as ClientsTableRow)),
        ];
      } catch {
        return [] as InvoiceDraftClientRow[];
      }
    }),
  );

  return mergeClientRows(batches.flat());
}

/** Prefer id hits; fill gaps from name lookup (ledger profile source of truth). */
export async function fetchInvoiceDraftClientsForTrips(
  orgId: string,
  clientIds: string[],
  clientNames: string[],
): Promise<InvoiceDraftClientRow[]> {
  if (!orgId) return [];
  try {
    const [byId, byName] = await Promise.all([
      fetchInvoiceDraftClients(orgId, clientIds),
      fetchInvoiceDraftClientsByNames(orgId, clientNames),
    ]);
    return mergeClientRows([...byId, ...byName]);
  } catch (idError) {
    // Never block draft UI — fall back to id-only, then empty.
    try {
      return await fetchInvoiceDraftClients(orgId, clientIds);
    } catch {
      console.warn('[invoicePreviewClients] draft client fetch failed', idError);
      return [];
    }
  }
}
