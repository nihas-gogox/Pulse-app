/**
 * Orchestration command envelope — every entry point uses this shape.
 * Commands express intent; events (lib/platform/events) describe facts that occurred.
 */
export type OrchestrationCommandEnvelope<TPayload> = {
  correlationId: string;
  workspaceId: string;
  requestedBy: string;
  requestedAt: string;
  payload: TPayload;
};

export type PublishIndentCommandPayload = {
  orderId: string;
};

export type PublishIndentCommand = OrchestrationCommandEnvelope<PublishIndentCommandPayload>;

export type PublishIndentResult = {
  indentId: string;
  orderId: string;
  correlationId: string;
};

export type OrchestrationErrorCode =
  | 'INVALID_COMMAND'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_NOT_DISPATCHABLE'
  | 'MISSING_CUSTOMER'
  | 'MISSING_WAREHOUSE';

export type OrchestrationError = {
  code: OrchestrationErrorCode;
  message: string;
  correlationId: string;
};

/**
 * Publish a merged multi-order Commerce execution plan (stops + order-line
 * allocations already computed client-side by the merge engine) and create
 * its linked Core indent. A new command per the "new execution steps are new
 * commands" rule — publishIndent() (single-order) is untouched.
 */
export type PublishExecutionPlanStopInput = {
  clientStopId: string;
  label: string;
  type: 'pickup' | 'drop';
  warehouseId?: string;
  address: { line1: string; city: string; state: string; pincode: string; lat?: number; lng?: number };
  contactName: string;
  contactPhone: string;
  podRequired: boolean;
};

export type PublishExecutionPlanAllocationInput = {
  orderId: string;
  pickupClientStopId: string;
  dropClientStopId: string;
};

export type PublishExecutionPlanOrderInput = {
  orderId: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  lineItems: { id: string; quantity: number; weightKg: number; volumeM3: number }[];
};

export type PublishExecutionPlanCommandPayload = {
  /** Client-generated plan id (e.g. "PLN001") — the idempotency key for this publish. */
  clientPlanId: string;
  vehicleType?: string;
  stops: PublishExecutionPlanStopInput[];
  /** Ordered client stop ids — determines execution_plan_stops.sequence. */
  route: { sequence: string[] };
  allocations: PublishExecutionPlanAllocationInput[];
  orders: PublishExecutionPlanOrderInput[];
  totalWeightKg: number;
  /**
   * Asking freight for market bidding. Required. Never copy sales invoice
   * totals here — client_price stays the commercial invoice reference.
   */
  supplierTarget: number;
};

export type PublishExecutionPlanCommand = OrchestrationCommandEnvelope<PublishExecutionPlanCommandPayload>;

export type PublishExecutionPlanResult = {
  executionPlanId: string;
  planNumber: string;
  indentId: string;
  indentCode: string;
  correlationId: string;
  /** true when this call returned an already-published plan instead of creating a new one. */
  alreadyPublished: boolean;
};
