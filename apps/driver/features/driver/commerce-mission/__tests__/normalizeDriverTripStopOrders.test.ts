import type { DriverTripStopOrderRpcRow } from '../driverTripStopOrders.types';
import {
  emptyDriverTripStopOrderMission,
  hasCommerceExecutionPlan,
  normalizeDriverTripStopOrders,
} from '../normalizeDriverTripStopOrders';

function row(
  extras: Partial<DriverTripStopOrderRpcRow> &
    Pick<DriverTripStopOrderRpcRow, 'trip_id' | 'stop_id' | 'sequence'>,
): DriverTripStopOrderRpcRow {
  return {
    indent_id: 'indent-1',
    execution_plan_id: 'plan-1',
    stop_type: extras.stop_id?.includes('pu') ? 'pickup' : 'drop',
    source_type: 'warehouse',
    display_name: extras.display_name ?? `Stop ${extras.stop_id}`,
    label: extras.label ?? extras.stop_id,
    address_line: '1 Main',
    city: 'Chennai',
    state: 'TN',
    pincode: '600001',
    contact_name: 'Ada',
    contact_phone: '90000',
    latitude: 13.08,
    longitude: 80.27,
    pod_required: extras.stop_id?.includes('pu') ? false : true,
    stop_execution_status: 'pending',
    arrived_at: null,
    completed_at: null,
    failure_reason: null,
    attachment_role: extras.stop_id?.includes('pu') ? 'pickup' : 'drop',
    sales_order_id: null,
    order_number: null,
    customer_id: null,
    customer_name: null,
    customer_phone: null,
    sales_order_line_id: null,
    quantity: null,
    delivery_window_start: null,
    delivery_window_end: null,
    notes: null,
    priority: 'standard',
    order_total_amount: null,
    currency: 'INR',
    stop_distinct_drop_order_count: 0,
    order_distinct_drop_stop_count: 0,
    order_completed_drop_stop_count: 0,
    ...extras,
  };
}

function orderFields(
  id: string,
  lineId: string,
  qty: number,
  role: 'pickup' | 'drop',
): Partial<DriverTripStopOrderRpcRow> {
  return {
    attachment_role: role,
    sales_order_id: id,
    order_number: id.replace('so-', 'SO-'),
    customer_id: `cust-${id}`,
    customer_name: `Customer ${id}`,
    customer_phone: '98888',
    sales_order_line_id: lineId,
    quantity: qty,
    order_total_amount: 1000,
    currency: 'INR',
    order_distinct_drop_stop_count: 1,
    order_completed_drop_stop_count: 0,
    stop_distinct_drop_order_count: role === 'drop' ? 1 : 0,
  };
}

