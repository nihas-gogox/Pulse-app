import { orderRepository } from '../repositories/orderRepository';
import type { SalesOrderForPublish } from '../repositories/orderRepository';
import type { WorkspaceId } from '../types/master-data';

const DISPATCHABLE_STATUSES = new Set(['Pending Consolidation']);

export const OrderService = {
  getForPublish(workspaceId: WorkspaceId, orderId: string): Promise<SalesOrderForPublish | null> {
    return orderRepository.getForPublish(workspaceId, orderId);
  },
  isDispatchable(status: string): boolean {
    return DISPATCHABLE_STATUSES.has(status);
  },
  markPlanned(workspaceId: WorkspaceId, orderId: string): Promise<void> {
    return orderRepository.updateStatus(workspaceId, orderId, 'Planned');
  },
  /** Kept for non-Convert callers. Convert claims orders inside create_execution_plan_with_graph. */
  markPlannedForExecutionPlan(workspaceId: WorkspaceId, orderIds: string[], executionPlanId: string): Promise<void> {
    return orderRepository.markPlannedForExecutionPlan(workspaceId, orderIds, executionPlanId);
  },
  listPlanLinks(workspaceId: WorkspaceId, orderIds: string[]) {
    return orderRepository.listPlanLinks(workspaceId, orderIds);
  },
};
