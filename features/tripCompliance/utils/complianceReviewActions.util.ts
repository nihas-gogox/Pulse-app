import type { ComplianceDocRow } from "@/features/tripCompliance/utils/complianceDocumentRows.util";

export function canModerateComplianceRow(row: ComplianceDocRow, scope: "trip" | "vehicle" | "driver"): boolean {
  if (row.status === "missing") return false;
  if (scope === "trip") return Boolean(row.doc);
  return Boolean(row.entityDoc) && row.entityDoc?.source !== "vehicle-vault" && row.entityDoc?.source !== "driver-kyc";
}

/** Approve/Decline on uploaded docs. Missing files must be uploaded first. */
export function complianceReviewDecisionActions(row: ComplianceDocRow): { canApprove: boolean; canDecline: boolean } {
  if (row.status === "missing") return { canApprove: false, canDecline: false };
  return {
    canApprove: row.status !== "verified",
    canDecline: row.status !== "rejected",
  };
}
