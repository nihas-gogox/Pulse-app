import type { CommerceRepository, V2SalesOrder } from "../../domains/commerce/repository";
import { requireWorkspaceId, type V2TenantContext } from "../tenantContext";

export function createCommerceMemoryRepository(): CommerceRepository {
  const salesOrders = new Map<string, V2SalesOrder>();

  return {
    insertSalesOrder(ctx: V2TenantContext, order: V2SalesOrder): V2SalesOrder {
      const workspaceId = requireWorkspaceId(ctx);
      if (order.workspaceId !== workspaceId) {
        throw new Error("Commerce insert workspaceId must match tenant context.");
      }
      salesOrders.set(order.id, order);
      return order;
    },
    getSalesOrder(ctx: V2TenantContext, id: string): V2SalesOrder | null {
      const workspaceId = requireWorkspaceId(ctx);
      const row = salesOrders.get(id) ?? null;
      if (!row || row.workspaceId !== workspaceId) return null;
      return row;
    },
  };
}
