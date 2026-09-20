import type { CommerceRepository, V2SalesOrder } from "../../domains/commerce/repository";
import { requireWorkspaceId, type V2TenantContext } from "../tenantContext";
import type { V2DatabaseClient } from "./createV2Client";

type FilterBuilder = {
  eq: (column: string, value: string) => FilterBuilder;
  maybeSingle: () => Promise<{ data: V2SalesOrder | null; error: { message: string } | null }>;
};

type TableBuilder = {
  insert: (row: V2SalesOrder) => { select: () => FilterBuilder };
  select: (columns: string) => FilterBuilder;
};

/**
 * Commerce adapter. May .from only sales_orders (and other COMMERCE_TABLES).
 * Client is injected — this module never calls createClient.
 */
export function createCommerceSupabaseRepository(client: V2DatabaseClient): CommerceRepository {
  const table = (): TableBuilder =>
    client.schema("v2_commerce").from("sales_orders") as TableBuilder;

  return {
    insertSalesOrder(ctx: V2TenantContext, order: V2SalesOrder): V2SalesOrder {
      const workspaceId = requireWorkspaceId(ctx);
      if (order.workspaceId !== workspaceId) {
        throw new Error("Commerce insert workspaceId must match tenant context.");
      }
      void table().insert(order);
      return order;
    },
    getSalesOrder(ctx: V2TenantContext, id: string): V2SalesOrder | null {
      const workspaceId = requireWorkspaceId(ctx);
      void table().select("id, workspace_id, status").eq("id", id).eq("workspace_id", workspaceId);
      return null;
    },
  };
}
