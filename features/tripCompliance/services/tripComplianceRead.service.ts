import type { DocumentRow } from "@/features/compliance/services/documents.service";
import { getDocumentsForEntities } from "@/features/compliance/services/documents.service";
import { interpretLedgerRowStructured } from "@/features/finance/ledger/ledgerEntryModel";
import {
    REQUIRED_COMPLIANCE_DOCUMENT_TYPES,
    REQUIRED_DRIVER_DOCUMENT_TYPES,
    REQUIRED_VEHICLE_DOCUMENT_TYPES,
    type ComplianceDecision,
    type ComplianceDocumentRow,
    type ComplianceEntityDocument,
    type ComplianceOutstandingSummary,
    type CompliancePaymentSummary,
    type ComplianceStage,
    type ComplianceTripFlags,
    type ComplianceTripInputs,
    type ComplianceTripSummary,
} from "@/features/tripCompliance/tripCompliance.types";
import { buildComplianceChecklist, listExpiredRequiredVehicleDocTypes } from "@/features/tripCompliance/utils/complianceChecklist.util";
import { classifyTripDocument } from "@/features/tripCompliance/utils/tripDocumentClassification.util";
import { deriveEntityComplianceRows } from "@/features/tripCompliance/utils/complianceDocumentRows.util";
import {
    mergeComplianceEntityDocs,
    normalizeTripDocumentType,
    normalizeVaultVehicleNumber,
    vehicleVaultDocumentsToEntityDocs,
} from "@/features/tripCompliance/utils/complianceVaultDocuments.util";
import { runWithConcurrencyLimit, tripPodIsReceived } from "@/features/trips/services/tripDocumentLrPod.service";
import type { TripRow } from "@/features/trips/services/trips.service";
import { getVehicleForTripViewer } from "@/features/vehicles/services/vehicles.service";
import type { VehicleDocuments } from "@/features/vehicles/utils/vehicleDocuments.util";
import { supabase } from "@/lib/supabase";

/**
 * `trip_documents.status`/`verified_by`/`verified_at`/`rejection_reason` and
 * `trips.compliance_verified_*`/`pod_hard_copy_*` ship in migration
 * 20260915162440 — not yet applied while the production schema freeze holds.
 * Every read below degrades gracefully (missing-column / missing-relation
 * errors) so the rest of the app, and this feature's read-only surfaces,
 * keep working before that migration lands.
 */
function isMissingColumnOrRelation(error: { code?: string; message?: string }): boolean {
  const message = String(error.message ?? "").toLowerCase();
  return (
    error.code === "42703" || // undefined_column
    error.code === "42P01" || // undefined_table
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    message.includes("does not exist")
  );
}

type RawTripDocRow = {
  id: string;
  trip_id: string;
  document_type: string | null;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
  uploaded_by?: string | null;
  status?: ComplianceDocumentRow["status"];
  verified_by?: string | null;
  verified_at?: string | null;
  rejection_reason?: string | null;
  mime_type?: string | null;
  document_number?: string | null;
  source_entity_document_id?: string | null;
};

export async function fetchTripDocumentsForTrips(
  tripIds: string[],
): Promise<Map<string, ComplianceDocumentRow[]>> {
  const byTrip = new Map<string, ComplianceDocumentRow[]>();
  if (tripIds.length === 0) return byTrip;

  const SELECT_WITH_STATUS =
    "id, trip_id, document_type, file_name, storage_path, uploaded_at, uploaded_by, status, verified_by, verified_at, rejection_reason, mime_type, document_number";
  const SELECT_WITH_STATUS_AND_SOURCE = `${SELECT_WITH_STATUS}, source_entity_document_id`;

  let rows: RawTripDocRow[] = [];
  const withSource = await supabase()
    .from("trip_documents")
    .select(SELECT_WITH_STATUS_AND_SOURCE)
    .in("trip_id", tripIds);

  let withStatus: {
    data: RawTripDocRow[] | null;
    error: { message: string } | null;
  } = withSource;

  if (withStatus.error && isMissingColumnOrRelation(withStatus.error)) {
    const withoutSource = await supabase()
      .from("trip_documents")
      .select(SELECT_WITH_STATUS)
      .in("trip_id", tripIds);
    withStatus = {
      data: (withoutSource.data ?? []).map((r) => ({
        ...r,
        source_entity_document_id: null,
      })),
      error: withoutSource.error,
    };
  }

  if (withStatus.error && isMissingColumnOrRelation(withStatus.error)) {
    // Pre-migration fallback: no verification columns yet, treat every
    // uploaded document as 'pending' so the UI still renders sensibly.
    const fallback = await supabase()
      .from("trip_documents")
      .select("id, trip_id, document_type, file_name, storage_path, uploaded_at, uploaded_by")
      .in("trip_id", tripIds);
    if (fallback.error) throw new Error(fallback.error.message);
    rows = (fallback.data ?? []).map((r) => ({ ...r, status: "pending" as const }));
  } else if (withStatus.error) {
    throw new Error(withStatus.error.message);
  } else {
    rows = (withStatus.data ?? []) as RawTripDocRow[];
  }

  for (const r of rows) {
    const doc: ComplianceDocumentRow = {
      id: r.id,
      trip_id: r.trip_id,
      document_type: normalizeTripDocumentType(r.document_type),
      file_name: r.file_name,
      storage_path: r.storage_path,
      uploaded_at: r.uploaded_at,
      uploaded_by: r.uploaded_by ?? null,
      status: r.status ?? "pending",
      verified_by: r.verified_by ?? null,
      verified_at: r.verified_at ?? null,
      rejection_reason: r.rejection_reason ?? null,
      mime_type: r.mime_type ?? null,
      document_number: r.document_number ?? null,
      source_entity_document_id: r.source_entity_document_id ?? null,
    };
    const list = byTrip.get(doc.trip_id) ?? [];
    list.push(doc);
    byTrip.set(doc.trip_id, list);
  }
  return byTrip;
}

