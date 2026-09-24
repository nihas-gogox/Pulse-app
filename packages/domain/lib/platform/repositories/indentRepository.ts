import { requirePlatformDb } from '@pulse/core/lib/platform/db/platformDb';
import { ensurePublicUserRecord } from './userRepository';
import type { SalesOrderForPublish } from './orderRepository';
import type { WorkspaceId } from '../types/master-data';

export type CreatedIndentRef = {
  id: string;
  salesOrderId: string | null;
};

export type CreatedPlanIndentRef = {
  id: string;
  indentCode: string;
};

/** Convert-to-indent insert: Give Load draft, not broadcast/share. */
export function buildIndentInsertFromExecutionPlan(input: {
  workspaceId: WorkspaceId;
  executionPlanId: string;
  vehicleType?: string;
  orderCount: number;
  totalWeightKg: number;
  totalAmount: number;
  supplierTarget: number;
  pickupSummary: string;
  dropSummary: string;
  requestedBy: string;
  clientName?: string | null;
  nowIso?: string;
}): Record<string, unknown> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const target = Number.isFinite(input.supplierTarget) ? input.supplierTarget : 0;
  return {
    organization_id: input.workspaceId,
    execution_plan_id: input.executionPlanId,
    sales_order_id: null,
    pickup_area: input.pickupSummary,
    drop_location: input.dropSummary,
    client_name:
      (input.clientName ?? '').trim() ||
      `${input.orderCount} merged orders`,
    client_price: input.totalAmount,
    supplier_target: target,
    sale_rate_basis: 'per_trip',
    vehicle_type: input.vehicleType ?? 'Truck',
    load_type: 'General',
    weight: Math.max(input.totalWeightKg, 1),
    status: 'draft',
    shared_at: null,
    last_saved_at: nowIso,
    owner_user_id: input.requestedBy,
    created_by_user_id: input.requestedBy,
    indent_number: null,
  };
}

export const indentRepository = {
  async findByExecutionPlanId(
    workspaceId: WorkspaceId,
    executionPlanId: string,
  ): Promise<CreatedPlanIndentRef | null> {
    const { data, error } = await requirePlatformDb()
      .from('indents')
      .select('id,indent_number')
      .eq('organization_id', workspaceId)
      .eq('execution_plan_id', executionPlanId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return { id: String(data.id), indentCode: String(data.indent_number ?? data.id) };
  },

  async createFromExecutionPlan(input: {
    workspaceId: WorkspaceId;
    executionPlanId: string;
    planNumber: string;
    vehicleType?: string;
    orderCount: number;
    totalWeightKg: number;
    totalAmount: number;
    supplierTarget: number;
    pickupSummary: string;
    dropSummary: string;
    requestedBy: string;
    clientName?: string | null;
  }): Promise<CreatedPlanIndentRef> {
    await ensurePublicUserRecord(input.requestedBy);
    const { data, error } = await requirePlatformDb()
      .from('indents')
      .insert(buildIndentInsertFromExecutionPlan(input))
      .select('id,indent_number')
      .single();
    if (error) {
      if (error.code === '23505') {
        const existing = await indentRepository.findByExecutionPlanId(input.workspaceId, input.executionPlanId);
        if (existing) return existing;
      }
      throw new Error(error.message);
    }
    return { id: String(data.id), indentCode: String(data.indent_number ?? data.id) };
  },

  async findBySalesOrderId(
    workspaceId: WorkspaceId,
    salesOrderId: string,
  ): Promise<CreatedIndentRef | null> {
    const { data, error } = await requirePlatformDb()
      .from('indents')
      .select('id,sales_order_id')
      .eq('organization_id', workspaceId)
      .eq('sales_order_id', salesOrderId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return { id: String(data.id), salesOrderId: data.sales_order_id as string | null };
  },

  async createFromSalesOrder(input: {
    workspaceId: WorkspaceId;
    order: SalesOrderForPublish;
    requestedBy: string;
  }): Promise<CreatedIndentRef> {
    await ensurePublicUserRecord(input.requestedBy);
    const weightKg = Math.max(input.order.totalWeightKg, 1);
    const { data, error } = await requirePlatformDb()
      .from('indents')
      .insert({
        organization_id: input.workspaceId,
        sales_order_id: input.order.id,
        pickup_area: input.order.pickupArea,
        drop_location: input.order.dropLocation,
        client_name: input.order.customerName,
        client_price: input.order.clientPrice,
        supplier_target: 0,
        vehicle_type: 'Truck',
        load_type: 'General',
        weight: weightKg,
        status: 'broadcast',
        shared_at: new Date().toISOString(),
        owner_user_id: input.requestedBy,
        created_by_user_id: input.requestedBy,
        indent_number: null,
      })
      .select('id,sales_order_id')
      .single();
    if (error) {
      if (error.code === '23505') {
        const existing = await indentRepository.findBySalesOrderId(input.workspaceId, input.order.id);
        if (existing) return existing;
      }
      throw new Error(error.message);
    }
    return { id: String(data.id), salesOrderId: data.sales_order_id as string | null };
  },

  /**
   * Read-only quote observability for Commerce. Does not change indent status.
   * One quote is not a Core lifecycle transition.
   */
  async listQuoteSummaries(
    indentIds: string[],
  ): Promise<{ indentId: string; bidCount: number; bestBidAmount: number | null }[]> {
    if (!indentIds.length) return [];
    const { data, error } = await requirePlatformDb()
      .from('direct_quotes')
      .select('indent_id, amount')
      .in('indent_id', indentIds);
    if (error) throw new Error(error.message);

    const byIndent = new Map<string, { bidCount: number; bestBidAmount: number | null }>();
    for (const id of indentIds) {
      byIndent.set(id, { bidCount: 0, bestBidAmount: null });
    }
    for (const row of (data ?? []) as { indent_id: string; amount: number | null }[]) {
      const cur = byIndent.get(row.indent_id);
      if (!cur) continue;
      const amount = Number(row.amount);
      cur.bidCount += 1;
      if (Number.isFinite(amount) && amount > 0) {
        cur.bestBidAmount = cur.bestBidAmount == null ? amount : Math.min(cur.bestBidAmount, amount);
      }
    }
    return [...byIndent.entries()].map(([indentId, summary]) => ({ indentId, ...summary }));
  },
};
