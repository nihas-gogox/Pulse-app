/**
 * Shared document-row derivation — used by the Trip Detail document table,
 * the Compliance trip card, the list-level table's expandable rows, and the
 * document review sheet, so all four surfaces agree on exactly the same
 * Missing/Pending/Verified/Rejected/Expired classification from one place.
 */
import {
  COMPLIANCE_FINANCE_DOCUMENT_TYPES,
  REQUIRED_COMPLIANCE_FINANCE_DOCUMENT_TYPES,
  COMPLIANCE_TRIP_OTHER_DOCUMENT_TYPES,
  REQUIRED_COMPLIANCE_DOCUMENT_TYPES,
  documentRequiresExpiry,
  isRequiredDriverDocumentType,
  isRequiredVehicleDocumentType,
  type ComplianceDocumentRow,
  type ComplianceDocumentStatus,
  type ComplianceEntityDocument,
} from "@/features/tripCompliance/tripCompliance.types";
import { isEntityDocumentExpired } from "@/features/tripCompliance/utils/complianceChecklist.util";
import { classifyTripDocument } from "@/features/tripCompliance/utils/tripDocumentClassification.util";

export const DOC_TYPE_LABEL: Record<string, string> = {
  lr: "LR",
  invoice: "Invoice",
  eway_bill: "E-way Bill",
  pod: "POD",
  manifest: "Trip Manifest",
  memo: "Memo",
  other: "Other Documents",
  bank_docs: "Bank Docs",
  loading_slip: "Loading Slip",
  insurance: "Insurance",
  rc: "RC",
  fitness: "FC",
  permit: "Permit",
  pollution: "Pollution",
  road_tax: "Tax",
  license: "Driving License",
  aadhaar: "Aadhaar",
};

/** Labels matching Asset Vault → Trip Details finance rows. */
export const FINANCE_DOC_TYPE_LABEL: Record<string, string> = {
  memo: "Memo",
  other: "Other Documents",
  bank_docs: "Bank Docs",
};

export function labelForDocType(type: string): string {
  return DOC_TYPE_LABEL[type] ?? type.replace(/_/g, " ");
}

export function labelForFinanceDocType(type: string): string {
  return FINANCE_DOC_TYPE_LABEL[type] ?? labelForDocType(type);
}

export type ComplianceDocRowStatus = ComplianceDocumentStatus | "missing" | "expired";

export type ComplianceDocRow = {
  key: string;
  type: string;
  required: boolean;
  status: ComplianceDocRowStatus;
  doc: ComplianceDocumentRow | null;
  entityDoc: ComplianceEntityDocument | null;
};

/**
 * Vault-style detail line for Finance rows (memo / other / bank file or account).
 * Returns null when there is nothing richer than status to show.
 */
export function financeVaultDetailLine(row: ComplianceDocRow): string | null {
  const fromNotes = row.entityDoc?.notes?.trim() || null;
  if (fromNotes) return fromNotes;
  const doc = row.doc;
  if (!doc) return null;
  const fileName = doc.file_name?.trim() ?? "";
  if (fileName && !/fields\.json$/i.test(fileName)) return fileName;
  return null;
}

export type FinanceBankProofMerge = {
  previewPath: string | null;
  detailLine: string | null;
  kycDocId?: string | null;
  supplierId?: string | null;
  status?: string | null;
  fileName?: string | null;
  createdAt?: string | null;
};

/**
 * Merge supplier bank KYC / cancelled-cheque into the Finance Bank Docs slot when
 * the trip has no dedicated `bank_docs` upload yet.
 */