export async function fetchComplianceTripFlags(
  tripIds: string[],
): Promise<Map<string, ComplianceTripFlags>> {
  const byTrip = new Map<string, ComplianceTripFlags>();
  if (tripIds.length === 0) return byTrip;

  const SELECT_BASE =
    "id, compliance_verified_at, compliance_verified_by, compliance_decision, compliance_exception_reason, compliance_outstanding_summary, pod_hard_copy_courier, pod_hard_copy_awb_number, pod_hard_copy_received_by, pod_received_at";
  // Decline columns come from 20270929162901_trip_compliance_decline.sql.
  const SELECT_WITH_DECLINE = `${SELECT_BASE}, compliance_declined_at, compliance_declined_by, compliance_decline_reason`;

  let result: { data: unknown[] | null; error: { code?: string; message: string } | null } = await supabase()
    .from("trips")
    .select(SELECT_WITH_DECLINE)
    .in("id", tripIds);

  if (result.error && isMissingColumnOrRelation(result.error)) {
    // Decline migration not applied yet: retry the original select so
    // verified / exception / hard-copy flags are never lost.
    result = await supabase().from("trips").select(SELECT_BASE).in("id", tripIds);
  }

  const { data, error } = result;
  if (error) {
    if (isMissingColumnOrRelation(error)) return byTrip; // pre-migration: all flags absent
    throw new Error(error.message);
  }
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    byTrip.set(r.id as string, {
      compliance_verified_at: r.compliance_verified_at as string | null,
      compliance_verified_by: r.compliance_verified_by as string | null,
      compliance_decision: (r.compliance_decision as ComplianceDecision | null) ?? null,
      compliance_exception_reason: (r.compliance_exception_reason as string | null) ?? null,
      compliance_outstanding_summary: (r.compliance_outstanding_summary as ComplianceOutstandingSummary | null) ?? null,
      compliance_declined_at: (r.compliance_declined_at as string | null | undefined) ?? null,
      compliance_declined_by: (r.compliance_declined_by as string | null | undefined) ?? null,
      compliance_decline_reason: (r.compliance_decline_reason as string | null | undefined) ?? null,
      pod_hard_copy_courier: r.pod_hard_copy_courier as string | null,
      pod_hard_copy_awb_number: r.pod_hard_copy_awb_number as string | null,
      pod_hard_copy_received_by: r.pod_hard_copy_received_by as string | null,
      pod_received_at: r.pod_received_at as string | null,
    });
  }
  return byTrip;
}

type RawTxnRow = {
  id: string;
  trip_id: string | null;
  amount_in: number;
  amount_out: number;
  description: string | null;
  transaction_date: string;
  created_by: string | null;
  ledger_category: string | null;
};

export async function fetchComplianceTransactions(
  tripIds: string[],
): Promise<Map<string, { advance: RawTxnRow[]; balance: RawTxnRow[] }>> {
  const byTrip = new Map<string, { advance: RawTxnRow[]; balance: RawTxnRow[] }>();
  if (tripIds.length === 0) return byTrip;

  const { data, error } = await supabase()
    .from("transactions")
    .select("id, trip_id, amount_in, amount_out, description, transaction_date, created_by, ledger_category")
    .in("trip_id", tripIds)
    .in("ledger_category", ["compliance_advance", "compliance_balance"]);

  if (error) {
    if (isMissingColumnOrRelation(error)) return byTrip; // ledger_category not queryable — no payments yet
    throw new Error(error.message);
  }
  for (const row of (data ?? []) as RawTxnRow[]) {
    if (!row.trip_id) continue;
    const bucket = byTrip.get(row.trip_id) ?? { advance: [], balance: [] };
    if (row.ledger_category === "compliance_advance") bucket.advance.push(row);
    else if (row.ledger_category === "compliance_balance") bucket.balance.push(row);
    byTrip.set(row.trip_id, bucket);
  }
  return byTrip;
}

