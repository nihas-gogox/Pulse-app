import type { V2TenantContext } from "../../persistence/tenantContext";

export type V2SalesOrder = {
  id: string;
  workspaceId: string;
  status: "draft" | "placed";
};

export type CommerceRepository = {
  insertSalesOrder: (ctx: V2TenantContext, order: V2SalesOrder) => V2SalesOrder;
  getSalesOrder: (ctx: V2TenantContext, id: string) => V2SalesOrder | null;
};