export function mergeFinanceBankDocsFromSupplier(
  rows: ComplianceDocRow[],
  proof: FinanceBankProofMerge | null | undefined,
): ComplianceDocRow[] {
  if (!proof?.previewPath?.trim()) {
    if (!proof?.detailLine?.trim()) return rows;
    return rows.map((row) => {
      if (row.type !== "bank_docs" || row.doc || row.entityDoc) return row;
      return {
        ...row,
        status: "pending" as const,
        entityDoc: {
          id: `bank-details:${proof.supplierId ?? "unknown"}`,
          entity_type: "supplier" as const,
          entity_id: proof.supplierId ?? "",
          doc_type: "bank_docs",
          status: "pending",
          storage_path: null,
          expiry_date: null,
          verified_at: null,
          notes: proof.detailLine,
          created_at: new Date().toISOString(),
          source: "supplier-kyc" as const,
        },
      };
    });
  }
  const path = proof.previewPath.trim();
  return rows.map((row) => {
    if (row.type !== "bank_docs") return row;
    // Trip upload wins over supplier vault merge.
    if (row.doc && classifyTripDocument(row.doc).present) {
      const fileName = row.doc.file_name?.trim() || null;
      const combined = [fileName, proof.detailLine].filter(Boolean).join(" · ") || null;
      if (!combined) return row;
      return {
        ...row,
        entityDoc: {
          id: `bank-meta:${proof.supplierId ?? row.doc.id}`,
          entity_type: "supplier" as const,
          entity_id: proof.supplierId ?? "",
          doc_type: "bank_docs",
          status: "pending",
          storage_path: null,
          expiry_date: null,
          verified_at: null,
          notes: combined,
          created_at: row.doc.uploaded_at || new Date().toISOString(),
          source: "supplier-kyc" as const,
        },
      };
    }
    const verified = (proof.status ?? "").toLowerCase() === "verified";
    return {
      ...row,
      status: verified ? ("verified" as const) : ("pending" as const),
      doc: null,
      entityDoc: {
        id: proof.kycDocId?.trim() || `bank-proof:${proof.supplierId ?? path}`,
        entity_type: "supplier",
        entity_id: proof.supplierId ?? "",
        doc_type: "bank_docs",
        status: verified ? "verified" : "pending",
        storage_path: path,
        expiry_date: null,
        verified_at: verified ? proof.createdAt ?? null : null,
        notes: proof.detailLine ?? proof.fileName ?? null,
        created_at: proof.createdAt ?? new Date().toISOString(),
        source: "supplier-kyc",
      },
    };
  });
}

/**
 * Latest present doc per type (per `classifyTripDocument`). Anything openable
 * (file / url / reference) wins over a details-only row; `empty` rows never
 * stand in for a document.
 */
function latestDocByType(documents: ComplianceDocumentRow[]): Map<string | null, ComplianceDocumentRow> {
  const byType = new Map<string | null, ComplianceDocumentRow>();
  for (const doc of documents) {
    const kind = classifyTripDocument(doc);
    if (!kind.present) continue;
    const current = byType.get(doc.document_type);
    const currentBinary = current ? classifyTripDocument(current).hasBinary : false;
    const newer = !current || (doc.uploaded_at ?? "") > (current.uploaded_at ?? "");
    if (!current || (!currentBinary && kind.hasBinary) || (currentBinary === kind.hasBinary && newer)) {
      byType.set(doc.document_type, doc);
    }
  }
  return byType;
}

function rowForType(
  type: string,
  required: boolean,
  byType: Map<string | null, ComplianceDocumentRow>,
): ComplianceDocRow {
  const doc = byType.get(type) ?? null;
  return { key: type, type, required, status: doc ? doc.status : "missing", doc, entityDoc: null };
}

function latestEntityDoc(documents: ComplianceEntityDocument[]): ComplianceEntityDocument | null {
  const usable = documents.filter((doc) => doc.status !== "replaced");
  const list = usable.length > 0 ? usable : documents;
  if (list.length === 0) return null;
  // Prefer verified (or active) rows that carry an expiry — a newer pending
  // upload without expiry must not hide the verified RC/Insurance date.
  return [...list].sort((a, b) => {
    const aVerified = a.status === "verified" || a.status === "active" ? 1 : 0;
    const bVerified = b.status === "verified" || b.status === "active" ? 1 : 0;
    if (bVerified !== aVerified) return bVerified - aVerified;
    const aExpiry = a.expiry_date?.trim() ? 1 : 0;
    const bExpiry = b.expiry_date?.trim() ? 1 : 0;
    if (bExpiry !== aExpiry) return bExpiry - aExpiry;
    return b.created_at.localeCompare(a.created_at);
  })[0] ?? null;
}

function isEntityDocRequired(type: string): boolean {
  return isRequiredVehicleDocumentType(type) || isRequiredDriverDocumentType(type);
}

