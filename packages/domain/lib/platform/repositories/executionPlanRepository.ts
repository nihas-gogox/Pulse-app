import { requirePlatformDb } from '@pulse/core/lib/platform/db/platformDb';
import type { WorkspaceId } from '../types/master-data';
import type {
  PublishExecutionPlanAllocationInput,
  PublishExecutionPlanOrderInput,
  PublishExecutionPlanStopInput,
} from '../orchestration/types';

export type ExecutionPlanRef = {
  id: string;
  planNumber: string;
  status: string;
};

export const executionPlanRepository = {
  /** Idempotency lookup — a plan already published for this client-generated plan id. */
  async findById(workspaceId: WorkspaceId, planId: string): Promise<ExecutionPlanRef | null> {
    const { data, error } = await requirePlatformDb()
      .from('execution_plans')
      .select('id,plan_number,status')
      .eq('organization_id', workspaceId)
      .eq('id', planId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return { id: String(data.id), planNumber: String(data.plan_number), status: String(data.status) };
  },

  async findByClientPlanId(workspaceId: WorkspaceId, clientPlanId: string): Promise<ExecutionPlanRef | null> {
    const { data, error } = await requirePlatformDb()
      .from('execution_plans')
      .select('id,plan_number,status')
      .eq('organization_id', workspaceId)
      .eq('correlation_id', clientPlanId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return { id: String(data.id), planNumber: String(data.plan_number), status: String(data.status) };
  },

  /**
   * Creates the execution_plans row plus its stops, order-line allocations,
   * and sales_order claims atomically via create_execution_plan_with_graph()
   * (migrations 20270913091416, 20270915101200). One Postgres transaction:
   * any exception rolls back the graph and any order claims together.
   * Convert must not call markPlannedForExecutionPlan afterwards.
   */
  async createWithGraph(input: {
    workspaceId: WorkspaceId;
    clientPlanId: string;
    vehicleType?: string;
    stops: PublishExecutionPlanStopInput[];
    route: { sequence: string[] };
    allocations: PublishExecutionPlanAllocationInput[];
    orders: PublishExecutionPlanOrderInput[];
  }): Promise<ExecutionPlanRef> {
    const db = requirePlatformDb();

    const sequenceByStopId = new Map(input.route.sequence.map((id, idx) => [id, idx]));
    const stopsPayload = input.stops.map(s => ({
      clientStopId: s.clientStopId,
      type: s.type,
      sequence: sequenceByStopId.get(s.clientStopId) ?? 0,
      label: s.label,
      contactName: s.contactName,
      contactPhone: s.contactPhone,
      podRequired: s.podRequired,
      warehouseId: s.warehouseId ?? null,
      address: s.address,
    }));

    const { data, error } = await db.rpc('create_execution_plan_with_graph', {
      p_org_id: input.workspaceId,
      p_client_plan_id: input.clientPlanId,
      p_vehicle_type: input.vehicleType ?? null,
      p_stops: stopsPayload,
      p_allocations: input.allocations,
      p_orders: input.orders,
    });
    if (error) {
      // Two publishes racing past the application-level idempotency check
      // (findByClientPlanId) with the same clientPlanId hit the database's
      // own backstop: execution_plans_org_correlation_unique. Treat that as
      // "already exists" rather than a hard failure — the caller (orchestrator)
      // already has an existingPlan lookup path for this.
      if (error.code === '23505') {
        const existing = await executionPlanRepository.findByClientPlanId(input.workspaceId, input.clientPlanId);
        if (existing) return existing;
      }
      throw new Error(error.message);
    }

    const row = Array.isArray(data) ? data[0] : data;
    return { id: String(row.plan_id), planNumber: String(row.plan_number), status: 'ready' };
  },

  async markPublished(planId: string): Promise<void> {
    const { error } = await requirePlatformDb()
      .from('execution_plans')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', planId);
    if (error) throw new Error(error.message);
  },
};
