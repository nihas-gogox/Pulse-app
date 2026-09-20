import type { ExecutionRepository, V2Trip } from "../../domains/execution/repository";
import { requireWorkspaceId, type V2TenantContext } from "../tenantContext";
import {
  executionTablePath,
  readJsonTable,
  V2PersistenceError,
  writeJsonTable,
} from "./jsonTable";

/**
 * Local durable Execution table (v2_execution.trips). Identity-independent.
 * Does not query Commerce files.
 */
export function createExecutionDurableRepository(dataDir: string): ExecutionRepository {
  const filePath = executionTablePath(dataDir);

  return {
    insertTrip(ctx: V2TenantContext, trip: V2Trip): V2Trip {
      const workspaceId = requireWorkspaceId(ctx);
      if (trip.workspaceId !== workspaceId) {
        throw new Error("Execution insert workspaceId must match tenant context.");
      }
      const persisted: V2Trip = { ...trip, workspaceId };
      const rows = readJsonTable<V2Trip>(filePath);
      if (rows.some((row) => row.id === persisted.id)) {
        throw new V2PersistenceError("duplicate entity id", { kind: "duplicate" });
      }
      writeJsonTable(filePath, [...rows, persisted]);
      return persisted;
    },
    getTrip(ctx: V2TenantContext, id: string): V2Trip | null {
      const workspaceId = requireWorkspaceId(ctx);
      const row = readJsonTable<V2Trip>(filePath).find((item) => item.id === id);
      if (!row || row.workspaceId !== workspaceId) return null;
      return row;
    },
    getTripByOrderId(ctx: V2TenantContext, orderId: string): V2Trip | null {
      const workspaceId = requireWorkspaceId(ctx);
      return (
        readJsonTable<V2Trip>(filePath).find(
          (trip) => trip.orderId === orderId && trip.workspaceId === workspaceId,
        ) ?? null
      );
    },
  };
}