function entityRowStatus(
  doc: ComplianceEntityDocument | null,
  now = new Date(),
  docType?: string,
): ComplianceDocRowStatus {
  if (!doc) return "missing";
  if (doc.status === "rejected" || doc.status === "replaced") return "rejected";
  if (doc.status === "expired" || isEntityDocumentExpired(doc, now)) return "expired";
  // On file is not approval. Only an explicit verify action sets status to verified.
  if (doc.status !== "verified") return "pending";
  if (docType && documentRequiresExpiry(docType) && !doc.expiry_date?.trim()) return "pending";
  return "verified";
}

/** Vehicle or driver types from vault / entity_documents. */
export function deriveEntityComplianceRows(
  types: readonly string[],
  documents: ComplianceEntityDocument[],
  now = new Date(),
): ComplianceDocRow[] {
  const byType = new Map<string, ComplianceEntityDocument[]>();
  for (const doc of documents) {
    const list = byType.get(doc.doc_type) ?? [];
    list.push(doc);
    byType.set(doc.doc_type, list);
  }
  return types.map((type) => {
    const entityDoc = latestEntityDoc(byType.get(type) ?? []);
    return {
      key: type,
      type,
      required: isEntityDocRequired(type),
      status: entityRowStatus(entityDoc, now, type),
      doc: null,
      entityDoc,
    };
  });
}

/** Required trip types first, then other trip upload options only. */
export function deriveComplianceDocumentRows(documents: ComplianceDocumentRow[]): ComplianceDocRow[] {
  const byType = latestDocByType(documents);
  const requiredRows = REQUIRED_COMPLIANCE_DOCUMENT_TYPES.map((type) => rowForType(type, true, byType));
  const otherRows = COMPLIANCE_TRIP_OTHER_DOCUMENT_TYPES.map((type) => rowForType(type, false, byType));
  return [...requiredRows, ...otherRows];
}

/**
 * Trip vault tab in Compliance review: LR / E-way Bill / Invoice only.
 * Memo is reviewed under Finance and POD through the hardcopy POD flow.
 */
export function deriveTripVaultReviewRows(documents: ComplianceDocumentRow[]): ComplianceDocRow[] {
  return deriveComplianceDocumentRows(documents).filter((row) => row.required);
}

/**
 * Finance list: Memo, Other Documents, and Bank Docs from the trip Asset Vault.
 * LR / Invoice / Trip Manifest stay on the Trip tab — not duplicated here.
 */
export function deriveFinanceDocumentRows(documents: ComplianceDocumentRow[]): ComplianceDocRow[] {
  const byType = latestDocByType(documents);
  return COMPLIANCE_FINANCE_DOCUMENT_TYPES.map((type) =>
    rowForType(type, REQUIRED_COMPLIANCE_FINANCE_DOCUMENT_TYPES.includes(type), byType),
  );
}

/** Progress is always measured against required documents only. */
export function groupComplianceReviewRows(rows: ComplianceDocRow[]): {
  needsAction: ComplianceDocRow[];
  missing: ComplianceDocRow[];
  pending: ComplianceDocRow[];
  verified: ComplianceDocRow[];
} {
  const needsAction: ComplianceDocRow[] = [];
  const missing: ComplianceDocRow[] = [];
  const pending: ComplianceDocRow[] = [];
  const verified: ComplianceDocRow[] = [];
  for (const row of rows) {
    if (row.status === "rejected" || row.status === "expired") needsAction.push(row);
    else if (row.status === "missing") missing.push(row);
    else if (row.status === "verified") verified.push(row);
    else pending.push(row);
  }
  return { needsAction, missing, pending, verified };
}

export function requirementScopeLabel(required: boolean): string {
  return required ? "Required" : "Optional";
}

export function requiredRowNextAction(row: ComplianceDocRow): string {
  if (row.status === "missing") return "Upload a file before Approve / Decline.";
  if (row.status === "expired") return "Replace the expired file, then Approve.";
  if (row.status === "pending") {
    if (documentRequiresExpiry(row.type) && !row.entityDoc?.expiry_date?.trim()) {
      return "Add expiry date, then Approve.";
    }
    return "Preview then Approve or Decline.";
  }
  if (row.status === "rejected") return "Replace the file, then Approve.";
  return "Verified — preview or replace if needed.";
}

export function complianceProgress(rows: ComplianceDocRow[]): { verified: number; total: number } {
  const required = rows.filter((r) => r.required);
  return { verified: required.filter((r) => r.status === "verified").length, total: required.length };
}
