import { tripIsDeliveredStatus } from "@/features/trips/services/tripDocumentLrPod.service";
import type { PodReconciliationTripView } from "../../services/podReconciliationService";
import {
  derivePodDisplayStatus,
  derivePodNextAction,
  derivePodTimeline,
  podDisplayStatusLabel,
} from "../podWorkflowDisplay.util";

jest.mock("@/features/trips/services/tripDocumentLrPod.service", () => ({
  tripIsDeliveredStatus: jest.fn(),
}));

const mockedDelivered = tripIsDeliveredStatus as jest.MockedFunction<
  typeof tripIsDeliveredStatus
>;

function baseTrip(
  overrides: Partial<PodReconciliationTripView> = {},
): PodReconciliationTripView {
  return {
    id: "T1",
    internal_id: "uuid-1",
    client_name: "Client",
    vendor_name: "Vendor",
    driver_name: "Driver",
    lane: "market",
    trip_date: "2026-09-16",
    pp_location: "A",
    drop_point: "B",
    trip_status: "completed",
    pod_status: "Pending",
    pod_received_date: null,
    invoice_status_1: "Pending",
    invoice_no: null,
    invoice_status_display: "Invoice Pending",
    lr_numbers: [],
    trip_pods: [],
    amount: 1000,
    date: "2026-09-16",
    soft_pod_received: false,
    hard_pod_received: false,
    ...overrides,
  };
}

describe("podWorkflowDisplay.util", () => {
  beforeEach(() => {
    mockedDelivered.mockReturnValue(true);
  });

  it("maps missing POD on completed trip to Hard POD Pending + Upload POD", () => {
    const trip = baseTrip();
    expect(derivePodDisplayStatus(trip)).toBe("hard_pod_pending");
    expect(podDisplayStatusLabel(derivePodDisplayStatus(trip))).toBe(
      "Hard POD Pending",
    );
    expect(derivePodNextAction(trip)).toMatchObject({
      kind: "upload_pod",
      handler: "log_incoming",
    });
  });

  it("maps soft-only to Soft POD Uploaded + Upload Hard POD", () => {
    const trip = baseTrip({ soft_pod_received: true });
    expect(derivePodDisplayStatus(trip)).toBe("soft_pod_uploaded");
    expect(derivePodNextAction(trip)).toMatchObject({
      kind: "upload_hard_pod",
      label: "Upload Hard POD",
      handler: "log_incoming",
    });
  });

  it("maps hard POD in Needs Action queue to Under Verification + Review", () => {
    const trip = baseTrip({
      soft_pod_received: true,
      hard_pod_received: true,
      invoice_status_display: "Received",
      pod_status: "Received",
    });
    expect(derivePodDisplayStatus(trip)).toBe("under_verification");
    expect(derivePodNextAction(trip)).toMatchObject({
      kind: "review_pod",
      handler: "review",
    });
  });

  it("maps Ready for Invoice / Invoiced from existing invoice_status_display", () => {
    expect(
      derivePodDisplayStatus(
        baseTrip({
          hard_pod_received: true,
          invoice_status_display: "Ready for Invoice",
        }),
      ),
    ).toBe("ready_for_invoice");
    expect(
      derivePodNextAction(
        baseTrip({
          hard_pod_received: true,
          invoice_status_display: "Ready for Invoice",
        }),
      ).kind,
    ).toBe("create_invoice");

    expect(
      derivePodDisplayStatus(
        baseTrip({
          invoice_no: "INV-1",
          invoice_status_display: "Invoiced",
          hard_pod_received: true,
        }),
      ),
    ).toBe("invoiced");
    expect(
      derivePodNextAction(
        baseTrip({
          invoice_no: "INV-1",
          invoice_status_display: "Invoiced",
        }),
      ).kind,
    ).toBe("view_invoice");
  });

  it("builds a timeline with one current step from existing flags", () => {
    mockedDelivered.mockReturnValue(true);
    const steps = derivePodTimeline(
      baseTrip({ soft_pod_received: true, hard_pod_received: false }),
    );
    expect(steps.map((s) => s.state)).toEqual([
      "done",
      "done",
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
  });
});
