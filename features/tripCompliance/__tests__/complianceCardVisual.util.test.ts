import {
  paymentStatusVisual,
  pendingDocumentsCopy,
  splitPlace,
  complianceTripDisplayId,
  formatComplianceTimestamp,
  matchesComplianceTripSearch,
  verificationStatusVisual,
  shouldShowPaymentStatusPill,
} from "@/features/tripCompliance/utils/complianceCardVisual.util";
import type { ComplianceTripSummary } from "@/features/tripCompliance/tripCompliance.types";
import { emptyComplianceChecklist } from "@/features/tripCompliance/utils/complianceChecklist.util";
import type { TripRow } from "@/features/trips/services/trips.service";

function summary(overrides: Partial<ComplianceTripSummary> = {}): ComplianceTripSummary {
  return {
    trip: { id: "t1", client_name: "Sunflag", pickup_area: "Warangal, Telangana", drop_location: "Uthukkottai, Tamil Nadu" } as TripRow,
    stage: "compliance_pending",
    documents: [],
    vehicleDocuments: [],
    driverDocuments: [],
    documentCounts: { total: 0, verified: 0, rejected: 0, pending: 0 },
    checklist: emptyComplianceChecklist(),
    complianceVerifiedAt: null,
    complianceVerifiedBy: null,
    complianceDecision: null,
    complianceOutstandingSummary: null,
    advance: null,
    balance: null,
    hardCopyPod: { received: false, receivedAt: null, courier: null, awbNumber: null, receivedBy: null },
    ...overrides,
  };
}

describe("complianceCardVisual", () => {
  it("splits city and region on comma", () => {
    expect(splitPlace("Warangal, Telangana")).toEqual({ city: "Warangal", region: "Telangana" });
  });

  it("maps payment labels from existing payment/stage fields", () => {
    expect(paymentStatusVisual(summary()).label).toBe("Pending");
    expect(paymentStatusVisual(summary({ stage: "advance_payment_processed" })).label).toBe("Advance Processed");
    expect(paymentStatusVisual(summary({ stage: "balance_pending" })).label).toBe("Balance Pending");
  });

  it("keeps verification status independent of advance payment", () => {
    expect(verificationStatusVisual(summary({ documentCounts: { total: 0, verified: 0, rejected: 0, pending: 0 } })).label).toBe(
      "Pending Docs",
    );
    expect(
      verificationStatusVisual(
        summary({
          stage: "advance_payment_processed",
          advance: {
            amount: 1000,
            paymentMode: "UPI",
            utr: "x",
            paidAt: "2026-09-01",
            actorId: null,
            transactionId: "tx1",
          },
          documentCounts: { total: 2, verified: 0, rejected: 0, pending: 2 },
        }),
      ).label,
    ).toBe("Compliance Pending");
    expect(
      verificationStatusVisual(
        summary({
          stage: "advance_payment_processed",
          complianceVerifiedAt: "2026-09-01",
          complianceDecision: "approved",
          advance: {
            amount: 1000,
            paymentMode: "UPI",
            utr: "x",
            paidAt: "2026-09-01",
            actorId: null,
            transactionId: "tx1",
          },
        }),
      ).label,
    ).toBe("Verified");
    expect(
      verificationStatusVisual(
        summary({
          complianceVerifiedAt: "2026-09-01",
          complianceDecision: "approved_with_exception",
        }),
      ).label,
    ).toBe("Exception");
  });

  it("shows payment pill once advance or later pipeline stages exist", () => {
    expect(shouldShowPaymentStatusPill(summary())).toBe(false);
    expect(shouldShowPaymentStatusPill(summary({ stage: "advance_payment_processed" }))).toBe(true);
    expect(
      shouldShowPaymentStatusPill(
        summary({
          advance: {
            amount: 1,
            paymentMode: null,
            utr: null,
            paidAt: "2026-09-01",
            actorId: null,
            transactionId: "tx",
          },
        }),
      ),
    ).toBe(true);
  });

  it("uses screenshot copy for pending documents", () => {
    expect(pendingDocumentsCopy(5, 0, 5)).toBe("5 documents need verification");
    expect(pendingDocumentsCopy(3, 2, 5)).toBe("3 documents pending");
    expect(pendingDocumentsCopy(0, 5, 5)).toBe("All documents verified");
  });

  it("prefers display_trip_id for the card trip id", () => {
    expect(complianceTripDisplayId({ id: "uuid-long", display_trip_id: "ggxtn001", trip_number: "TRP001", booking_ref: "BK" })).toBe("ggxtn001");
  });

  it("formats timestamps as 14 Oct, 03:20 PM", () => {
    expect(formatComplianceTimestamp("2026-10-14T15:20:00")).toBe("14 Oct, 03:20 PM");
  });
});

describe("matchesComplianceTripSearch", () => {
  it("matches trip id, vehicle, and driver without spaces", () => {
    const row = summary({
      trip: {
        id: "uuid-1",
        display_trip_id: "TRP151",
        vehicle_display_number: "TN 16 YO 25800",
        driver_display_name: "Raviri",
        client_name: "Sunflag",
      } as TripRow,
    });
    expect(matchesComplianceTripSearch(row, "trp151")).toBe(true);
    expect(matchesComplianceTripSearch(row, "TN16YO")).toBe(true);
    expect(matchesComplianceTripSearch(row, "raviri")).toBe(true);
    expect(matchesComplianceTripSearch(row, "missing")).toBe(false);
  });
});
