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
 * Approve a trip's compliance despite outstanding required documents. Goes
 * through `approve_trip_compliance_with_exception`, which re-derives the
 * missing/pending/rejected snapshot server-side, enforces the same
 * `trip_compliance.trip.mark_verified` grant as normal approval, requires a
 * non-empty comment, and is safe under retry (idempotent on
 * `trip_workflow_events`). Does not post any payment or touch the Finance
 * ledger — it only makes the trip eligible for the existing advance flow,
 * exactly like `markTripComplianceVerified` does.
 */
export async function approveComplianceWithException(params: {
  tripId: string;
  comment: string;
}): Promise<{ error: Error | null }> {
  if (!params.comment.trim()) {
    return { error: new Error("A comment is required to approve compliance with an exception.") };
  }
  const { error } = await supabase().rpc("approve_trip_compliance_with_exception", {
    p_trip_id: params.tripId,
    p_comment: params.comment.trim(),
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
 * The only "expected amount" concept this schema actually has is the trip's
 * total `client_price` — there is no advance/balance split ratio anywhere to
 * validate against, so this is a sanity ceiling (catches a stray extra
 * digit), not a new precise business rule. Skipped when client_price isn't
 * set (0/null), matching how the rest of Compliance treats an unset price.
 */
export function validateCompliancePaymentAmount(params: {
  amount: number;
  trip: Pick<TripRow, "client_price">;
}): { ok: boolean; reason?: string } {
  const clientPrice = Number(params.trip.client_price ?? 0);
  if (clientPrice <= 0) return { ok: true };
  if (params.amount > clientPrice) {
    return {
      ok: false,
      reason: `Amount ₹${params.amount.toLocaleString("en-IN")} exceeds the trip value ₹${clientPrice.toLocaleString("en-IN")}.`,
    };
  }
  return { ok: true };
}

/**
 * `transactions.payment_reference` (migration 20260921105432) is the
 * authoritative "already processed" signal at the DB level — a unique index
 * on (trip_id, ledger_category) for compliance rows means a concurrent or
 * retried post fails with 23505, not a generic error. Not yet applied to any
 * live database (production is frozen) — this only changes how a 23505 is
 * *worded* if/when it occurs; it doesn't fabricate protection that isn't
 * really there in the DB.
 */
function isDuplicateComplianceLedgerWrite(error: Error): boolean {
  return (error as Error & { code?: string }).code === "23505";
}

/**
 * Migration 20260921125437 (Phase 6) is the real server-side boundary: two
 * RESTRICTIVE RLS policies on `transactions` reject a compliance_advance
 * insert/update unless `trips.compliance_verified_at IS NOT NULL`, and a
 * compliance_balance one unless `trips.pod_received_at IS NOT NULL` — closing
 * the P0 Phase 5 found (compliance/POD prerequisites were UI-only). A
 * rejected write surfaces as Postgres 42501 (insufficient_privilege).
 */
function isComplianceLedgerPrerequisiteRejection(error: Error): boolean {
  return (error as Error & { code?: string }).code === "42501";
}

/**
 * Client-side mirror of the RLS prerequisite (fail fast with a specific
 * message instead of a generic RLS error) — NOT the security boundary
 * itself, which is migration 20260921125437. Exception approval counts as
 * approved: compliance_verified_at is set by both mark_trip_compliance_verified()
 * and approve_trip_compliance_with_exception(), so checking it alone (not
 * compliance_decision) already means "approved OR approved_with_exception".
 */
function checkComplianceLedgerPrerequisite(
  category: ComplianceLedgerCategory,
  trip: Pick<TripRow, "compliance_verified_at" | "pod_received_at">,
): { ok: boolean; reason?: string } {
  if (category === "compliance_advance" && !trip.compliance_verified_at) {
    return { ok: false, reason: "Compliance must be approved before an advance payment can be posted." };
  }
  if (category === "compliance_balance" && !trip.pod_received_at) {
    return { ok: false, reason: "Hard-copy POD must be received before a balance payment can be posted." };
  }
  return { ok: true };
}

/**
 * Post a compliance advance/balance payment through the canonical Finance
 * ledger write path (`createLedgerEntry` → `transactions`). This is the ONLY
 * write path — Compliance never inserts into `transactions` directly, and
 * never maintains its own amount/status copy (Phase 7/9/12's explicit rule).
 * Shared by both the single-payment and bulk-import flows.
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

  const prerequisite = checkComplianceLedgerPrerequisite(params.category, params.trip);
  if (!prerequisite.ok) return { error: new Error(prerequisite.reason) };

  if (params.paymentModeId.toUpperCase() !== "CASH" && !params.utr?.trim()) {
    return { error: new Error("UTR / reference is required for non-cash payment modes.") };
  }

  const amountCheck = validateCompliancePaymentAmount({ amount: params.amount, trip: params.trip });
  if (!amountCheck.ok) return { error: new Error(amountCheck.reason) };

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
    payment_reference: params.utr?.trim() || null,
  };

  const { error } = await createLedgerEntry(params.organizationId, entry);
  if (error && isDuplicateComplianceLedgerWrite(error)) {
    return {
      error: new Error(
        `This ${params.category === "compliance_advance" ? "advance" : "balance"} payment has already been posted for this trip. Refresh to see the existing entry.`,
      ),
    };
  }
  if (error && isComplianceLedgerPrerequisiteRejection(error)) {
    // Reached only if server-side trip state disagreed with the client-side
    // pre-check above (e.g. stale cached trip data) — the RLS policy is the
    // real boundary here, this is just a clearer message than a raw 42501.
    return {
      error: new Error(
        params.category === "compliance_advance"
          ? "Compliance must be approved before an advance payment can be posted. Refresh and try again."
          : "Hard-copy POD must be received before a balance payment can be posted. Refresh and try again.",
      ),
    };
  }
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
    payment_reference: params.utr?.trim() || null,
  });
  return { error };
}
