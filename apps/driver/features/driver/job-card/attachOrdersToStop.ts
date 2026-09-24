import type {
  DriverTripStopOrder,
  DriverTripStopOrderMission,
} from '../commerce-mission/driverTripStopOrders.types';

/** Orders attached to one Core stop. Empty when Primitive A has not loaded. */
export function ordersOnStop(
  mission: DriverTripStopOrderMission | null | undefined,
  stopId: string | null | undefined,
): DriverTripStopOrder[] {
  if (!mission || !stopId) return [];
  return mission.stops.find((s) => s.stopId === stopId)?.orders ?? [];
}

export function distinctOrderCount(mission: DriverTripStopOrderMission | null | undefined): number {
  if (!mission) return 0;
  const ids = new Set<string>();
  for (const stop of mission.stops) {
    for (const order of stop.orders) {
      if (order.salesOrderId) ids.add(order.salesOrderId);
    }
  }
  return ids.size;
}

export function completedStopCount(
  stops: readonly { status: string }[],
): number {
  return stops.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
}
