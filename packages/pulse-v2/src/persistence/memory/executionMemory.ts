import type { ExecutionRepository, V2Trip } from "../../domains/execution/repository";
import { V2PersistenceError } from "../v2PersistenceError";
import { requireWorkspaceId, type V2TenantContext } from "../tenantContext";

export function createExecutionMemoryRepository(): ExecutionRepository {
  const trips = new Map<string, V2Trip>();

  return {
    insertTrip(ctx: V2TenantContext, trip: V2Trip): V2Trip {
      const workspaceId = requireWorkspaceId(ctx);
      if (trip.workspaceId !== workspaceId) {
        throw new Error("Execution insert workspaceId must match tenant context.");
      }
      if (trips.has(trip.id)) {
        throw new V2PersistenceError("duplicate entity id", { kind: "duplicate" });
      }
      trips.set(trip.id, trip);
      return trip;
    },
    getTrip(ctx: V2TenantContext, id: string): V2Trip | null {
      const workspaceId = requireWorkspaceId(ctx);
      const row = trips.get(id) ?? null;
      if (!row || row.workspaceId !== workspaceId) return null;
      return row;
    },
    getTripByOrderId(ctx: V2TenantContext, orderId: string): V2Trip | null {
      const workspaceId = requireWorkspaceId(ctx);
      for (const trip of trips.values()) {
        if (trip.orderId === orderId && trip.workspaceId === workspaceId) return trip;
      }
      return null;
    },
  };
}
