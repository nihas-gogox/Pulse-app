import type { ClientContract } from "@/features/clients/services/clientContracts.service";
import type { ClientWarehouse } from "@/features/clients/services/clientWarehouses.service";
import {
  getClientDetailBundle,
  type ClientRow,
} from "@/features/clients/services/clients.service";
import type { DriverRow } from "@/features/drivers/services/drivers.service";
import {
  getTransactionsByOrganizationAndContactId,
  toLedgerRow,
  type LedgerRow,
} from "@/features/finance/services/finance.service";
import type { RatingRow } from "@/features/ratings";
import type { SupplierRow } from "@/features/suppliers/services/suppliers.service";
import type { TripRow } from "@/features/trips/services/trips.service";
import { supabase } from "@/lib/supabase";

export type ClientPageBootstrap = {
  client: ClientRow;
  ratings: RatingRow[];
  warehouses: ClientWarehouse[];
  contracts: ClientContract[];
  trips: TripRow[];
  transactions: LedgerRow[];
  suppliers: SupplierRow[];
  drivers: DriverRow[];
  clients: ClientRow[];
};

function isMissingRpc(error: { code?: string; message?: string } | null): boolean {
  const code = String(error?.code ?? "");
  const msg = (error?.message ?? "").toLowerCase();
  return (
    code === "PGRST202" ||
    code === "42883" ||
    msg.includes("could not find the function") ||
    msg.includes("get_client_page_bootstrap")
  );
}

function mapTx(raw: unknown): LedgerRow {
  const row = (raw ?? {}) as Record<string, unknown>;
  return toLedgerRow({
    id: String(row.id ?? ""),
    organization_id: String(row.organization_id ?? ""),
    trip_id: (row.trip_id as string | null) ?? null,
    party_name: (row.party_name as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    amount_in: Number(row.amount_in ?? 0),
    amount_out: Number(row.amount_out ?? 0),
    transaction_date: String(row.transaction_date ?? ""),
    created_at: String(row.created_at ?? ""),
    contact_id: (row.contact_id as string | null) ?? null,
    contact_type: (row.contact_type as string | null) ?? null,
    ledger_entity_type: (row.ledger_entity_type as string | null) ?? null,
    ledger_flow_type: (row.ledger_flow_type as string | null) ?? null,
    ledger_category: (row.ledger_category as string | null) ?? null,
    payment_reference: (row.payment_ref as string | null) ?? (row.payment_reference as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
  });
}

function mapRpcBundle(payload: Partial<ClientPageBootstrap>): ClientPageBootstrap | null {
  if (!payload.client?.id) return null;
  return {
    client: payload.client,
    ratings: payload.ratings ?? [],
    warehouses: payload.warehouses ?? [],
    contracts: payload.contracts ?? [],
    trips: (payload.trips ?? []) as TripRow[],
    transactions: ((payload.transactions as unknown[]) ?? []).map(mapTx),
    suppliers: payload.suppliers ?? [],
    drivers: payload.drivers ?? [],
    clients: payload.clients ?? [payload.client],
  };
}

async function fetchClientPageBootstrapScoped(
  orgId: string,
  clientId: string,
): Promise<{ error: Error | null; bundle: ClientPageBootstrap | null }> {
  const [detail, tripsRes, txRes] = await Promise.all([
    getClientDetailBundle(orgId, clientId),
    supabase()
      .from("trips")
      .select("*")
      .eq("organization_id", orgId)
      .eq("client_id", clientId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(400),
    getTransactionsByOrganizationAndContactId(orgId, clientId),
  ]);
  if (detail.error) return { error: detail.error, bundle: null };
  if (!detail.client) return { error: null, bundle: null };
  if (tripsRes.error) return { error: new Error(tripsRes.error.message), bundle: null };
  if (txRes.error) return { error: txRes.error, bundle: null };
  return {
    error: null,
    bundle: {
      client: detail.client,
      ratings: detail.ratings,
      warehouses: detail.warehouses,
      contracts: detail.contracts,
      trips: (tripsRes.data ?? []) as TripRow[],
      transactions: (txRes.transactions ?? []).filter(
        (tx) => tx.contact_type === "client" && tx.contact_id === clientId,
      ),
      suppliers: [],
      drivers: [],
      clients: [detail.client],
    },
  };
}

export async function fetchClientPageBootstrap(
  orgId: string,
  clientId: string,
): Promise<{ error: Error | null; missingRpc: boolean; bundle: ClientPageBootstrap | null }> {
  const { data, error } = await supabase().rpc("get_client_page_bootstrap", {
    p_org_id: orgId,
    p_client_id: clientId,
  });
  if (!error) {
    const bundle = mapRpcBundle((data as Partial<ClientPageBootstrap> | null) ?? {});
    if (bundle) return { error: null, missingRpc: false, bundle };
  }
  if (error && !isMissingRpc(error)) {
    return { error: new Error(error.message), missingRpc: false, bundle: null };
  }
  const scoped = await fetchClientPageBootstrapScoped(orgId, clientId);
  return { error: scoped.error, missingRpc: Boolean(error && isMissingRpc(error)), bundle: scoped.bundle };
}