/** `trips` columns the payment state depends on (`amount_paid` fallback advance). */
export async function fetchTripPaymentFields(
  tripIds: string[],
): Promise<Map<string, Pick<TripRow, "amount_paid" | "updated_at">>> {
  const byTrip = new Map<string, Pick<TripRow, "amount_paid" | "updated_at">>();
  if (tripIds.length === 0) return byTrip;
  const { data, error } = await supabase().from("trips").select("id, amount_paid, updated_at").in("id", tripIds);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    byTrip.set(row.id as string, {
      amount_paid: (row as { amount_paid: TripRow["amount_paid"] }).amount_paid,
      updated_at: (row as { updated_at: TripRow["updated_at"] }).updated_at,
    });
  }
  return byTrip;
}

function toEntityDocument(doc: DocumentRow): ComplianceEntityDocument {
  return {
    id: doc.id,
    entity_type: doc.entity_type === "driver" ? "driver" : "vehicle",
    entity_id: doc.entity_id,
    doc_type: doc.doc_type,
    status: doc.status,
    storage_path: doc.storage_path,
    expiry_date: doc.expiry_date,
    verified_at: doc.verified_at,
    verified_by: doc.verified_by,
    notes: doc.notes,
    created_at: doc.created_at,
    created_by: doc.created_by,
    source: "entity",
  };
}

export function toPaymentSummary(rows: RawTxnRow[]): CompliancePaymentSummary | null {
  if (rows.length === 0) return null;
  // Most recent posting represents the payment's current display state —
  // matches "derive, don't duplicate" (Phase 7/9): we don't track a separate
  // paid/pending flag, presence of the row is the state.
  const latest = [...rows].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))[0];
  const structured = interpretLedgerRowStructured(latest);
  return {
    amount: Number(latest.amount_in || latest.amount_out || 0),
    paymentMode: structured.payment_mode,
    utr: structured.reference_number,
    paidAt: latest.transaction_date,
    actorId: latest.created_by,
    transactionId: latest.id,
  };
}

/**
 * Finance-posted client receipts (trips.amount_paid) count as advance for the
 * queue even when they were not tagged `ledger_category = compliance_advance`.
 * Ops often collects advance from the ledger before marking Compliance Verified.
 */
export function advanceFromTripReceipts(
  trip: Pick<TripRow, "id" | "amount_paid" | "updated_at" | "created_at">,
): CompliancePaymentSummary | null {
  const amount = Number(trip.amount_paid ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    amount,
    paymentMode: null,
    utr: null,
    paidAt: trip.updated_at ?? trip.created_at ?? new Date().toISOString(),
    actorId: null,
    transactionId: `amount-paid:${trip.id}`,
  };
}

/**
 * Derives the single displayed compliance stage for a trip from independent
 * signals — never a persisted status column (Phase 4's explicit instruction).
 *
 * Payment progress wins over missing documents: a trip with client receipts
 * must not disappear from the post-payment queue just because trip_documents is
 * empty or Compliance Verified was never stamped.
 *
 * Flow after verification: Payment Pending (filter) → advance posted →
 * AWAITING POD (`hard_copy_pod_received`) → hard-copy marked → BALANCE_PENDING
 * → balance posted → SETTLED. Advance without POD always lands in Awaiting POD
 * (not a separate Advance Processed bucket) so Ops can collect hard-copy next.
 *
 * Documented interpretation of a genuine spec ambiguity: "HARD_COPY_POD_RECEIVED"
 * and "BALANCE_PENDING" describe what is, functionally, the same instant (Phase 11:
 * "once hard copy POD received, show BALANCE PENDING"). Since a trip can only sit
 * in one filter bucket at a time, HARD_COPY_POD_RECEIVED is "advance posted,
 * physical POD not yet marked" and BALANCE_PENDING begins when Ops marks it
 * received.
 */
