import type { CommerceRepository, V2SalesOrder } from "../../domains/commerce/repository";
import { requireWorkspaceId, type V2TenantContext } from "../tenantContext";
import {
  commerceTablePath,
  readJsonTable,
  V2PersistenceError,
  writeJsonTable,
} from "./jsonTable";

/**
 * Local durable Commerce table (v2_commerce.sales_orders). Identity-independent.
 * Does not query Execution files. PostgREST/RLS is unchanged and unused here.
 */
export function createCommerceDurableRepository(dataDir: string): CommerceRepository {
  const filePath = commerceTablePath(dataDir);

  return {
    insertSalesOrder(ctx: V2TenantContext, order: V2SalesOrder): V2SalesOrder {
      const workspaceId = requireWorkspaceId(ctx);
      if (order.workspaceId !== workspaceId) {
        throw new Error("Commerce insert workspaceId must match tenant context.");
      }
      const persisted: V2SalesOrder = { ...order, workspaceId };
      const rows = readJsonTable<V2SalesOrder>(filePath);
      if (rows.some((row) => row.id === persisted.id)) {
        throw new V2PersistenceError("duplicate entity id", { kind: "duplicate" });
      }
      writeJsonTable(filePath, [...rows, persisted]);
      return persisted;
    },
    getSalesOrder(ctx: V2TenantContext, id: string): V2SalesOrder | null {
      const workspaceId = requireWorkspaceId(ctx);
      const row = readJsonTable<V2SalesOrder>(filePath).find((item) => item.id === id);
      if (!row || row.workspaceId !== workspaceId) return null;
      return row;
    },
    deleteSalesOrder(ctx: V2TenantContext, id: string): void {
      const workspaceId = requireWorkspaceId(ctx);
      const rows = readJsonTable<V2SalesOrder>(filePath);
      const next = rows.filter((row) => !(row.id === id && row.workspaceId === workspaceId));
      if (next.length === rows.length) return;
      writeJsonTable(filePath, next);
    },
  };
}
