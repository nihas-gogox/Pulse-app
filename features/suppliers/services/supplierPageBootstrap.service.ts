import type { ClientRow } from "@/features/clients/services/clients.service";
import type { DriverRow } from "@/features/drivers/services/drivers.service";
import {
  getTransactionsByOrganizationAndContactId,
  toLedgerRow,
  type LedgerRow,
} from "@/features/finance/services/finance.service";
import {
  getSupplierDetails,
  type SupplierRow,
} from "@/features/suppliers/services/suppliers.service";
import type { TripRow } from "@/features/trips/services/trips.service";
import { supabase } from "@/lib/supabase";

export type SupplierPageBootstrap = {
  supplier: SupplierRow;
  trips: TripRow[];
  transactions: LedgerRow[];
  suppliers: SupplierRow[];
  drivers: DriverRow[];
  clients: ClientRow[];
  aggregateTripSalesById: Record<string, number>;
};

function isMissingRpc(error: { code?: string; message?: string } | null): boolean {
  const code = String(error?.code ?? "");
  const msg = (error?.message ?? "").toLowerCase();
  return (
    code === "PGRST202" ||
    code === "42883" ||
    msg.includes("could not find the function") ||
    msg.includes("get_supplier_page_bootstrap")
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

function mapRpcBundle(payload: {
  supplier?: SupplierRow | null;
  trips?: Array<TripRow & { aggregate_sales?: number | null }>;
  transactions?: unknown[];
  suppliers?: SupplierRow[];
  drivers?: DriverRow[];
  clients?: ClientRow[];
} | null): SupplierPageBootstrap | null {
  if (!payload?.supplier?.id) return null;
  const aggregateTripSalesById: Record<string, number> = {};
  const trips = (payload.trips ?? []).map((trip) => {
    const sales = Number(trip.aggregate_sales ?? 0);
    if (sales > 0) aggregateTripSalesById[trip.id] = sales;
    const { aggregate_sales: _drop, ...rest } = trip;
    return rest as TripRow;
  });
  return {
    supplier: payload.supplier,
    trips,
    transactions: (payload.transactions ?? []).map(mapTx),
    suppliers: payload.suppliers ?? [payload.supplier],
    drivers: payload.drivers ?? [],
    clients: payload.clients ?? [],
    aggregateTripSalesById,
  };
}

async function fetchSupplierPageBootstrapScoped(
  orgId: string,
  supplierId: string,
): Promise<{ error: Error | null; bundle: SupplierPageBootstrap | null }> {
  const [detail, tripsRes, txRes] = await Promise.all([
    getSupplierDetails(supplierId),
    supabase()
      .from("trips")
      .select("*")
      .eq("organization_id", orgId)
      .eq("supplier_id", supplierId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(400),
    getTransactionsByOrganizationAndContactId(orgId, supplierId),
  ]);
  if (detail.error) return { error: detail.error, bundle: null };
  if (!detail.supplier) return { error: null, bundle: null };
  if (tripsRes.error) return { error: new Error(tripsRes.error.message), bundle: null };
  if (txRes.error) return { error: txRes.error, bundle: null };
  return {
    error: null,
    bundle: {
      supplier: detail.supplier,
      trips: (tripsRes.data ?? []) as TripRow[],
      transactions: (txRes.transactions ?? []).filter(
        (tx) => tx.contact_type === "supplier" && tx.contact_id === supplierId,
      ),
      suppliers: [detail.supplier],
      drivers: [],
      clients: [],
      aggregateTripSalesById: {},
    },
  };
}

export async function fetchSupplierPageBootstrap(
  orgId: string,
  supplierId: string,
): Promise<{ error: Error | null; missingRpc: boolean; bundle: SupplierPageBootstrap | null }> {
  const { data, error } = await supabase().rpc("get_supplier_page_bootstrap", {
    p_org_id: orgId,
    p_supplier_id: supplierId,
  });
  if (!error) {
    const bundle = mapRpcBundle(data as Parameters<typeof mapRpcBundle>[0]);
    if (bundle) return { error: null, missingRpc: false, bundle };
  }
  if (error && !isMissingRpc(error)) {
    return { error: new Error(error.message), missingRpc: false, bundle: null };
  }
  const scoped = await fetchSupplierPageBootstrapScoped(orgId, supplierId);
  return { error: scoped.error, missingRpc: Boolean(error && isMissingRpc(error)), bundle: scoped.bundle };
}