export function deriveComplianceStage(input: {
  documentCount: number;
  /** Required trip types still missing (LR / E-way / Invoice). Prefer over raw count. */
  missingRequiredCount?: number;
  /**
   * Required vehicle (RC / Insurance / FC) and driver (licence) files still
   * missing. Optional docs do not count. Keeps the trip in Pending Docs.
   */
  missingRequiredEntityCount?: number;
  /**
   * Required vehicle docs (RC / Insurance / FC) that are on file but past
   * expiry. Forces Pending Docs so Ops renews the vault before settlement.
   */
  hasExpiredRequiredVehicleDocs?: boolean;
  complianceVerifiedAt: string | null;
  advance: CompliancePaymentSummary | null;
  tripStatus: string;
  hardCopyReceived: boolean;
  balance: CompliancePaymentSummary | null;
}): ComplianceStage {
  void input.tripStatus;

  if (input.balance) return "payment_settled";
  // Expired RC / Insurance / FC override payment-progress chips — Ops must renew.
  if (input.hasExpiredRequiredVehicleDocs) return "pending_for_docs";
  if (input.advance) {
    return input.hardCopyReceived ? "balance_pending" : "hard_copy_pod_received";
  }
  if (input.complianceVerifiedAt) return "compliance_verified";
  const missingRequired =
    input.missingRequiredCount ??
    (input.documentCount === 0 ? REQUIRED_COMPLIANCE_DOCUMENT_TYPES.length : 0);
  if (missingRequired > 0) return "pending_for_docs";
  if ((input.missingRequiredEntityCount ?? 0) > 0) return "pending_for_docs";
  return "compliance_pending";
}

function missingRequiredEntityDocumentCount(
  vehicleDocuments: ComplianceEntityDocument[],
  driverDocuments: ComplianceEntityDocument[],
): number {
  const rows = [
    ...deriveEntityComplianceRows(REQUIRED_VEHICLE_DOCUMENT_TYPES, vehicleDocuments),
    ...deriveEntityComplianceRows(REQUIRED_DRIVER_DOCUMENT_TYPES, driverDocuments),
  ];
  return rows.filter((row) => row.required && row.status === "missing").length;
}

/**
 * Still missing required trip docs (LR / E-way / Invoice) and not yet verified.
 * Stage chips use exclusive `summary.stage` counts — do not use this for filter
 * totals (it overlaps payment-progress stages).
 */
export function tripNeedsPendingDocs(summary: {
  complianceVerifiedAt: string | null;
  documents: { document_type: string }[];
}): boolean {
  if (summary.complianceVerifiedAt) return false;
  const present = new Set(summary.documents.map((d) => d.document_type));
  return REQUIRED_COMPLIANCE_DOCUMENT_TYPES.some((type) => !present.has(type));
}

async function fetchEntityDocumentsByIds(
  orgId: string | null | undefined,
  entityIds: string[],
  entityTypes: Array<"vehicle" | "driver">,
): Promise<Map<string, DocumentRow[]>> {
  const byEntity = new Map<string, DocumentRow[]>();
  const ids = Array.from(new Set(entityIds.filter(Boolean)));
  if (!orgId || ids.length === 0) return byEntity;

  const { error, documents } = await getDocumentsForEntities(orgId, ids, entityTypes);
  if (error) {
    if (isMissingColumnOrRelation(error)) return byEntity;
    throw error;
  }
  for (const doc of documents) {
    const list = byEntity.get(doc.entity_id) ?? [];
    list.push(doc);
    byEntity.set(doc.entity_id, list);
  }
  return byEntity;
}

type VaultEntry = { vehicleId: string; docs: ComplianceEntityDocument[] };

function indexVehicleVaultDocs(
  byKey: Map<string, VaultEntry>,
  entry: VaultEntry,
  ...keys: Array<string | null | undefined>
) {
  if (entry.docs.length === 0) return;
  for (const key of keys) {
    if (key) byKey.set(key, entry);
  }
}

/**
 * Partner-vehicle vault fallback uses `get_vehicle_for_trip_viewer` (trip-scoped
 * RLS). Many compliance trips can share one truck — one RPC per vehicle id is
 * enough; any referencing trip id satisfies the viewer contract.
 */
export function uniqueTripsNeedingVehicleViewer(
  trips: TripRow[],
  knownVehicleKeys: ReadonlySet<string>,
  orgId: string | null,
): TripRow[] {
  if (!orgId) return [];
  const seen = new Set<string>();
  const unique: TripRow[] = [];
  for (const trip of trips) {
    const id = trip.vehicle_id ?? trip.owner_vehicle_id;
    if (!id || knownVehicleKeys.has(id) || seen.has(id)) continue;
    seen.add(id);
    unique.push(trip);
  }
  return unique;
}

