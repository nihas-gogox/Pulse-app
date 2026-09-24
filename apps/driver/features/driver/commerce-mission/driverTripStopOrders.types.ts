/**
 * Driver read contract for Primitive A (`get_driver_trip_stop_orders`).
 * Column names match the RPC. No delivery shortcut fields.
 */

export const GET_DRIVER_TRIP_STOP_ORDERS_RPC = 'get_driver_trip_stop_orders' as const;

export type DriverTripStopAttachmentRole = 'pickup' | 'drop';

/** Raw row from public.get_driver_trip_stop_orders(p_trip_id). */
export type DriverTripStopOrderRpcRow = {
  trip_id: string | null;
  indent_id: string | null;
  execution_plan_id: string | null;
  stop_id: string | null;
  sequence: number | null;
  stop_type: string | null;
  source_type: string | null;
  display_name: string | null;
  label: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  pod_required: boolean | null;
  stop_execution_status: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  failure_reason: string | null;
  attachment_role: string | null;
  sales_order_id: string | null;
  order_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  sales_order_line_id: string | null;
  quantity: number | string | null;
  delivery_window_start: string | null;
  delivery_window_end: string | null;
  notes: string | null;
  priority: string | null;
  order_total_amount: number | string | null;
  currency: string | null;
  stop_distinct_drop_order_count: number | null;
  order_distinct_drop_stop_count: number | null;
  order_completed_drop_stop_count: number | null;
  /** Catalog fields — optional so older RPC payloads still normalize. */
  product_id?: string | null;
  product_name?: string | null;
  product_sku?: string | null;
  product_image_path?: string | null;
};

export type DriverTripStopOrderLine = {
  salesOrderLineId: string;
  quantity: number | null;
  productId?: string | null;
  productName?: string | null;
  productSku?: string | null;
  productImagePath?: string | null;
};

export type DriverTripStopOrder = {
  salesOrderId: string;
  orderNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  attachmentRole: DriverTripStopAttachmentRole | null;
  deliveryWindowStart: string | null;
  deliveryWindowEnd: string | null;
  notes: string | null;
  priority: string | null;
  /** sales_orders.total_amount — sales value, not transport cost. */
  orderTotalAmount: number | null;
  currency: string | null;
  orderDistinctDropStopCount: number;
  orderCompletedDropStopCount: number;
  lines: DriverTripStopOrderLine[];
};

export type DriverTripStopOrderStop = {
  stopId: string;
  sequence: number;
  stopType: string | null;
  sourceType: string | null;
  displayName: string | null;
  label: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  contactName: string | null;
  contactPhone: string | null;
  latitude: number | null;
  longitude: number | null;
  podRequired: boolean;
  stopExecutionStatus: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  stopDistinctDropOrderCount: number;
  orders: DriverTripStopOrder[];
};

export type DriverTripStopOrderMission = {
  tripId: string;
  indentId: string | null;
  executionPlanId: string | null;
  stops: DriverTripStopOrderStop[];
};

export type FetchDriverTripStopOrdersResult =
  | { ok: true; mission: DriverTripStopOrderMission }
  | { ok: false; mission: DriverTripStopOrderMission; error: Error };
