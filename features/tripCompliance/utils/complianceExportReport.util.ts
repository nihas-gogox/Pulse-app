import type { ComplianceTripSummary } from "@/features/tripCompliance/tripCompliance.types";

/** Trips currently sitting in the Verified stage chip. */
export function verifiedStageSummaries(summaries: ComplianceTripSummary[]): ComplianceTripSummary[] {
  return summaries.filter((summary) => summary.stage === "compliance_verified");
}

/** Present documents on Verified-stage trips — what Export Report can download. */
export function countVerifiedStageDocuments(summaries: ComplianceTripSummary[]): number {
  return verifiedStageSummaries(summaries).reduce(
    (total, summary) => total + (summary.documentCounts?.total ?? 0),
    0,
  );
}

export function formatVerifiedStageExportCopy(documentCount: number): string {
  const count = Math.max(0, Math.floor(documentCount));
  return `${count} document${count === 1 ? "" : "s"} ready to be downloaded`;
}