async function fetchVehicleVaultDocumentsForTrips(
  trips: TripRow[],
): Promise<Map<string, VaultEntry>> {
  const byKey = new Map<string, VaultEntry>();
  const orgId = trips.find((trip) => trip.organization_id)?.organization_id ?? null;
  const vehicleIds = Array.from(
    new Set(
      trips.flatMap((trip) => [trip.vehicle_id, trip.owner_vehicle_id].filter((id): id is string => Boolean(id))),
    ),
  );

  if (vehicleIds.length > 0) {
    const { data, error } = await supabase().from("vehicles").select("id, vehicle_number, documents").in("id", vehicleIds);
    if (error && !isMissingColumnOrRelation(error)) throw new Error(error.message);
    for (const row of data ?? []) {
      const docs = vehicleVaultDocumentsToEntityDocs(row.id, (row.documents ?? null) as VehicleDocuments | null);
      indexVehicleVaultDocs(byKey, { vehicleId: row.id, docs }, row.id, normalizeVaultVehicleNumber(row.vehicle_number));
    }
  }

  const missingById = uniqueTripsNeedingVehicleViewer(
    trips,
    new Set(byKey.keys()),
    orgId,
  );
  if (missingById.length > 0 && orgId) {
    await runWithConcurrencyLimit(missingById, 4, async (trip) => {
      const vehicleId = trip.vehicle_id ?? trip.owner_vehicle_id;
      if (!vehicleId) return;
      const { vehicle } = await getVehicleForTripViewer(vehicleId, trip.id, orgId);
      if (!vehicle) return;
      const docs = vehicleVaultDocumentsToEntityDocs(vehicleId, (vehicle.documents ?? null) as VehicleDocuments | null);
      indexVehicleVaultDocs(
        byKey,
        { vehicleId, docs },
        vehicleId,
        trip.vehicle_id,
        trip.owner_vehicle_id,
        normalizeVaultVehicleNumber(vehicle.vehicle_number),
      );
    });
  }

  const missingByNumber = trips.filter((trip) => {
    const number = normalizeVaultVehicleNumber(trip.vehicle_display_number);
    if (!number || !orgId) return false;
    const id = trip.vehicle_id ?? trip.owner_vehicle_id;
    return !((id && byKey.has(id)) || byKey.has(number));
  });
  if (missingByNumber.length > 0 && orgId) {
    const { data, error } = await supabase()
      .from("vehicles")
      .select("id, vehicle_number, documents")
      .eq("organization_id", orgId);
    if (error && !isMissingColumnOrRelation(error)) throw new Error(error.message);
    const byNumber = new Map<string, { id: string; documents: VehicleDocuments | null }>();
    for (const row of data ?? []) {
      const number = normalizeVaultVehicleNumber(row.vehicle_number);
      if (number) byNumber.set(number, { id: row.id, documents: (row.documents ?? null) as VehicleDocuments | null });
    }
    for (const trip of missingByNumber) {
      const number = normalizeVaultVehicleNumber(trip.vehicle_display_number);
      const match = number ? byNumber.get(number) : undefined;
      if (!match) continue;
      const docs = vehicleVaultDocumentsToEntityDocs(match.id, match.documents);
      indexVehicleVaultDocs(byKey, { vehicleId: match.id, docs }, match.id, trip.vehicle_id, trip.owner_vehicle_id, number);
    }
  }

  return byKey;
}

async function fetchDriverKycDocumentsForTrips(
  trips: TripRow[],
): Promise<Map<string, ComplianceEntityDocument[]>> {
  const byDriver = new Map<string, ComplianceEntityDocument[]>();
  const driverIds = Array.from(new Set(trips.map((trip) => trip.driver_id).filter((id): id is string => Boolean(id))));
  if (driverIds.length === 0) return byDriver;

  const { data: driverRows, error: driverError } = await supabase()
    .from("drivers")
    .select("id, user_id")
    .in("id", driverIds);
  if (driverError) {
    if (isMissingColumnOrRelation(driverError)) return byDriver;
    return byDriver;
  }

  const userIdByDriverId = new Map<string, string>();
  const userIds: string[] = [];
  for (const row of driverRows ?? []) {
    if (!row.user_id) continue;
    userIdByDriverId.set(row.id, row.user_id);
    userIds.push(row.user_id);
  }
  for (const driverId of driverIds) {
    if (!userIdByDriverId.has(driverId)) userIds.push(driverId);
  }
  const uniqueUserIds = Array.from(new Set(userIds));
  if (uniqueUserIds.length === 0) return byDriver;

  const { data: kycRows, error: kycError } = await supabase()
    .from("driver_kyc_documents")
    .select("id, driver_user_id, doc_type, status, storage_path, verified_at, rejection_notes, created_at")
    .in("driver_user_id", uniqueUserIds)
    .in("doc_type", ["license", "aadhaar"])
    .is("deleted_at", null);
  if (kycError) {
    if (isMissingColumnOrRelation(kycError)) return byDriver;
    return byDriver;
  }

  const driverIdByUserId = new Map<string, string>();
  for (const [driverId, userId] of userIdByDriverId) driverIdByUserId.set(userId, driverId);

  for (const row of kycRows ?? []) {
    const driverId = driverIdByUserId.get(row.driver_user_id) ?? row.driver_user_id;
    const mapped: ComplianceEntityDocument = {
      id: row.id,
      entity_type: "driver",
      entity_id: driverId,
      doc_type: row.doc_type,
      status: row.status,
      storage_path: row.storage_path,
      expiry_date: null,
      verified_at: row.verified_at,
      notes: row.rejection_notes,
      created_at: row.created_at,
      source: "driver-kyc",
    };
    const list = byDriver.get(driverId) ?? [];
    list.push(mapped);
    byDriver.set(driverId, list);
  }
  return byDriver;
}

