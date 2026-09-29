import {
  applyOptimisticDecision,
  canModerateComplianceRow,
  complianceGroupDecisionActions,
  complianceReviewDecisionActions,
  recordOptimisticDecision,
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

  it("hides Approve and Decline once a file is verified, and shows Approve on a rejected file", () => {
    expect(complianceReviewDecisionActions(row({ status: "verified" }))).toEqual({ canApprove: false, canDecline: false });
    expect(complianceReviewDecisionActions(row({ status: "rejected" }))).toEqual({ canApprove: true, canDecline: false });
  });
});

describe("complianceGroupDecisionActions", () => {
  it("stays hidden while any required doc is still missing", () => {
    expect(
      complianceGroupDecisionActions(
        [row({ status: "pending", key: "rc", type: "rc" }), row({ status: "missing", key: "insurance", type: "insurance" })],
        "trip",
      ).ready,
    ).toBe(false);
  });

  it("exposes Approve/Decline once every doc in the group is uploaded", () => {
    const result = complianceGroupDecisionActions(
      [
        row({ status: "pending", key: "rc", type: "rc" }),
        row({ status: "pending", key: "insurance", type: "insurance" }),
        row({ status: "pending", key: "fitness", type: "fitness" }),
      ],
      "trip",
    );
    expect(result.ready).toBe(true);
    expect(result.canApprove).toBe(true);
    expect(result.canDecline).toBe(true);
    expect(result.actionable).toHaveLength(3);
  });
});

describe("canModerateComplianceRow", () => {
  it("requires a trip document row", () => {
    expect(canModerateComplianceRow(row({ status: "missing" }), "trip")).toBe(false);
    expect(canModerateComplianceRow(row({ status: "pending" }), "trip")).toBe(true);
  });

  it("allows Approve on vehicle vault rows but not driver KYC", () => {
    expect(
      canModerateComplianceRow(
        row({
          status: "pending",
          entityDoc: {
            id: "v1-fitness",
            entity_type: "vehicle",
            entity_id: "v1",
            doc_type: "fitness",
            status: "active",
            storage_path: "path",
            expiry_date: null,
            verified_at: null,
            notes: null,
            created_at: "2026-09-01",
            source: "vehicle-vault",
          },
          doc: null,
        }),
        "vehicle",
      ),
    ).toBe(true);
    expect(
      canModerateComplianceRow(
        row({
          status: "pending",
          entityDoc: {
            id: "d1-license",
            entity_type: "driver",
            entity_id: "d1",
            doc_type: "license",
            status: "active",
            storage_path: "path",
            expiry_date: null,
            verified_at: null,
            notes: null,
            created_at: "2026-09-01",
            source: "driver-kyc",
          },
          doc: null,
        }),
        "driver",
      ),
    ).toBe(false);
  });
});

describe("complianceReviewDecisionActions vault", () => {
  it("hides Decline for vehicle-vault rows", () => {
    expect(
      complianceReviewDecisionActions(
        row({
          status: "pending",
          entityDoc: {
            id: "v1-fitness",
            entity_type: "vehicle",
            entity_id: "v1",
            doc_type: "fitness",
            status: "active",
            storage_path: "path",
            expiry_date: null,
            verified_at: null,
            notes: null,
            created_at: "2026-09-01",
            source: "vehicle-vault",
          },
          doc: null,
        }),
      ),
    ).toEqual({ canApprove: true, canDecline: false });
  });
});

describe("optimistic decisions", () => {
  const pending = row({ status: "pending" });

  it("overlays the local decision on the same file while the server still shows the old status", () => {
    const local = recordOptimisticDecision(pending, "verified");
    expect(applyOptimisticDecision(pending, local).status).toBe("verified");
  });

  it("lets the server row win once a refetch reflects the decision", () => {
    const local = recordOptimisticDecision(pending, "rejected");
    const refetched = row({ status: "rejected" });
    expect(applyOptimisticDecision(refetched, local)).toBe(refetched);
  });

  it("drops the override after a re-upload of the same doc type", () => {
    const local = recordOptimisticDecision(pending, "rejected");
    const reuploaded: typeof pending = {
      ...pending,
      doc: { ...pending.doc!, id: "doc-2", storage_path: "path-2", uploaded_at: "2026-09-02" },
    };
    expect(applyOptimisticDecision(reuploaded, local).status).toBe("pending");
  });

  it("lets a server-side status change by someone else win", () => {
    const local = recordOptimisticDecision(pending, "verified");
    const expired = { ...pending, status: "expired" as const };
    expect(applyOptimisticDecision(expired, local).status).toBe("expired");
  });

  it("is a no-op without a local decision", () => {
    expect(applyOptimisticDecision(pending, undefined)).toBe(pending);
  });
});
