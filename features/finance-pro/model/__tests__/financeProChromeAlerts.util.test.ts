import { buildFinanceProChromeAlerts } from "../financeProChromeAlerts.util";
import type { TripFinancialFact } from "../financeProTypes";

function trip(partial: Partial<TripFinancialFact> & { tripId: string }): TripFinancialFact {
  return {
    clientId: "c1",
    clientName: "AERO",
    tripLabel: "T-1",
    status: "completed",
    sales: 1000,
    remainingDue: 1000,
    pickupDate: "2026-01-01",
    daysOld: 10,
    ageBucket: "d1_15",
    podReceived: false,
    physicalPodReceived: false,
    invoiced: false,
    completed: true,
    ...partial,
  };
}

describe("buildFinanceProChromeAlerts", () => {
  it("alerts POD pending and invoiced open exposure 31d+", () => {
    const alerts = buildFinanceProChromeAlerts([
      trip({ tripId: "pod-1", completed: true, podReceived: false, invoiced: false }),
      trip({
        tripId: "over-1",
        completed: true,
        podReceived: true,
        invoiced: true,
        remainingDue: 500,
        daysOld: 40,
        ageBucket: "d31_60",
        tripLabel: "T-9",
      }),
      trip({
        tripId: "fresh-inv",
        completed: true,
        podReceived: true,
        invoiced: true,
        remainingDue: 200,
        daysOld: 5,
        ageBucket: "current",
      }),
      trip({
        tripId: "not-done",
        completed: false,
        podReceived: false,
        invoiced: false,
      }),
    ]);
    expect(alerts.map((a) => a.kind)).toEqual(["pod_pending", "invoice_overdue"]);
    expect(alerts[0]?.tripId).toBe("pod-1");
    expect(alerts[1]?.tripId).toBe("over-1");
  });
});