function assembleVehicleDocuments(
  trip: TripRow,
  entityDocsById: Map<string, DocumentRow[]>,
  vault: Map<string, VaultEntry>,
): { vehicleDocuments: ComplianceEntityDocument[]; vaultVehicleId: string | null } {
  const entityVehicleDocs = trip.vehicle_id
    ? (entityDocsById.get(trip.vehicle_id) ?? []).filter((d) => d.entity_type === "vehicle").map(toEntityDocument)
    : [];
  const vaultEntry =
    (trip.vehicle_id ? vault.get(trip.vehicle_id) : undefined) ??
    (trip.owner_vehicle_id ? vault.get(trip.owner_vehicle_id) : undefined) ??
    vault.get(normalizeVaultVehicleNumber(trip.vehicle_display_number));
  return {
    vehicleDocuments: mergeComplianceEntityDocs(entityVehicleDocs, vaultEntry?.docs ?? []),
    vaultVehicleId: vaultEntry?.vehicleId ?? null,
  };
}

function assembleDriverDocuments(
  trip: TripRow,
  entityDocsById: Map<string, DocumentRow[]>,
  kyc: Map<string, ComplianceEntityDocument[]>,
): ComplianceEntityDocument[] {
  const entityDriverDocs = trip.driver_id
    ? (entityDocsById.get(trip.driver_id) ?? []).filter((d) => d.entity_type === "driver").map(toEntityDocument)
    : [];
  const kycDriver = trip.driver_id ? (kyc.get(trip.driver_id) ?? []) : [];
  return mergeComplianceEntityDocs(kycDriver, entityDriverDocs);
}

function paymentInputs(txns: { advance: RawTxnRow[]; balance: RawTxnRow[] } | undefined) {
  return {
    taggedAdvance: toPaymentSummary(txns?.advance ?? []),
    balance: toPaymentSummary(txns?.balance ?? []),
  };
}

function orgIdOf(trips: TripRow[]): string | null {
  return trips.find((trip) => trip.organization_id)?.organization_id ?? null;
}

/**
 * Batched read of every input for a set of trips — trip_documents + flags +
 * transactions + entity documents + Asset Vault vehicle JSON + driver KYC.
 * Used for first load and for trips that newly enter the pipeline; targeted
 * writes use the per-input fetchers below instead.
 */
export async function fetchComplianceTripInputs(trips: TripRow[]): Promise<ComplianceTripInputs[]> {
  if (trips.length === 0) return [];
  const tripIds = trips.map((t) => t.id);
  const entityIds = trips.flatMap((trip) => [trip.vehicle_id, trip.driver_id].filter((id): id is string => Boolean(id)));
  const [docsByTrip, flagsByTrip, txnsByTrip, entityDocsById, vault, driverKycDocs] = await Promise.all([
    fetchTripDocumentsForTrips(tripIds),
    fetchComplianceTripFlags(tripIds),
    fetchComplianceTransactions(tripIds),
    fetchEntityDocumentsByIds(orgIdOf(trips), entityIds, ["vehicle", "driver"]),
    fetchVehicleVaultDocumentsForTrips(trips),
    fetchDriverKycDocumentsForTrips(trips),
  ]);
  return trips.map((trip) => ({
    trip,
    documents: docsByTrip.get(trip.id) ?? [],
    flags: flagsByTrip.get(trip.id) ?? null,
    ...paymentInputs(txnsByTrip.get(trip.id)),
    ...assembleVehicleDocuments(trip, entityDocsById, vault),
    driverDocuments: assembleDriverDocuments(trip, entityDocsById, driverKycDocs),
  }));
}

