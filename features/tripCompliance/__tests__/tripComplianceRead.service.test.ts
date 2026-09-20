import {
  deriveComplianceStage,
  canMarkComplianceVerified,
} from "@/features/tripCompliance/services/tripComplianceRead.service";
import type { ComplianceDocumentRow } from "@/features/tripCompliance/tripCompliance.types";

const PAYMENT = {
  amount: 1000,
  paymentMode: "UPI",
  utr: "UTR123",
  paidAt: "2026-09-01",
  actorId: "user-1",
  transactionId: "txn-1",
};

describe("deriveComplianceStage", () => {
  it("is PENDING_FOR_DOCS when no documents exist", () => {
    expect(
      deriveComplianceStage({
        documentCount: 0,
        complianceVerifiedAt: null,
        advance: null,
        tripStatus: "loading",
        hardCopyReceived: false,
        balance: null,
      }),
    ).toBe("pending_for_docs");
  });

  it("is COMPLIANCE_PENDING once docs exist but none are verified", () => {
    expect(
      deriveComplianceStage({
        documentCount: 3,
        complianceVerifiedAt: null,
        advance: null,
        tripStatus: "loading",
        hardCopyReceived: false,
        balance: null,
      }),
    ).toBe("compliance_pending");
  });

  it("never blocks on trip status — a trip already IN_TRANSIT with compliance still pending stays COMPLIANCE_PENDING, not an error state", () => {
    expect(
      deriveComplianceStage({
        documentCount: 3,
        complianceVerifiedAt: null,
        advance: null,
        tripStatus: "in_transit",
        hardCopyReceived: false,
        balance: null,
      }),
    ).toBe("compliance_pending");
  });

  it("is COMPLIANCE_VERIFIED once verified and no advance posted yet", () => {
    expect(
      deriveComplianceStage({
        documentCount: 3,
        complianceVerifiedAt: "2026-09-01T00:00:00Z",
        advance: null,
        tripStatus: "loading",
        hardCopyReceived: false,
        balance: null,
      }),
    ).toBe("compliance_verified");
  });

  it("is ADVANCE_PAYMENT_PROCESSED once advance posted and trip not yet delivered", () => {
    expect(
      deriveComplianceStage({
        documentCount: 3,
        complianceVerifiedAt: "2026-09-01T00:00:00Z",
        advance: PAYMENT,
        tripStatus: "in_transit",
        hardCopyReceived: false,
        balance: null,
      }),
    ).toBe("advance_payment_processed");
  });

  it("is HARD_COPY_POD_RECEIVED once delivered but hard-copy POD not yet marked received", () => {
    expect(
      deriveComplianceStage({
        documentCount: 3,
        complianceVerifiedAt: "2026-09-01T00:00:00Z",
        advance: PAYMENT,
        tripStatus: "delivered",
        hardCopyReceived: false,
        balance: null,
      }),
    ).toBe("hard_copy_pod_received");
  });

  it("is BALANCE_PENDING once hard-copy POD marked received but no balance posted", () => {
    expect(
      deriveComplianceStage({
        documentCount: 3,
        complianceVerifiedAt: "2026-09-01T00:00:00Z",
        advance: PAYMENT,
        tripStatus: "delivered",
        hardCopyReceived: true,
        balance: null,
      }),
    ).toBe("balance_pending");
  });

  it("is PAYMENT_SETTLED once balance is posted", () => {
    expect(
      deriveComplianceStage({
        documentCount: 3,
        complianceVerifiedAt: "2026-09-01T00:00:00Z",
        advance: PAYMENT,
        tripStatus: "delivered",
        hardCopyReceived: true,
        balance: PAYMENT,
      }),
    ).toBe("payment_settled");
  });
});

function doc(overrides: Partial<ComplianceDocumentRow>): ComplianceDocumentRow {
  return {
    id: overrides.id ?? "doc-1",
    trip_id: "trip-1",
    document_type: "lr",
    file_name: "f.pdf",
    storage_path: "path",
    uploaded_at: "2026-09-01",
    status: "pending",
    verified_by: null,
    verified_at: null,
    rejection_reason: null,
    ...overrides,
  };
}

describe("canMarkComplianceVerified", () => {
  it("fails when required document types are missing entirely", () => {
    const result = canMarkComplianceVerified([doc({ document_type: "lr", status: "verified" })]);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("invoice");
  });

  it("fails when a required document type exists but isn't verified", () => {
    const result = canMarkComplianceVerified([
      doc({ id: "1", document_type: "lr", status: "verified" }),
      doc({ id: "2", document_type: "invoice", status: "pending" }),
      doc({ id: "3", document_type: "eway_bill", status: "verified" }),
    ]);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["invoice"]);
  });

  it("passes only once LR, e-way bill, and invoice are verified", () => {
    const result = canMarkComplianceVerified([
      doc({ id: "1", document_type: "lr", status: "verified" }),
      doc({ id: "2", document_type: "invoice", status: "verified" }),
      doc({ id: "3", document_type: "eway_bill", status: "verified" }),
    ]);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });
});
