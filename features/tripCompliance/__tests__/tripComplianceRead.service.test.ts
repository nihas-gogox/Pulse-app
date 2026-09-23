import {
    advanceFromTripReceipts,
    buildComplianceOutstandingSummary,
    canApproveComplianceWithException,
    canMarkComplianceVerified,
    deriveComplianceStage,
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

  it("keeps ADVANCE_PAYMENT_PROCESSED when Finance already collected amount_paid but docs/verification are incomplete", () => {
    expect(
      deriveComplianceStage({
        documentCount: 0,
        complianceVerifiedAt: null,
        advance: PAYMENT,
        tripStatus: "assigned",
        hardCopyReceived: false,
        balance: null,
      }),
    ).toBe("advance_payment_processed");
  });

  it("is HARD_COPY_POD_RECEIVED for completed trips with advance (Ops Delivered status)", () => {
    expect(
      deriveComplianceStage({
        documentCount: 3,
        missingRequiredCount: 0,
        complianceVerifiedAt: null,
        advance: PAYMENT,
        tripStatus: "completed",
        hardCopyReceived: false,
        balance: null,
      }),
    ).toBe("hard_copy_pod_received");
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

describe("advanceFromTripReceipts", () => {
  it("treats trips.amount_paid as an advance signal", () => {
    expect(
      advanceFromTripReceipts({
        id: "trip-1",
        amount_paid: 11000,
        updated_at: "2026-09-21T10:00:00Z",
        created_at: "2026-09-01T00:00:00Z",
      }),
    ).toMatchObject({ amount: 11000, transactionId: "amount-paid:trip-1" });
  });

  it("ignores unpaid trips", () => {
    expect(
      advanceFromTripReceipts({
        id: "trip-1",
        amount_paid: 0,
        updated_at: "2026-09-21T10:00:00Z",
        created_at: "2026-09-01T00:00:00Z",
      }),
    ).toBeNull();
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

describe("buildComplianceOutstandingSummary", () => {
  it("captures a missing required document (no row at all)", () => {
    const result = buildComplianceOutstandingSummary([
      doc({ id: "1", document_type: "lr", status: "verified" }),
      doc({ id: "2", document_type: "invoice", status: "verified" }),
    ]);
    expect(result.missing).toEqual(["eway_bill"]);
    expect(result.pending_verification).toEqual([]);
    expect(result.rejected).toEqual([]);
  });

  it("captures a pending-verification required document", () => {
    const result = buildComplianceOutstandingSummary([
      doc({ id: "1", document_type: "lr", status: "verified" }),
      doc({ id: "2", document_type: "invoice", status: "pending" }),
      doc({ id: "3", document_type: "eway_bill", status: "verified" }),
    ]);
    expect(result.pending_verification).toEqual(["invoice"]);
    expect(result.missing).toEqual([]);
  });

  it("captures a rejected required document", () => {
    const result = buildComplianceOutstandingSummary([
      doc({ id: "1", document_type: "lr", status: "verified" }),
      doc({ id: "2", document_type: "invoice", status: "rejected" }),
      doc({ id: "3", document_type: "eway_bill", status: "verified" }),
    ]);
    expect(result.rejected).toEqual(["invoice"]);
  });

  it("is empty once every required type is verified", () => {
    const result = buildComplianceOutstandingSummary([
      doc({ id: "1", document_type: "lr", status: "verified" }),
      doc({ id: "2", document_type: "invoice", status: "verified" }),
      doc({ id: "3", document_type: "eway_bill", status: "verified" }),
    ]);
    expect(result).toEqual({ missing: [], pending_verification: [], rejected: [] });
  });
});

describe("canApproveComplianceWithException", () => {
  it("is eligible when the trip has outstanding required docs and hasn't been decided", () => {
    const result = canApproveComplianceWithException({
      documents: [doc({ id: "1", document_type: "lr", status: "verified" })],
      complianceVerifiedAt: null,
    });
    expect(result.ok).toBe(true);
    expect(result.outstanding.missing).toEqual(expect.arrayContaining(["invoice", "eway_bill"]));
  });

  it("is not eligible once every required doc is verified — normal approval applies instead", () => {
    const result = canApproveComplianceWithException({
      documents: [
        doc({ id: "1", document_type: "lr", status: "verified" }),
        doc({ id: "2", document_type: "invoice", status: "verified" }),
        doc({ id: "3", document_type: "eway_bill", status: "verified" }),
      ],
      complianceVerifiedAt: null,
    });
    expect(result.ok).toBe(false);
  });

  it("is not eligible once the trip already has a compliance decision", () => {
    const result = canApproveComplianceWithException({
      documents: [doc({ id: "1", document_type: "lr", status: "verified" })],
      complianceVerifiedAt: "2026-09-01T00:00:00Z",
    });
    expect(result.ok).toBe(false);
  });
});