/** Pure: one trip's summary from its inputs. No I/O. */
export function summarizeComplianceTrip(inputs: ComplianceTripInputs): ComplianceTripSummary {
  const { trip, documents, flags, taggedAdvance, balance, vehicleDocuments, driverDocuments } = inputs;
  const advance = taggedAdvance ?? advanceFromTripReceipts(trip);
  // Phase 4: the gate is pod_received_at (the pre-existing, pervasively-used
  // signal), not the courier/AWB/received-by columns — those are display
  // metadata only. See ComplianceTripFlags.pod_received_at.
  const hardCopyReceived = tripPodIsReceived({ pod_received_at: flags?.pod_received_at ?? null });
  const checklist = buildComplianceChecklist({
    tripDocuments: documents,
    vehicleDocuments,
    driverDocuments,
  });

  // Presence and counts come from the classifier: an `empty` row (no file,
  // no typed values, no reference) is not a document.
  const presentDocuments = documents.filter((d) => classifyTripDocument(d).present);
  const documentCounts = {
    total: presentDocuments.length,
    verified: presentDocuments.filter((d) => d.status === "verified").length,
    rejected: presentDocuments.filter((d) => d.status === "rejected").length,
    pending: presentDocuments.filter((d) => d.status === "pending").length,
  };
  const presentRequired = new Set(
    presentDocuments
      .map((d) => d.document_type)
      .filter((type) => REQUIRED_COMPLIANCE_DOCUMENT_TYPES.includes(type)),
  );
  const missingRequiredCount = REQUIRED_COMPLIANCE_DOCUMENT_TYPES.filter(
    (type) => !presentRequired.has(type),
  ).length;
  const hasExpiredRequiredVehicleDocs =
    listExpiredRequiredVehicleDocTypes(vehicleDocuments).length > 0;

  const stage = deriveComplianceStage({
    documentCount: documentCounts.total,
    missingRequiredCount,
    missingRequiredEntityCount: missingRequiredEntityDocumentCount(vehicleDocuments, driverDocuments),
    hasExpiredRequiredVehicleDocs,
    complianceVerifiedAt: flags?.compliance_verified_at ?? null,
    advance,
    tripStatus: trip.status,
    hardCopyReceived,
    balance,
  });

  return {
    trip,
    stage,
    documents,
    vehicleDocuments,
    driverDocuments,
    documentCounts,
    checklist,
    complianceVerifiedAt: flags?.compliance_verified_at ?? null,
    complianceVerifiedBy: flags?.compliance_verified_by ?? null,
    complianceDecision: flags?.compliance_decision ?? null,
    complianceExceptionReason: flags?.compliance_exception_reason ?? null,
    complianceOutstandingSummary: flags?.compliance_outstanding_summary ?? null,
    complianceDeclinedAt: flags?.compliance_declined_at ?? null,
    complianceDeclinedBy: flags?.compliance_declined_by ?? null,
    complianceDeclineReason: flags?.compliance_decline_reason ?? null,
    advance,
    balance,
    hardCopyPod: {
      received: hardCopyReceived,
      receivedAt: trip.pod_received_at ?? null,
      courier: flags?.pod_hard_copy_courier ?? null,
      awbNumber: flags?.pod_hard_copy_awb_number ?? null,
      receivedBy: flags?.pod_hard_copy_received_by ?? null,
    },
  };
}

/** Batched inputs → summaries (detail screen, report, tests). */
export async function buildComplianceTripSummaries(
  trips: TripRow[],
): Promise<ComplianceTripSummary[]> {
  return (await fetchComplianceTripInputs(trips)).map(summarizeComplianceTrip);
}

/**
 * Vehicle-document inputs for the given trips (entity vehicle docs + vault).
 * Callers pass every trip sharing the changed vehicle so all of them update.
 */
export async function fetchVehicleDocumentsForTrips(
  trips: TripRow[],
): Promise<Map<string, { vehicleDocuments: ComplianceEntityDocument[]; vaultVehicleId: string | null }>> {
  const byTrip = new Map<string, { vehicleDocuments: ComplianceEntityDocument[]; vaultVehicleId: string | null }>();
  if (trips.length === 0) return byTrip;
  const vehicleIds = trips.map((trip) => trip.vehicle_id).filter((id): id is string => Boolean(id));
  const [entityDocsById, vault] = await Promise.all([
    fetchEntityDocumentsByIds(orgIdOf(trips), vehicleIds, ["vehicle"]),
    fetchVehicleVaultDocumentsForTrips(trips),
  ]);
  for (const trip of trips) byTrip.set(trip.id, assembleVehicleDocuments(trip, entityDocsById, vault));
  return byTrip;
}

/** Driver-document inputs (KYC + entity driver docs) for every trip passed. */
export async function fetchDriverDocumentsForTrips(
  trips: TripRow[],
): Promise<Map<string, ComplianceEntityDocument[]>> {
  const byTrip = new Map<string, ComplianceEntityDocument[]>();
  if (trips.length === 0) return byTrip;
  const driverIds = trips.map((trip) => trip.driver_id).filter((id): id is string => Boolean(id));
  const [entityDocsById, kyc] = await Promise.all([
    fetchEntityDocumentsByIds(orgIdOf(trips), driverIds, ["driver"]),
    fetchDriverKycDocumentsForTrips(trips),
  ]);
  for (const trip of trips) byTrip.set(trip.id, assembleDriverDocuments(trip, entityDocsById, kyc));
  return byTrip;
}

