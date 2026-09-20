import {
  canModerateComplianceRow,
  complianceReviewDecisionActions,
} from "@/features/tripCompliance/utils/complianceReviewActions.util";
import type { ComplianceDocRow } from "@/features/tripCompliance/utils/complianceDocumentRows.util";
import type { ComplianceDocumentRow } from "@/features/tripCompliance/tripCompliance.types";

function row(overrides: Partial<ComplianceDocRow> & Pick<ComplianceDocRow, "status">): ComplianceDocRow {
  const doc: ComplianceDocumentRow | null =
    overrides.status === "missing"
      ? null
      : {
          id: "doc-1",
          trip_id: "t1",
          document_type: "lr",
          file_name: "lr.pdf",
          storage_path: "path",
          uploaded_at: "2026-09-01",
          status: overrides.status === "pending" || overrides.status === "verified" || overrides.status === "rejected" ? overrides.status : "pending",
          verified_by: null,
          verified_at: null,
          rejection_reason: overrides.status === "rejected" ? "blurry" : null,
        };
  return {
    key: "lr",
    type: "lr",
    required: true,
    status: overrides.status,
    doc,
    entityDoc: null,
    ...overrides,
  };
}

describe("complianceReviewDecisionActions", () => {
  it("hides Approve/Decline until a file exists", () => {
    expect(complianceReviewDecisionActions(row({ status: "missing" }))).toEqual({ canApprove: false, canDecline: false });
  });

  it("shows Approve and Decline on pending verification", () => {
    expect(complianceReviewDecisionActions(row({ status: "pending" }))).toEqual({ canApprove: true, canDecline: true });
  });

  it("shows Decline on a verified file and Approve on a rejected file", () => {
    expect(complianceReviewDecisionActions(row({ status: "verified" }))).toEqual({ canApprove: false, canDecline: true });
    expect(complianceReviewDecisionActions(row({ status: "rejected" }))).toEqual({ canApprove: true, canDecline: false });
  });
});

describe("canModerateComplianceRow", () => {
  it("requires a trip document row", () => {
    expect(canModerateComplianceRow(row({ status: "missing" }), "trip")).toBe(false);
    expect(canModerateComplianceRow(row({ status: "pending" }), "trip")).toBe(true);
  });
});
