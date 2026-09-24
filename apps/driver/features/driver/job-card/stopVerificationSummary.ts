import type { DriverTripStopOrder } from '../commerce-mission/driverTripStopOrders.types';

/** Item-level delivered qty is not in Primitive A or SES. Do not invent it. */
export const ITEM_LEVEL_DELIVERY_PERSISTED = false;

export type StopVerificationTotals = {
  orderCount: number;
  lineCount: number;
  expectedQty: number | null;
};

export function stopVerificationTotals(
  orders: readonly DriverTripStopOrder[],
): StopVerificationTotals {
  let lineCount = 0;
  let expectedQty = 0;
  let anyQty = false;
  for (const order of orders) {
    for (const line of order.lines ?? []) {
      lineCount += 1;
      if (line.quantity != null && Number.isFinite(line.quantity)) {
        expectedQty += line.quantity;
        anyQty = true;
      }
    }
  }
  return {
    orderCount: orders.length,
    lineCount,
    expectedQty: anyQty ? expectedQty : null,
  };
}

export function expectedQtyLabel(totals: StopVerificationTotals): string {
  const orders = `${totals.orderCount} ${totals.orderCount === 1 ? 'order' : 'orders'}`;
  if (totals.expectedQty != null) {
    const items = `${totals.expectedQty} ${totals.expectedQty === 1 ? 'item' : 'items'}`;
    return `${orders} · ${items}`;
  }
  if (totals.lineCount > 0) {
    const lines = `${totals.lineCount} ${totals.lineCount === 1 ? 'line' : 'lines'}`;
    return `${orders} · ${lines}`;
  }
  return orders;
}

export function orderExpectedQty(order: DriverTripStopOrder): number | null {
  let sum = 0;
  let any = false;
  for (const line of order.lines ?? []) {
    if (line.quantity != null && Number.isFinite(line.quantity)) {
      sum += line.quantity;
      any = true;
    }
  }
  return any ? sum : null;
}

export function itemRowLabel(index: number, productName?: string | null): string {
  const name = productName?.trim();
  return name || `Item ${index + 1}`;
}

export function qtyLabel(quantity: number | null): string {
  if (quantity == null || !Number.isFinite(quantity)) return 'Quantity not on this trip';
  return `${quantity} ×`;
}
