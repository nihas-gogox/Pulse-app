import type { CustomerLedgerInputs, CustomerLedgerTripInput } from "@/features/finance/services/ledgerAggregationRpc.service";

/**
 * Commerce merged fulfillment is self-distribution.
 * The seller manages the route. Product revenue stays on each sales-order
 * customer. Supplier/DCO cost stays on the trip (`supplier_rate`) and is not
 * a customer freight receivable.
 */
export type CommerceFulfillmentOrder = {
  /** sales_orders.id — the one identity that may contribute a product total. */
  orderId: string;
  customerId: string;
  tripId: string;
  amount: number;
};

function normId(value: string): string {
  return value.trim().toLowerCase();
}

export function commerceProductSalesInputs(
  orders: readonly CommerceFulfillmentOrder[],
): CustomerLedgerTripInput[] {
  const seenOrders = new Set<string>();
  const byKey = new Map<string, CustomerLedgerTripInput>();
  for (const order of orders) {
    const orderId = normId(order.orderId);
    const clientId = normId(order.customerId);
    const tripId = normId(order.tripId);
    if (!orderId || seenOrders.has(orderId)) continue;
    if (!clientId || !tripId || !(order.amount > 0)) continue;
    seenOrders.add(orderId);
    const key = `${clientId}:${tripId}`;
    const current = byKey.get(key);
    if (current) {
      current.sales += order.amount;
      continue;
    }
    byKey.set(key, {
      client_id: clientId,
      trip_id: tripId,
      sales: order.amount,
      initial_paid: 0,
    });
  }
  return [...byKey.values()];
}

/**
 * A commerce plan indent stores the goods total on `client_price` as an invoice
 * reference. Conversion copies that onto the shipper trip. It is not freight.
 * Drop it before product sales are applied, including while the trip is still
 * open, so the goods total is not a customer receivable until fulfillment.
 */
export function suppressCommercePlanFreight(
  inputs: CustomerLedgerInputs,
  commerceTripIds: readonly string[],
): CustomerLedgerInputs {
  const ids = new Set(commerceTripIds.map((id) => normId(id)).filter(Boolean));
  if (ids.size === 0) return inputs;
  return {
    ...inputs,
    trip_inputs: inputs.trip_inputs.map((row) =>
      ids.has(normId(row.trip_id)) && row.sales > 0
        ? { ...row, sales: 0 }
        : row,
    ),
  };
}

export function mergeCommerceProductSales(
  inputs: CustomerLedgerInputs,
  orders: readonly CommerceFulfillmentOrder[],
): CustomerLedgerInputs {
  const productSales = commerceProductSalesInputs(orders);
  if (productSales.length === 0) return inputs;

  const productByKey = new Map(
    productSales.map((row) => [`${normId(row.client_id)}:${normId(row.trip_id)}`, row]),
  );
  const seen = new Set<string>();
  const tripInputs = inputs.trip_inputs.map((row) => {
    const key = `${normId(row.client_id)}:${normId(row.trip_id)}`;
    seen.add(key);
    const product = productByKey.get(key);
    // A positive freight sale is a different amount. Never add the product total on top of it.
    if (!product || row.sales > 0) return row;
    return { ...row, sales: product.sales };
  });
  for (const row of productSales) {
    const key = `${normId(row.client_id)}:${normId(row.trip_id)}`;
    if (seen.has(key)) continue;
    tripInputs.push(row);
  }
  return { ...inputs, trip_inputs: tripInputs };
}