describe('normalizeDriverTripStopOrders', () => {
  it('empty / null rows → empty mission', () => {
    expect(normalizeDriverTripStopOrders('t1', [])).toEqual(emptyDriverTripStopOrderMission('t1'));
    expect(normalizeDriverTripStopOrders('t1', null)).toEqual(emptyDriverTripStopOrderMission('t1'));
    expect(hasCommerceExecutionPlan(emptyDriverTripStopOrderMission('t1'))).toBe(false);
  });

  it('drops rows for a different trip_id', () => {
    const mission = normalizeDriverTripStopOrders('trip-a', [
      row({
        trip_id: 'trip-b',
        stop_id: 'drop-1',
        sequence: 1,
        ...orderFields('so-1', 'line-1', 2, 'drop'),
      }),
    ]);
    expect(mission.stops).toHaveLength(0);
    expect(mission.executionPlanId).toBeNull();
  });

  it('non-commerce header-only row → plan null, no stops', () => {
    const mission = normalizeDriverTripStopOrders('trip-core', [
      row({
        trip_id: 'trip-core',
        indent_id: 'indent-core',
        execution_plan_id: null,
        stop_id: null,
        sequence: null,
      }),
    ]);
    expect(mission.indentId).toBe('indent-core');
    expect(mission.executionPlanId).toBeNull();
    expect(mission.stops).toHaveLength(0);
    expect(hasCommerceExecutionPlan(mission)).toBe(false);
  });

  it('shared pickup + two drops groups stop → orders → lines', () => {
    const tripId = 'trip-c';
    const mission = normalizeDriverTripStopOrders(tripId, [
      row({
        trip_id: tripId,
        stop_id: 'drop-b',
        sequence: 2,
        ...orderFields('so-2', 'line-2', 1, 'drop'),
        stop_distinct_drop_order_count: 1,
      }),
      row({
        trip_id: tripId,
        stop_id: 'pu-1',
        sequence: 0,
        ...orderFields('so-1', 'line-1', 15, 'pickup'),
        stop_distinct_drop_order_count: 0,
      }),
      row({
        trip_id: tripId,
        stop_id: 'pu-1',
        sequence: 0,
        ...orderFields('so-2', 'line-2', 1, 'pickup'),
        stop_distinct_drop_order_count: 0,
      }),
      row({
        trip_id: tripId,
        stop_id: 'drop-a',
        sequence: 1,
        ...orderFields('so-1', 'line-1', 15, 'drop'),
        stop_distinct_drop_order_count: 1,
      }),
    ]);

    expect(hasCommerceExecutionPlan(mission)).toBe(true);
    expect(mission.stops.map((s) => s.stopId)).toEqual(['pu-1', 'drop-a', 'drop-b']);
    expect(mission.stops[0].orders.map((o) => o.salesOrderId)).toEqual(['so-1', 'so-2']);
    expect(mission.stops[0].stopDistinctDropOrderCount).toBe(0);
    expect(mission.stops[1].orders).toHaveLength(1);
    expect(mission.stops[1].orders[0].salesOrderId).toBe('so-1');
    expect(mission.stops[1].orders[0].attachmentRole).toBe('drop');
    expect(mission.stops[1].orders[0].lines).toEqual([{ salesOrderLineId: 'line-1', quantity: 15 }]);
  });

  it('multiple lines on one order stay one order', () => {
    const tripId = 'trip-lines';
    const mission = normalizeDriverTripStopOrders(tripId, [
      row({
        trip_id: tripId,
        stop_id: 'drop-1',
        sequence: 1,
        ...orderFields('so-1', 'line-b', 3, 'drop'),
      }),
      row({
        trip_id: tripId,
        stop_id: 'drop-1',
        sequence: 1,
        ...orderFields('so-1', 'line-a', 2, 'drop'),
      }),
    ]);
    expect(mission.stops).toHaveLength(1);
    expect(mission.stops[0].orders).toHaveLength(1);
    expect(mission.stops[0].orders[0].lines.map((l) => l.salesOrderLineId)).toEqual([
      'line-a',
      'line-b',
    ]);
    expect(mission.stops[0].orders[0]).not.toHaveProperty('isDelivered');
  });

  it('shared drop preserves grouping count without inventing delivery', () => {
    const tripId = 'trip-share';
    const mission = normalizeDriverTripStopOrders(tripId, [
      row({
        trip_id: tripId,
        stop_id: 'drop-shared',
        sequence: 1,
        ...orderFields('so-1', 'line-1', 1, 'drop'),
        stop_distinct_drop_order_count: 2,
      }),
      row({
        trip_id: tripId,
        stop_id: 'drop-shared',
        sequence: 1,
        ...orderFields('so-2', 'line-2', 1, 'drop'),
        stop_distinct_drop_order_count: 2,
      }),
    ]);
    expect(mission.stops[0].orders).toHaveLength(2);
    expect(mission.stops[0].stopDistinctDropOrderCount).toBe(2);
    expect(mission.stops[0].stopExecutionStatus).toBe('pending');
    expect(mission.stops[0].orders.every((o) => o.orderCompletedDropStopCount === 0)).toBe(true);
  });

  it('does not treat pickup SES completed as order delivery', () => {
    const tripId = 'trip-pu';
    const mission = normalizeDriverTripStopOrders(tripId, [
      row({
        trip_id: tripId,
        stop_id: 'pu-1',
        sequence: 0,
        stop_execution_status: 'completed',
        ...orderFields('so-1', 'line-1', 1, 'pickup'),
        order_completed_drop_stop_count: 0,
        stop_distinct_drop_order_count: 0,
      }),
    ]);
    expect(mission.stops[0].stopExecutionStatus).toBe('completed');
    expect(mission.stops[0].stopType).toBe('pickup');
    expect(mission.stops[0].orders[0].orderCompletedDropStopCount).toBe(0);
  });

  it('passes through catalog name and image path without inventing them', () => {
    const tripId = 'trip-cat';
    const mission = normalizeDriverTripStopOrders(tripId, [
      row({
        trip_id: tripId,
        stop_id: 'drop-1',
        sequence: 1,
        ...orderFields('so-1', 'line-1', 1, 'drop'),
        product_id: 'prod-1',
        product_name: 'Nvidia GPU kit',
        product_sku: 'NV-A',
        product_image_path: 'product-images/org/p.jpg',
      }),
    ]);
    expect(mission.stops[0].orders[0].lines).toEqual([
      {
        salesOrderLineId: 'line-1',
        quantity: 1,
        productId: 'prod-1',
        productName: 'Nvidia GPU kit',
        productSku: 'NV-A',
        productImagePath: 'product-images/org/p.jpg',
      },
    ]);
  });
});
