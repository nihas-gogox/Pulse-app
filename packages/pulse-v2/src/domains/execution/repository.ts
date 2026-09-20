import type { V2TenantContext } from "../../persistence/tenantContext";

export type V2Trip = {
  id: string;
  workspaceId: string;
  orderId: string;
  status: "created";
};

export type ExecutionRepository = {
  insertTrip: (ctx: V2TenantContext, trip: V2Trip) => V2Trip;
  getTrip: (ctx: V2TenantContext, id: string) => V2Trip | null;
  getTripByOrderId: (ctx: V2TenantContext, orderId: string) => V2Trip | null;
};
