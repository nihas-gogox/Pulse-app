import type {
  DriverTripStopAttachmentRole,
  DriverTripStopOrder,
  DriverTripStopOrderLine,
  DriverTripStopOrderMission,
  DriverTripStopOrderRpcRow,
  DriverTripStopOrderStop,
} from './driverTripStopOrders.types';

export function emptyDriverTripStopOrderMission(tripId: string): DriverTripStopOrderMission {
  return {
    tripId,
    indentId: null,
    executionPlanId: null,
    stops: [],
  };
}

/** Commerce mission iff Primitive A returned an execution_plan_id. Not a DB flag. */
export function hasCommerceExecutionPlan(mission: DriverTripStopOrderMission): boolean {
  return Boolean(mission.executionPlanId);
}

function asNullableNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asSequence(value: number | string | null | undefined): number {
  const n = asNullableNumber(value);
  return n != null ? n : Number.MAX_SAFE_INTEGER;
}

function asCount(value: number | string | null | undefined): number {
  const n = asNullableNumber(value);
  return n != null && n >= 0 ? n : 0;
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  return t === '' ? null : t;
}

function attachmentRole(value: string | null | undefined): DriverTripStopAttachmentRole | null {
  const role = (value ?? '').trim().toLowerCase();
  if (role === 'pickup' || role === 'drop') return role;
  return null;
}

function firstText(
  current: string | null,
  next: string | null | undefined,
): string | null {
  return current ?? trimOrNull(next);
}

function upsertLine(
  lines: DriverTripStopOrderLine[],
  salesOrderLineId: string,
  quantity: number | null,
  catalog: Pick<
    DriverTripStopOrderLine,
    'productId' | 'productName' | 'productSku' | 'productImagePath'
  >,
): void {
  const existing = lines.find((line) => line.salesOrderLineId === salesOrderLineId);
  if (existing) {
    if (existing.quantity == null && quantity != null) existing.quantity = quantity;
    if (!existing.productId && catalog.productId) existing.productId = catalog.productId;
    if (!existing.productName && catalog.productName) existing.productName = catalog.productName;
    if (!existing.productSku && catalog.productSku) existing.productSku = catalog.productSku;
    if (!existing.productImagePath && catalog.productImagePath) {
      existing.productImagePath = catalog.productImagePath;
    }
    return;
  }
  const line: DriverTripStopOrderLine = { salesOrderLineId, quantity };
  if (catalog.productId) line.productId = catalog.productId;
  if (catalog.productName) line.productName = catalog.productName;
  if (catalog.productSku) line.productSku = catalog.productSku;
  if (catalog.productImagePath) line.productImagePath = catalog.productImagePath;
  lines.push(line);
}

function upsertOrder(
  orders: Map<string, DriverTripStopOrder>,
  row: DriverTripStopOrderRpcRow,
): void {
  const salesOrderId = trimOrNull(row.sales_order_id);
  if (!salesOrderId) return;

  let order = orders.get(salesOrderId);
  if (!order) {
    order = {
      salesOrderId,
      orderNumber: trimOrNull(row.order_number),
      customerId: trimOrNull(row.customer_id),
      customerName: trimOrNull(row.customer_name),
      customerPhone: trimOrNull(row.customer_phone),
      attachmentRole: attachmentRole(row.attachment_role),
      deliveryWindowStart: row.delivery_window_start ?? null,
      deliveryWindowEnd: row.delivery_window_end ?? null,
      notes: trimOrNull(row.notes),
      priority: trimOrNull(row.priority),
      orderTotalAmount: asNullableNumber(row.order_total_amount),
      currency: trimOrNull(row.currency),
      orderDistinctDropStopCount: asCount(row.order_distinct_drop_stop_count),
      orderCompletedDropStopCount: asCount(row.order_completed_drop_stop_count),
      lines: [],
    };
    orders.set(salesOrderId, order);
  }

  const lineId = trimOrNull(row.sales_order_line_id);
  if (lineId) {
    upsertLine(order.lines, lineId, asNullableNumber(row.quantity), {
      productId: trimOrNull(row.product_id),
      productName: trimOrNull(row.product_name),
      productSku: trimOrNull(row.product_sku),
      productImagePath: trimOrNull(row.product_image_path),
    });
  }
}

/**
 * Groups Primitive A flat rows into trip → stops → orders → lines.
 * Drops rows for a different trip_id. Does not invent delivery state.
 */
export function normalizeDriverTripStopOrders(
  tripId: string,
  rows: readonly DriverTripStopOrderRpcRow[] | null | undefined,
): DriverTripStopOrderMission {
  const mission = emptyDriverTripStopOrderMission(tripId);
  if (!rows?.length) return mission;

  const stops = new Map<string, { stop: DriverTripStopOrderStop; orders: Map<string, DriverTripStopOrder> }>();

  for (const row of rows) {
    if (row.trip_id && row.trip_id !== tripId) continue;

    if (mission.indentId == null) mission.indentId = trimOrNull(row.indent_id);
    if (mission.executionPlanId == null) {
      mission.executionPlanId = trimOrNull(row.execution_plan_id);
    }

    const stopId = trimOrNull(row.stop_id);
    if (!stopId) continue;

    let bucket = stops.get(stopId);
    if (!bucket) {
      bucket = {
        orders: new Map(),
        stop: {
          stopId,
          sequence: asSequence(row.sequence),
          stopType: trimOrNull(row.stop_type),
          sourceType: trimOrNull(row.source_type),
          displayName: trimOrNull(row.display_name),
          label: trimOrNull(row.label),
          addressLine: trimOrNull(row.address_line),
          city: trimOrNull(row.city),
          state: trimOrNull(row.state),
          pincode: trimOrNull(row.pincode),
          contactName: trimOrNull(row.contact_name),
          contactPhone: trimOrNull(row.contact_phone),
          latitude: asNullableNumber(row.latitude),
          longitude: asNullableNumber(row.longitude),
          podRequired: row.pod_required === true,
          stopExecutionStatus: trimOrNull(row.stop_execution_status),
          arrivedAt: row.arrived_at ?? null,
          completedAt: row.completed_at ?? null,
          failureReason: trimOrNull(row.failure_reason),
          stopDistinctDropOrderCount: asCount(row.stop_distinct_drop_order_count),
          orders: [],
        },
      };
      stops.set(stopId, bucket);
    } else {
      const stop = bucket.stop;
      stop.displayName = firstText(stop.displayName, row.display_name);
      stop.label = firstText(stop.label, row.label);
      stop.addressLine = firstText(stop.addressLine, row.address_line);
    }

    upsertOrder(bucket.orders, row);
  }

  mission.stops = Array.from(stops.values())
    .map(({ stop, orders }) => {
      stop.orders = Array.from(orders.values()).sort((a, b) => {
        const an = a.orderNumber ?? a.salesOrderId;
        const bn = b.orderNumber ?? b.salesOrderId;
        return an.localeCompare(bn);
      });
      for (const order of stop.orders) {
        order.lines.sort((a, b) => a.salesOrderLineId.localeCompare(b.salesOrderLineId));
      }
      return stop;
    })
    .sort((a, b) => {
      if (a.sequence !== b.sequence) return a.sequence - b.sequence;
      return a.stopId.localeCompare(b.stopId);
    });

  return mission;
}
