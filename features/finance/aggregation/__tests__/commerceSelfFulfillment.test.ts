import {
  mergeCommerceProductSales,
  suppressCommercePlanFreight,
} from "@/features/finance/aggregation/commerceSelfFulfillment";
import type { CustomerLedgerInputs } from "@/features/finance/services/ledgerAggregationRpc.service";

const empty: CustomerLedgerInputs = {
  trip_inputs: [],
  unlinked_payments: [],
  ledger_only_parties: [],
  client_ledger_totals: [],
};

describe("mergeCommerceProductSales", () => {
  it("puts a fulfilled commerce product sale on the customer when the trip has no freight client", () => {
    const merged = mergeCommerceProductSales(empty, [
      { orderId: "so-1", customerId: "hussain", tripId: "trip-merged", amount: 265500 },
      { orderId: "so-1", customerId: "hussain", tripId: "trip-merged", amount: 265500 },
      { orderId: "so-2", customerId: "nvidia", tripId: "trip-merged", amount: 1711000 },
      { orderId: "so-3", customerId: "nvidia", tripId: "trip-merged", amount: 17700 },
    ]);
    expect(merged.trip_inputs).toEqual([
      { client_id: "hussain", trip_id: "trip-merged", sales: 265500, initial_paid: 0 },
      { client_id: "nvidia", trip_id: "trip-merged", sales: 1728700, initial_paid: 0 },
    ]);
  });

  it("replaces a zero freight sale and leaves a real freight sale untouched", () => {
    const merged = mergeCommerceProductSales(
      {
        ...empty,
        trip_inputs: [
          { client_id: "nvidia", trip_id: "trip-self", sales: 0, initial_paid: 0 },
          { client_id: "aero", trip_id: "trip-freight", sales: 52000, initial_paid: 0 },
        ],
      },
      [
        { orderId: "so-nvidia", customerId: "nvidia", tripId: "trip-self", amount: 1711000 },
        { orderId: "so-aero", customerId: "aero", tripId: "trip-freight", amount: 999999 },
      ],
    );
    expect(merged.trip_inputs).toEqual([
      { client_id: "nvidia", trip_id: "trip-self", sales: 1711000, initial_paid: 0 },
      { client_id: "aero", trip_id: "trip-freight", sales: 52000, initial_paid: 0 },
    ]);
  });

  it("drops copied goods freight on a commerce trip, then recognizes the product total once", () => {
    const suppressed = suppressCommercePlanFreight(
      {
        ...empty,
        trip_inputs: [
          { client_id: "merged-orders", trip_id: "trip-plan", sales: 265500, initial_paid: 0 },
          { client_id: "aero", trip_id: "trip-freight", sales: 52000, initial_paid: 0 },
        ],
      },
      ["trip-plan"],
    );
    const merged = mergeCommerceProductSales(suppressed, [
      { orderId: "so-1", customerId: "hussain", tripId: "trip-plan", amount: 265500 },
    ]);
    expect(merged.trip_inputs).toEqual([
      { client_id: "merged-orders", trip_id: "trip-plan", sales: 0, initial_paid: 0 },
      { client_id: "aero", trip_id: "trip-freight", sales: 52000, initial_paid: 0 },
      { client_id: "hussain", trip_id: "trip-plan", sales: 265500, initial_paid: 0 },
    ]);
  });
});
