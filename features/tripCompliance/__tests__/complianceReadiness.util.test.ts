import type { ComplianceTripSummary } from "@/features/tripCompliance/tripCompliance.types";
import { deriveComplianceQueueReadiness, summarizeRequiredTripDocuments } from "@/features/tripCompliance/utils/complianceReadiness.util";
import { classifyPreviewFailure } from "@/features/tripCompliance/utils/compliancePreviewFailure.util";
import { groupComplianceReviewRows } from "@/features/tripCompliance/utils/complianceDocumentRows.util";

function summaryFixture(overrides: Partial<ComplianceTripSummary> = {}): ComplianceTripSummary {
  return {
    trip: {
      id: "trip-1",
      booking_ref: "T-1",
      client_name: "Acme",
      status: "delivered",
    } as ComplianceTripSummary["trip"],
    stage: "compliance_pending",
    documents: [],
    vehicleDocuments: [],
    driverDocuments: [],
    documentCounts: { total: 0, verified: 0, rejected: 0, pending: 0 },
    checklist: { groups: [] as never, verified: 0, total: 11, tone: "danger" } as ComplianceTripSummary["checklist"],
    complianceVerifiedAt: null,
    complianceVerifiedBy: null,
    advance: null,
    balance: null,
    hardCopyPod: { received: false, receivedAt: null, courier: null, awbNumber: null, receivedBy: null },
    ...overrides,
  };
}

describe("deriveComplianceQueueReadiness", () => {
  it("blocks advance until compliance is marked verified", () => {
    const readiness = deriveComplianceQueueReadiness(summaryFixture());
    expect(readiness.paymentReady).toBe(false);
    expect(readiness.advance.status).toBe("blocked");
    expect(readiness.complianceVerificationIncomplete).toBe(true);
    expect(readiness.missingRequired).toEqual(["LR", "E-way Bill", "Invoice"]);
  });

  it("marks advance ready when verification is complete and no advance exists", () => {
    const readiness = deriveComplianceQueueReadiness(
      summaryFixture({
        complianceVerifiedAt: "2026-09-01",
        documents: ["lr", "eway_bill", "invoice"].map((type) => ({
          id: type,
          trip_id: "trip-1",
          document_type: type,
          file_name: `${type}.pdf`,
          storage_path: type,
          uploaded_at: "2026-09-01",
          status: "verified" as const,
          verified_by: "u1",
          verified_at: "2026-09-01",
          rejection_reason: null,
        })),
      }),
    );
    expect(readiness.requiredDocsVerified).toBe(true);
    expect(readiness.advance.status).toBe("ready");
    expect(readiness.paymentReady).toBe(true);
    expect(readiness.readyCategory).toBe("compliance_advance");
  });

  it("does not treat on-file pending docs as verified", () => {
    const readiness = deriveComplianceQueueReadiness(
      summaryFixture({
        documents: ["lr", "eway_bill", "invoice"].map((type) => ({
          id: type,
          trip_id: "trip-1",
          document_type: type,
          file_name: `${type}.pdf`,
          storage_path: type,
          uploaded_at: "2026-09-01",
          status: "pending" as const,
          verified_by: null,
          verified_at: null,
          rejection_reason: null,
        })),
      }),
    );
    expect(readiness.requiredDocsVerified).toBe(false);
    expect(readiness.pendingVerification).toEqual(["LR", "E-way Bill", "Invoice"]);
    expect(readiness.requiredDocs.verified).toBe(0);
    expect(readiness.requiredDocs.pending).toBe(3);
    expect(readiness.nextAction).toBe("Review LR");
  });
});

describe("summarizeRequiredTripDocuments", () => {
  it("counts verified separately from on-file pending and additional POD", () => {
    const summary = summarizeRequiredTripDocuments([
      {
        id: "lr",
        trip_id: "trip-1",
        document_type: "lr",
        file_name: "lr.pdf",
        storage_path: "lr",
        uploaded_at: "2026-09-01",
        status: "verified",
        verified_by: "u1",
        verified_at: "2026-09-01",
        rejection_reason: null,
      },
      {
        id: "eway",
        trip_id: "trip-1",
        document_type: "eway_bill",
        file_name: "ew.pdf",
        storage_path: "ew",
        uploaded_at: "2026-09-01",
        status: "pending",
        verified_by: null,
        verified_at: null,
        rejection_reason: null,
      },
      {
        id: "pod",
        trip_id: "trip-1",
        document_type: "pod",
        file_name: "pod.pdf",
        storage_path: "pod",
        uploaded_at: "2026-09-01",
        status: "verified",
        verified_by: "u1",
        verified_at: "2026-09-01",
        rejection_reason: null,
      },
    ]);
    expect(summary).toMatchObject({
      total: 3,
      verified: 1,
      pending: 1,
      missing: 1,
      rejected: 0,
      missingLabels: ["Invoice"],
      pendingLabels: ["E-way Bill"],
      markVerifiedReady: false,
      nextAction: "Upload Invoice",
    });
  });
});

describe("classifyPreviewFailure", () => {
  it("classifies missing, permission, and signed-url failures", () => {
    expect(classifyPreviewFailure({ hasStoragePath: false }).kind).toBe("missing");
    expect(classifyPreviewFailure({ hasStoragePath: true, error: new Error("JWT expired 403") }).kind).toBe(
      "permission_denied",
    );
    expect(classifyPreviewFailure({ hasStoragePath: true, url: null }).kind).toBe("signed_url_failed");
  });

  it("does not treat text/plain as a previewable user document", () => {
    expect(
      classifyPreviewFailure({
        hasStoragePath: true,
        url: "https://example.com/file.txt",
        mime: "text/plain",
      }).kind,
    ).toBe("unsupported");
  });
});

describe("groupComplianceReviewRows", () => {
  it("splits rejected, missing, pending, and verified", () => {
    const grouped = groupComplianceReviewRows([
      { key: "lr", type: "lr", required: true, status: "rejected", doc: null, entityDoc: null },
      { key: "invoice", type: "invoice", required: true, status: "missing", doc: null, entityDoc: null },
      { key: "eway_bill", type: "eway_bill", required: true, status: "pending", doc: null, entityDoc: null },
      { key: "pod", type: "pod", required: false, status: "verified", doc: null, entityDoc: null },
    ]);
    expect(grouped.needsAction.map((r) => r.type)).toEqual(["lr"]);
    expect(grouped.missing.map((r) => r.type)).toEqual(["invoice"]);
    expect(grouped.pending.map((r) => r.type)).toEqual(["eway_bill"]);
    expect(grouped.verified.map((r) => r.type)).toEqual(["pod"]);
  });
});
