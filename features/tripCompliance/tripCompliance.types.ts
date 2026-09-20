import type { TripRow } from "@/features/trips/services/trips.service";

/**
 * The 7 named stages from the product spec, plus "all" for the filter chip.
 * Derived, never persisted as a single column — see deriveComplianceStage().
 */
export type ComplianceStage =
  | "pending_for_docs"
  | "compliance_pending"
  | "compliance_verified"
  | "advance_payment_processed"
  | "hard_copy_pod_received"
  | "balance_pending"
  | "payment_settled";

export const COMPLIANCE_STAGES: readonly ComplianceStage[] = [
  "pending_for_docs",
  "compliance_pending",
  "compliance_verified",
  "advance_payment_processed",
  "hard_copy_pod_received",
  "balance_pending",
  "payment_settled",
];

export const COMPLIANCE_STAGE_LABEL: Record<ComplianceStage, string> = {
  pending_for_docs: "Pending for Docs",
  compliance_pending: "Compliance Pending",
  compliance_verified: "Compliance Verified",
  advance_payment_processed: "Advance Payment Processed",
  hard_copy_pod_received: "Hard Copy POD Received",
  balance_pending: "Balance Pending",
  payment_settled: "Payment Settled",
};

/** Shorter filter-chip labels from the Compliance Verification workbench. */
export const COMPLIANCE_STAGE_FILTER_LABEL: Record<ComplianceStage, string> = {
  pending_for_docs: "Pending Docs",
  compliance_pending: "Compliance Pending",
  compliance_verified: "Verified",
  advance_payment_processed: "Advance Processed",
  hard_copy_pod_received: "POD Received",
  balance_pending: "Balance Pending",
  payment_settled: "Settled",
};

export type ComplianceChecklistTone = "success" | "warning" | "danger";

export type ComplianceChecklistSlot = {
  type: string;
  verified: boolean;
};

export type ComplianceChecklistGroup = {
  key: "trip" | "vehicle" | "driver";
  label: "Trip" | "Vehicle" | "Driver";
  slots: ComplianceChecklistSlot[];
  verified: number;
  total: number;
  tone: ComplianceChecklistTone;
};

export type ComplianceChecklist = {
  groups: [ComplianceChecklistGroup, ComplianceChecklistGroup, ComplianceChecklistGroup];
  verified: number;
  total: number;
  tone: ComplianceChecklistTone;
};

export type ComplianceDocumentStatus = "pending" | "verified" | "rejected";

export type ComplianceDocumentRow = {
  id: string;
  trip_id: string;
  document_type: string | null;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
  uploaded_by?: string | null;
  status: ComplianceDocumentStatus;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  mime_type?: string | null;
  document_number?: string | null;
};

/** Vehicle/driver docs shown on Compliance — vault JSONB, KYC, or entity_documents. */
export type ComplianceEntityDocumentSource = "vehicle-vault" | "driver-kyc" | "entity";

export type ComplianceEntityDocument = {
  id: string;
  entity_type: "vehicle" | "driver";
  entity_id: string;
  doc_type: string;
  status: string;
  storage_path: string | null;
  expiry_date: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  source?: ComplianceEntityDocumentSource;
};

/** Canonical Finance payment state, read (not duplicated) from `transactions`. */
export type CompliancePaymentSummary = {
  amount: number;
  paymentMode: string | null;
  utr: string | null;
  paidAt: string;
  actorId: string | null;
  transactionId: string;
};

export type ComplianceTripSummary = {
  trip: TripRow;
  stage: ComplianceStage;
  documents: ComplianceDocumentRow[];
  vehicleDocuments: ComplianceEntityDocument[];
  driverDocuments: ComplianceEntityDocument[];
  documentCounts: { total: number; verified: number; rejected: number; pending: number };
  checklist: ComplianceChecklist;
  complianceVerifiedAt: string | null;
  complianceVerifiedBy: string | null;
  advance: CompliancePaymentSummary | null;
  balance: CompliancePaymentSummary | null;
  hardCopyPod: {
    received: boolean;
    receivedAt: string | null;
    courier: string | null;
    awbNumber: string | null;
    receivedBy: string | null;
  };
};

/** Trip docs required before a trip can be marked Compliance Verified. */
export const REQUIRED_COMPLIANCE_DOCUMENT_TYPES: readonly string[] = [
  "lr",
  "eway_bill",
  "invoice",
];

/** Extra trip-doc types the review sheet can add — not required to mark verified. */
export const COMPLIANCE_TRIP_OTHER_DOCUMENT_TYPES: readonly string[] = [
  "pod",
  "loading_slip",
  "manifest",
];

/** Vehicle checklist — RC, insurance, FC, permit, pollution, tax. */
export const COMPLIANCE_VEHICLE_DOCUMENT_TYPES: readonly string[] = [
  "rc",
  "insurance",
  "fitness",
  "permit",
  "pollution",
  "road_tax",
];

/** Driver checklist — licence and Aadhaar only. */
export const COMPLIANCE_DRIVER_DOCUMENT_TYPES: readonly string[] = [
  "license",
  "aadhaar",
];
