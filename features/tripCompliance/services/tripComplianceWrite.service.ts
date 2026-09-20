import { supabase } from "@/lib/supabase";
import { createLedgerEntry, updateLedgerEntry, type CreateLedgerEntryData } from "@/features/finance/services/finance.service";
import { buildLedgerSyncDescriptionLine } from "@/features/finance/ledger/ledgerEntryModel";
import type { TripRow } from "@/features/trips/services/trips.service";
import { evaluateCompliancePaymentGuard, type ComplianceLedgerCategory } from "@/features/tripCompliance/utils/compliancePaymentGuard.util";
import { fetchComplianceTransactions } from "@/features/tripCompliance/services/tripComplianceRead.service";
import type { ComplianceDocumentRow, ComplianceDocumentStatus } from "@/features/tripCompliance/tripCompliance.types";

/**
 * Verify or reject a single trip document. Goes through the
 * `verify_trip_document` SECURITY DEFINER RPC (migration 20260915162440) —
 * NOT a raw `.update()` — so the `trip_compliance.documents.verify` grant is
 * enforced server-side, not just hidden in the UI. The RPC also writes the
 * `document_audit_log` row atomically with the status change.
 */
export async function setTripDocumentVerification(params: {
  document: Pick<ComplianceDocumentRow, "id" | "status">;
  organizationId: string;
  actorId: string;
  status: Extract<ComplianceDocumentStatus, "verified" | "rejected">;
  rejectionReason?: string | null;
}): Promise<{ error: Error | null }> {
  const { document, status, rejectionReason } = params;
  if (status === "rejected" && !rejectionReason?.trim()) {
    return { error: new Error("A rejection reason is required.") };
  }
  const { error } = await supabase().rpc("verify_trip_document", {
    p_document_id: document.id,
    p_status: status,
    p_rejection_reason: status === "rejected" ? rejectionReason!.trim() : null,
  });
  return { error: error ? new Error(error.message) : null };
}

/**
 * Mark a trip's compliance fully verified. Goes through
 * `mark_trip_compliance_verified`, which re-derives the required-documents
 * gate server-side (never trusts the client's own check) and enforces
 * `trip_compliance.trip.mark_verified`. Required types are LR, invoice, and
 * e-way bill — the same set as REQUIRED_COMPLIANCE_DOCUMENT_TYPES.
 */
export async function markTripComplianceVerified(params: {
  tripId: string;
  actorId: string;
}): Promise<{ error: Error | null }> {
  const { error } = await supabase().rpc("mark_trip_compliance_verified", {
    p_trip_id: params.tripId,
  });
  return { error: error ? new Error(error.message) : null };
}

/**
 * Record hard-copy POD receipt via `record_trip_hard_copy_pod`, enforcing
 * `trip_compliance.pod.manage` server-side. Extends the existing POD flow's
 * metadata (courier/AWB/received-by) — no second POD system; the received
 * date remains `trips.pod_received_at`.
 */
export async function recordHardCopyPodReceipt(params: {
  tripId: string;
  courier: string;
  awbNumber: string;
  receivedBy: string;
}): Promise<{ error: Error | null }> {
  const { error } = await supabase().rpc("record_trip_hard_copy_pod", {
    p_trip_id: params.tripId,
    p_courier: params.courier,
    p_awb_number: params.awbNumber,
    p_received_by: params.receivedBy,
  });
  return { error: error ? new Error(error.message) : null };
}

export type { ComplianceLedgerCategory } from "@/features/tripCompliance/utils/compliancePaymentGuard.util";
export { evaluateCompliancePaymentGuard } from "@/features/tripCompliance/utils/compliancePaymentGuard.util";

export async function checkCompliancePaymentAllowed(params: {
  tripId: string;
  category: ComplianceLedgerCategory;
}): Promise<{ ok: boolean; reason?: string }> {
  const byTrip = await fetchComplianceTransactions([params.tripId]);
  const bucket = byTrip.get(params.tripId) ?? { advance: [], balance: [] };
  return evaluateCompliancePaymentGuard(params.category, bucket);
}

/**
 * Post a compliance advance/balance payment through the canonical Finance
 * ledger write path (`createLedgerEntry` → `transactions`). This is the ONLY
 * write path — Compliance never inserts into `transactions` directly, and
 * never maintains its own amount/status copy (Phase 7/9/12's explicit rule).
 */
export async function postCompliancePayment(params: {
  organizationId: string;
  trip: TripRow;
  category: ComplianceLedgerCategory;
  amount: number;
  paymentModeId: string;
  paymentModeLabel: string;
  utr?: string | null;
  transactionDate?: string;
  notes?: string | null;
}): Promise<{ error: Error | null }> {
  const guard = await checkCompliancePaymentAllowed({ tripId: params.trip.id, category: params.category });
  if (!guard.ok) return { error: new Error(guard.reason) };

  if (params.paymentModeId.toUpperCase() !== "CASH" && !params.utr?.trim()) {
    return { error: new Error("UTR / reference is required for non-cash payment modes.") };
  }

  const description = buildLedgerSyncDescriptionLine({
    categoryOrKind: params.category === "compliance_advance" ? "Compliance Advance" : "Compliance Balance",
    paymentModeLabel: params.paymentModeLabel,
    paymentModeId: params.paymentModeId,
    paymentReference: params.utr,
    notes: params.notes,
  });

  const entry: CreateLedgerEntryData = {
    trip_id: params.trip.id,
    trip_number: params.trip.booking_ref ?? null,
    party_name: params.trip.client_name || "Client",
    description,
    amount_in: params.amount,
    amount_out: 0,
    transaction_date: params.transactionDate,
    contact_id: params.trip.client_id,
    contact_type: params.trip.client_id ? "client" : null,
    ledger_category: params.category,
    ledger_entity_type: "client",
    ledger_flow_type: "receivable",
  };

  const { error } = await createLedgerEntry(params.organizationId, entry);
  return { error };
}

/**
 * Update an already-posted compliance payment's UTR (or amount/mode) through
 * the canonical `updateLedgerEntry()` — never a direct `transactions` write.
 * Rebuilds the description with the existing encoding convention so
 * `interpretLedgerRowStructured()` keeps reading it back correctly.
 */
export async function updateCompliancePaymentUtr(params: {
  organizationId: string;
  transactionId: string;
  trip: TripRow;
  category: ComplianceLedgerCategory;
  paymentModeId: string;
  paymentModeLabel: string;
  utr?: string | null;
  amount: number;
}): Promise<{ error: Error | null }> {
  const description = buildLedgerSyncDescriptionLine({
    categoryOrKind: params.category === "compliance_advance" ? "Compliance Advance" : "Compliance Balance",
    paymentModeLabel: params.paymentModeLabel,
    paymentModeId: params.paymentModeId,
    paymentReference: params.utr,
  });
  const { error } = await updateLedgerEntry(params.organizationId, params.transactionId, {
    trip_id: params.trip.id,
    party_name: params.trip.client_name || "Client",
    description,
    amount_in: params.amount,
    amount_out: 0,
    contact_id: params.trip.client_id,
    contact_type: params.trip.client_id ? "client" : null,
    ledger_category: params.category,
    ledger_entity_type: "client",
    ledger_flow_type: "receivable",
  });
  return { error };
}