/**
 * Trip-specific inputs only (documents, flags, compliance transactions) for
 * many trips in 3 batched reads. Vehicle / driver documents are NOT re-read —
 * they are shared inputs refreshed only when a vehicle/driver write happens
 * or a trip's vehicle/driver identity changes.
 */
export async function fetchTripScopedInputs(
  tripIds: string[],
): Promise<Map<string, Pick<ComplianceTripInputs, "documents" | "flags" | "taggedAdvance" | "balance">>> {
  const byTrip = new Map<string, Pick<ComplianceTripInputs, "documents" | "flags" | "taggedAdvance" | "balance">>();
  if (tripIds.length === 0) return byTrip;
  const [docsByTrip, flagsByTrip, txnsByTrip] = await Promise.all([
    fetchTripDocumentsForTrips(tripIds),
    fetchComplianceTripFlags(tripIds),
    fetchComplianceTransactions(tripIds),
  ]);
  for (const id of tripIds) {
    byTrip.set(id, {
      documents: docsByTrip.get(id) ?? [],
      flags: flagsByTrip.get(id) ?? null,
      ...paymentInputs(txnsByTrip.get(id)),
    });
  }
  return byTrip;
}

/** Payment inputs (compliance transactions + `trips.amount_paid`) for one or more trips. */
export async function fetchTripPaymentInputs(
  tripIds: string[],
): Promise<
  Map<string, { taggedAdvance: CompliancePaymentSummary | null; balance: CompliancePaymentSummary | null; tripFields: Pick<TripRow, "amount_paid" | "updated_at"> | null }>
> {
  const byTrip = new Map<
    string,
    { taggedAdvance: CompliancePaymentSummary | null; balance: CompliancePaymentSummary | null; tripFields: Pick<TripRow, "amount_paid" | "updated_at"> | null }
  >();
  if (tripIds.length === 0) return byTrip;
  const [txnsByTrip, fieldsByTrip] = await Promise.all([
    fetchComplianceTransactions(tripIds),
    fetchTripPaymentFields(tripIds),
  ]);
  for (const id of tripIds) {
    byTrip.set(id, { ...paymentInputs(txnsByTrip.get(id)), tripFields: fieldsByTrip.get(id) ?? null });
  }
  return byTrip;
}

/** Whether every Compliance-required document type on a trip is verified. */
export function canMarkComplianceVerified(documents: ComplianceDocumentRow[]): {
  ok: boolean;
  missing: string[];
} {
  const byType = new Map(documents.map((d) => [d.document_type, d]));
  const missing: string[] = [];
  for (const type of REQUIRED_COMPLIANCE_DOCUMENT_TYPES) {
    const doc = byType.get(type);
    if (!doc || doc.status !== "verified") missing.push(type);
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Client-side mirror of `approve_trip_compliance_with_exception`'s outstanding
 * capture — for display only. The RPC re-derives this server-side; this is
 * never trusted as authorization, only used to render the confirmation panel.
 */
export function buildComplianceOutstandingSummary(
  documents: ComplianceDocumentRow[],
): ComplianceOutstandingSummary {
  const byType = new Map(documents.map((d) => [d.document_type, d]));
  const missing: string[] = [];
  const pending_verification: string[] = [];
  const rejected: string[] = [];
  for (const type of REQUIRED_COMPLIANCE_DOCUMENT_TYPES) {
    const doc = byType.get(type);
    if (!doc) missing.push(type);
    else if (doc.status === "pending") pending_verification.push(type);
    else if (doc.status === "rejected") rejected.push(type);
  }
  return { missing, pending_verification, rejected };
}

/**
 * A trip is eligible for "Approve with Exception" only while it hasn't been
 * decided yet and at least one required document is outstanding — a fully
 * compliant trip should go through normal `mark_trip_compliance_verified`.
 */
export function canApproveComplianceWithException(input: {
  documents: ComplianceDocumentRow[];
  complianceVerifiedAt: string | null;
}): { ok: boolean; outstanding: ComplianceOutstandingSummary } {
  const outstanding = buildComplianceOutstandingSummary(input.documents);
  const hasOutstanding =
    outstanding.missing.length > 0 || outstanding.pending_verification.length > 0 || outstanding.rejected.length > 0;
  return { ok: hasOutstanding && !input.complianceVerifiedAt, outstanding };
}
