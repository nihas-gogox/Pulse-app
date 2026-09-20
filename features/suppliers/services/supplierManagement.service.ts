import { supabase } from "@/lib/supabase";
import {
  getSupplierById,
  getSupplierDetails,
  mergeSupplierDisplayFields,
} from "@/features/suppliers/services/suppliers.service";
import { getTripsBySupplierForOrg } from "@/features/trips/services/trips.service";
import { getTransactionsByOrganization } from "@/features/finance/services/finance.service";
import type { DriverRow } from "@/features/drivers/services/drivers.service";
import {
  buildSupplierPerformanceFromTrips,
  type SupplierManagementBundle,
  type SupplierDriverSalaryRequest,
  type SupplierKycDocument,
  type ComplianceDocument,
  type SupplierContract,
  type SupplierVehicle,
  type SupplierWarehouse,
  type SupplierContactRow,
  type TimelineEvent,
} from "@/features/suppliers/types/supplierManagement.types";

export async function getSupplierManagementBundle(
  orgId: string,
  supplierId: string,
): Promise<{ error: Error | null; bundle: SupplierManagementBundle | null }> {
  const [supplierRes, detailsRes, tripsRes, txRes, rpcRes] = await Promise.all([
    getSupplierById(orgId, supplierId),
    getSupplierDetails(supplierId),
    getTripsBySupplierForOrg(orgId, supplierId),
    getTransactionsByOrganization(orgId),
    supabase().rpc("get_supplier_management_bundle", {
      p_org_id: orgId,
      p_supplier_id: supplierId,
    }),
  ]);

  if (supplierRes.error || !supplierRes.supplier) {
    return { error: supplierRes.error ?? new Error("Supplier not found"), bundle: null };
  }

  const supplier =
    !detailsRes.error && detailsRes.supplier
      ? mergeSupplierDisplayFields(supplierRes.supplier, detailsRes.supplier)
      : supplierRes.supplier;
  // Scoped fetch returns only id/status/supplier_rate — exactly the fields
  // SupplierManagementBundle.trips and its consumers (Overview/Finance panels,
  // buildSupplierPerformanceFromTrips) actually read. No cast needed.
  const supplierTrips = tripsRes.trips ?? [];
  const rpcData = (rpcRes.data ?? {}) as Record<string, unknown>;

  // Drivers and salary requests belong to the supplier's OWN organization
  // (when they're a linked Pulse org), not the aggregator's — the caller
  // (orgId) is only the aggregator looking in from the outside, and the
  // vendor org's RLS ("Org members can manage drivers" / "...
  // driver_salary_requests") blocks a plain cross-org select. Both go
  // through SECURITY DEFINER RPCs that explicitly verify the supplier link
  // instead of relying on table RLS.
  const [driversRpcRes, salaryRpcRes] = await Promise.all([
    supabase().rpc("get_supplier_linked_drivers", {
      p_supplier_id: supplierId,
      p_viewer_org_id: orgId,
    }),
    supabase().rpc("get_supplier_driver_salary_requests", {
      p_supplier_id: supplierId,
      p_viewer_org_id: orgId,
    }),
  ]);

  const linkedOrgId = supplier.linked_organization_id ?? null;
  const drivers: DriverRow[] = (
    (driversRpcRes.data ?? []) as Array<{
      id: string;
      name: string;
      phone: string | null;
      license_number: string | null;
      status: string;
      created_at: string;
      updated_at: string;
    }>
  ).map((d) => ({
    id: d.id,
    organization_id: linkedOrgId ?? "",
    user_id: null,
    name: d.name,
    phone: d.phone,
    license_number: d.license_number,
    status: d.status,
    assigned_vehicle_id: null,
    created_at: d.created_at,
    updated_at: d.updated_at,
  }));
  const driverSalaryRequests: SupplierDriverSalaryRequest[] = (
    (salaryRpcRes.data ?? []) as Array<{
      id: string;
      driver_id: string;
      driver_name: string | null;
      request_type: string;
      amount: number;
      status: string;
      note: string | null;
      created_at: string;
    }>
  ).map((r) => ({
    id: r.id,
    driver_id: r.driver_id,
    driver_name: r.driver_name,
    request_type: r.request_type,
    amount: Number(r.amount),
    status: r.status,
    note: r.note,
    created_at: r.created_at,
  }));

  const contacts = (rpcData.contacts ?? []) as SupplierContactRow[];
  const kyc_documents = (rpcData.kyc_documents ?? []) as SupplierKycDocument[];
  const compliance_docs = (rpcData.compliance_docs ?? []) as ComplianceDocument[];
  const contracts = (rpcData.contracts ?? []) as SupplierContract[];
  const fleet = (rpcData.fleet ?? []) as SupplierVehicle[];
  const warehouses = (rpcData.warehouses ?? []) as SupplierWarehouse[];

  const timeline: TimelineEvent[] = [
    {
      id: "created",
      event_type: "supplier_created",
      description: `Supplier ${supplier.name ?? "record"} created`,
      actor: null,
      meta: null,
      created_at: supplier.created_at,
    },
  ];

  return {
    error: null,
    bundle: {
      supplier,
      trips: supplierTrips,
      transactions: txRes.transactions ?? [],
      drivers,
      driverSalaryRequests,
      contacts,
      kyc_documents,
      compliance_docs,
      contracts,
      fleet,
      warehouses,
      performance: buildSupplierPerformanceFromTrips(supplierTrips),
      crm_status: "standard",
      crm_notes: [],
      timeline,
    },
  };
}
