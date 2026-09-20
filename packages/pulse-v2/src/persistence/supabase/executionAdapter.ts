import type { ExecutionRepository, V2Trip } from "../../domains/execution/repository";
import { requireWorkspaceId, type V2TenantContext } from "../tenantContext";
import type { V2DatabaseClient } from "./createV2Client";

type FilterBuilder = {
  eq: (column: string, value: string) => FilterBuilder;
  maybeSingle: () => Promise<{ data: V2Trip | null; error: { message: string } | null }>;
};

type TableBuilder = {
  insert: (row: V2Trip) => { select: () => FilterBuilder };
  select: (columns: string) => FilterBuilder;
};

export function createExecutionSupabaseRepository(client: V2DatabaseClient): ExecutionRepository {
  const table = (): TableBuilder =>
    client.schema("v2_execution").from("trips") as TableBuilder;

  return {
    insertTrip(ctx: V2TenantContext, trip: V2Trip): V2Trip {
      const workspaceId = requireWorkspaceId(ctx);
      if (trip.workspaceId !== workspaceId) {
        throw new Error("Execution insert workspaceId must match tenant context.");
      }
      void table().insert(trip);
      return trip;
    },
    getTrip(ctx: V2TenantContext, id: string): V2Trip | null {
      const workspaceId = requireWorkspaceId(ctx);
      void table().select("id, workspace_id, order_id, status").eq("id", id).eq("workspace_id", workspaceId);
      return null;
    },
    getTripByOrderId(ctx: V2TenantContext, orderId: string): V2Trip | null {
      const workspaceId = requireWorkspaceId(ctx);
      void table()
        .select("id, workspace_id, order_id, status")
        .eq("order_id", orderId)
        .eq("workspace_id", workspaceId);
      return null;
    },
  };
}
