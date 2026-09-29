import type { ComplianceDocRow } from "@/features/tripCompliance/utils/complianceDocumentRows.util";

export function canModerateComplianceRow(row: ComplianceDocRow, scope: "trip" | "vehicle" | "driver"): boolean {
  if (row.status === "missing") return false;
  if (scope === "trip") return Boolean(row.doc);
  // Driver KYC is moderated elsewhere; vehicle vault can Approve (set expiry) but not Decline.
  if (row.entityDoc?.source === "driver-kyc") return false;
  return Boolean(row.entityDoc);
}

/** Approve/Decline on uploaded docs. Missing files must be uploaded first. Verified docs stay verified-only (no Decline). */
export function complianceReviewDecisionActions(row: ComplianceDocRow): { canApprove: boolean; canDecline: boolean } {
  if (row.status === "missing" || row.status === "verified") {
    return { canApprove: false, canDecline: false };
  }
  const vaultOnly = row.entityDoc?.source === "vehicle-vault";
  return {
    canApprove: true,
    canDecline: !vaultOnly && row.status !== "rejected",
  };
}

/**
 * Group Approve/Decline appears only after every doc in the group is uploaded,
 * and at least one still needs a decision (pending / rejected / expired).
 */
export function complianceGroupDecisionActions(
  groupRows: ComplianceDocRow[],
  scope: "trip" | "vehicle" | "driver",
): { ready: boolean; canApprove: boolean; canDecline: boolean; actionable: ComplianceDocRow[] } {
  if (groupRows.length === 0) {
    return { ready: false, canApprove: false, canDecline: false, actionable: [] };
  }
  const allUploaded = groupRows.every((row) => row.status !== "missing");
  if (!allUploaded) {
    return { ready: false, canApprove: false, canDecline: false, actionable: [] };
  }
  const actionable = groupRows.filter((row) => {
    if (!canModerateComplianceRow(row, scope)) return false;
    const decisions = complianceReviewDecisionActions(row);
    return decisions.canApprove || decisions.canDecline;
  });
  if (actionable.length === 0) {
    return { ready: false, canApprove: false, canDecline: false, actionable: [] };
  }
  return {
    ready: true,
    canApprove: actionable.some((row) => complianceReviewDecisionActions(row).canApprove),
    canDecline: actionable.some((row) => complianceReviewDecisionActions(row).canDecline),
    actionable,
  };
}

/** Optimistic Approve/Decline recorded against the exact row version it was made on. */
export type OptimisticComplianceDecision = {
  decision: "verified" | "rejected";
  /** `complianceRowVersion` at decision time — a re-upload changes it. */
  version: string;
  /** Server status at decision time — any server-side move away from it wins. */
  fromStatus: ComplianceDocRow["status"];
};

/** Identity of the file behind a row: `key` is only the doc type, so it survives re-uploads. */
export function complianceRowVersion(row: ComplianceDocRow): string {
  if (row.doc) return `trip:${row.doc.id}:${row.doc.storage_path}:${row.doc.uploaded_at}`;
  if (row.entityDoc) return `entity:${row.entityDoc.id}:${row.entityDoc.storage_path ?? ""}:${row.entityDoc.created_at}`;
  return "none";
}

export function recordOptimisticDecision(
  row: ComplianceDocRow,
  decision: OptimisticComplianceDecision["decision"],
): OptimisticComplianceDecision {
  return { decision, version: complianceRowVersion(row), fromStatus: row.status };
}

/**
 * Overlay a local decision only while the server still shows the same file in the
 * same status it had when the decision was made. Once a refetch reflects the
 * decision, a re-upload lands, or someone else changes the status, the server row wins.
 */
export function applyOptimisticDecision(
  row: ComplianceDocRow,
  local: OptimisticComplianceDecision | undefined,
): ComplianceDocRow {
  if (!local) return row;
  if (local.version !== complianceRowVersion(row) || local.fromStatus !== row.status) return row;
  return { ...row, status: local.decision };
}
