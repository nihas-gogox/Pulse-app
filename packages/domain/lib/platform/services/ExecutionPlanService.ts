import { executionPlanRepository } from '../repositories/executionPlanRepository';
import type {
  PublishExecutionPlanAllocationInput,
  PublishExecutionPlanOrderInput,
  PublishExecutionPlanStopInput,
} from '../orchestration/types';
import type { WorkspaceId } from '../types/master-data';

export const ExecutionPlanService = {
  findById(workspaceId: WorkspaceId, planId: string) {
    return executionPlanRepository.findById(workspaceId, planId);
  },
  findByClientPlanId(workspaceId: WorkspaceId, clientPlanId: string) {
    return executionPlanRepository.findByClientPlanId(workspaceId, clientPlanId);
  },
  createWithGraph(input: {
    workspaceId: WorkspaceId;
    clientPlanId: string;
    vehicleType?: string;
    stops: PublishExecutionPlanStopInput[];
    route: { sequence: string[] };
    allocations: PublishExecutionPlanAllocationInput[];
    orders: PublishExecutionPlanOrderInput[];
  }) {
    return executionPlanRepository.createWithGraph(input);
  },
  markPublished(planId: string) {
    return executionPlanRepository.markPublished(planId);
  },
};
