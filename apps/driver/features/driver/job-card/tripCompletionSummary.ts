import type { DriverTripStopOrderMission } from '../commerce-mission/driverTripStopOrders.types';
import type { DriverStopExecutionStop } from '../execution/driverStopExecution.types';
import { ordersOnStop } from './attachOrdersToStop';
import {
  formatStopPlace,
  isDeliveryStop,
  stopRoleLabel,
} from './multiOrderStopCopy';
import { orderExpectedQty } from './stopVerificationSummary';

export type TripCompletionStopRow = {
  stopId: string;
  sequence: number;
  role: 'Pickup' | 'Delivery';
  place: string;
  status: string;
  orderLabels: string[];
  expectedQty: number | null;
  customerName: string | null;
};

export type TripCompletionSummary = {
  pickupStops: number;
  deliveryStops: number;
  completedStops: number;
  totalStops: number;
  distinctOrders: number;
  expectedItems: number | null;
  stops: TripCompletionStopRow[];
};

export function allStopsFinished(stops: readonly DriverStopExecutionStop[]): boolean {
  return (
    stops.length > 0 &&
    stops.every((s) => s.status === 'completed' || s.status === 'skipped')
  );
}

export function buildTripCompletionSummary(
  stops: readonly DriverStopExecutionStop[],
  mission: DriverTripStopOrderMission | null,
): TripCompletionSummary {
  const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);
  const rows: TripCompletionStopRow[] = [];
  const orderIds = new Set<string>();
  const countedDropOrders = new Set<string>();
  let expectedItems = 0;
  let anyQty = false;
  let pickupStops = 0;
  let deliveryStops = 0;
  let completedStops = 0;

  for (const stop of sorted) {
    const delivery = isDeliveryStop(String(stop.stopType));
    if (delivery) deliveryStops += 1;
    else pickupStops += 1;
    if (stop.status === 'completed' || stop.status === 'skipped') completedStops += 1;

    const orders = ordersOnStop(mission, stop.stopId);
    const orderLabels: string[] = [];
    let stopQty = 0;
    let stopAnyQty = false;
    let customerName: string | null = null;
    for (const order of orders) {
      if (order.salesOrderId) orderIds.add(order.salesOrderId);
      const label = order.orderNumber?.trim() || order.salesOrderId;
      if (label) orderLabels.push(label);
      if (!customerName) customerName = order.customerName?.trim() || null;
      const qty = orderExpectedQty(order);
      if (qty != null) {
        stopQty += qty;
        stopAnyQty = true;
      }
      if (delivery && order.salesOrderId && !countedDropOrders.has(order.salesOrderId)) {
        countedDropOrders.add(order.salesOrderId);
        if (qty != null) {
          expectedItems += qty;
          anyQty = true;
        }
      }
    }

    rows.push({
      stopId: stop.stopId,
      sequence: stop.sequence,
      role: stopRoleLabel(String(stop.stopType)),
      place: formatStopPlace(stop),
      status: stop.status,
      orderLabels,
      expectedQty: stopAnyQty ? stopQty : null,
      customerName: customerName ?? stop.contactName?.trim() ?? null,
    });
  }

  return {
    pickupStops,
    deliveryStops,
    completedStops,
    totalStops: sorted.length,
    distinctOrders: orderIds.size,
    expectedItems: anyQty ? expectedItems : null,
    stops: rows,
  };
}

export function tripCompletionHeadline(summary: TripCompletionSummary): string {
  const deliveries = `${summary.deliveryStops} ${summary.deliveryStops === 1 ? 'delivery' : 'deliveries'}`;
  const pickups = `${summary.pickupStops} ${summary.pickupStops === 1 ? 'pickup' : 'pickups'}`;
  const orders = `${summary.distinctOrders} ${summary.distinctOrders === 1 ? 'order' : 'orders'}`;
  if (summary.expectedItems != null) {
    const items = `${summary.expectedItems} ${summary.expectedItems === 1 ? 'item' : 'items'} on trip`;
    return `${deliveries} · ${pickups} · ${orders} · ${items}`;
  }
  return `${deliveries} · ${pickups} · ${orders}`;
}

export function stopStatusLabel(status: string): string {
  if (status === 'completed') return 'Done';
  if (status === 'skipped') return 'Skipped';
  return status;
}
