import { requirePlatformDb } from '@pulse/core/lib/platform/db/platformDb';
import type { WorkspaceId } from '../../../../../lib/platform/types/master-data';

export type SalesOrderForPublish = {
  id: string;
  workspaceId: WorkspaceId;
  orderNumber: string;
  status: string;
  customerId: string;
  customerName: string;
  pickupWarehouseId: string;
  pickupArea: string;
  dropLocation: string;
  totalWeightKg: number;
  clientPrice: number;
  executionPlanId: string | null;
};

const ORDER_FOR_PUBLISH_SELECT = `
  id, order_number, organization_id, status, customer_id, pickup_warehouse_id,
  execution_plan_id, total_amount, total_weight_kg,
  customer:clients!customer_id(id,name,legal_name,trade_name),
  pickup_warehouse:client_warehouses!pickup_warehouse_id(id,name,city,state,address),
  drop_warehouse:client_warehouses!drop_warehouse_id(id,name,city,state,address)
`.trim();

function mapOrderRow(row: Record<string, unknown>): SalesOrderForPublish {
  const customer = row.customer as Record<string, unknown> | null;
  const pickup = row.pickup_warehouse as Record<string, unknown> | null;
  const drop = row.drop_warehouse as Record<string, unknown> | null;
  const pickupArea = [pickup?.name, pickup?.city, pickup?.state].filter(Boolean).join(', ') || 'Pickup';
  const dropLocation = [drop?.name ?? pickup?.name, drop?.city ?? pickup?.city, drop?.state ?? pickup?.state]
    .filter(Boolean)
    .join(', ') || pickupArea;

  return {
    id: String(row.id),
    workspaceId: String(row.organization_id),
    orderNumber: String(row.order_number ?? ''),
    status: String(row.status ?? ''),
    customerId: String(row.customer_id ?? customer?.id ?? ''),
    customerName: String(customer?.legal_name ?? customer?.trade_name ?? customer?.name ?? 'Customer'),
    pickupWarehouseId: String(row.pickup_warehouse_id ?? pickup?.id ?? ''),
    pickupArea,
    dropLocation,
    totalWeightKg: Number(row.total_weight_kg ?? 0) || 1,
    clientPrice: Number(row.total_amount ?? 0),
    executionPlanId: row.execution_plan_id ? String(row.execution_plan_id) : null,
  };
}

export const orderRepository = {
  async getForPublish(workspaceId: WorkspaceId, orderId: string): Promise<SalesOrderForPublish | null> {
    const { data, error } = await requirePlatformDb()
      .from('sales_orders')
      .select(ORDER_FOR_PUBLISH_SELECT)
      .eq('organization_id', workspaceId)
      .eq('id', orderId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapOrderRow(data as unknown as Record<string, unknown>) : null;
  },

  async updateStatus(workspaceId: WorkspaceId, orderId: string, status: string): Promise<void> {
    const { error } = await requirePlatformDb()
      .from('sales_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('organization_id', workspaceId)
      .eq('id', orderId);
    if (error) throw new Error(error.message);
  },

  async listPlanLinks(
    workspaceId: WorkspaceId,
    orderIds: string[],
  ): Promise<{ id: string; orderNumber: string; status: string; executionPlanId: string | null }[]> {
    if (!orderIds.length) return [];
    const { data, error } = await requirePlatformDb()
      .from('sales_orders')
      .select('id, order_number, status, execution_plan_id')
      .eq('organization_id', workspaceId)
      .in('id', orderIds)
      .is('deleted_at', null);
    if (error) throw new Error(error.message);
    return ((data ?? []) as {
      id: string;
      order_number: string | null;
      status: string | null;
      execution_plan_id: string | null;
    }[]).map((row) => ({
      id: String(row.id),
      orderNumber: String(row.order_number ?? ''),
      status: String(row.status ?? ''),
      executionPlanId: row.execution_plan_id ? String(row.execution_plan_id) : null,
    }));
  },

  async markPlannedForExecutionPlan(
    workspaceId: WorkspaceId,
    orderIds: string[],
    executionPlanId: string,
  ): Promise<void> {
    if (!orderIds.length) return;
    const { error } = await requirePlatformDb()
      .from('sales_orders')
      .update({ status: 'Planned', execution_plan_id: executionPlanId, updated_at: new Date().toISOString() })
      .eq('organization_id', workspaceId)
      .in('id', orderIds)
      .or(`execution_plan_id.is.null,execution_plan_id.eq.${executionPlanId}`);
    if (error) throw new Error(error.message);
  },
};
