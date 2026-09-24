import { indentRepository } from '../repositories/indentRepository';
import type { SalesOrderForPublish } from '../repositories/orderRepository';
import type { WorkspaceId } from '../types/master-data';

export const IndentService = {
  findBySalesOrderId(workspaceId: WorkspaceId, salesOrderId: string) {
    return indentRepository.findBySalesOrderId(workspaceId, salesOrderId);
  },
  createFromSalesOrder(input: {
    workspaceId: WorkspaceId;
    order: SalesOrderForPublish;
    requestedBy: string;
  }) {
    return indentRepository.createFromSalesOrder(input);
  },
  findByExecutionPlanId(workspaceId: WorkspaceId, executionPlanId: string) {
    return indentRepository.findByExecutionPlanId(workspaceId, executionPlanId);
  },
  createFromExecutionPlan(input: {
    workspaceId: WorkspaceId;
    executionPlanId: string;
    planNumber: string;
    vehicleType?: string;
    orderCount: number;
    totalWeightKg: number;
    totalAmount: number;
    supplierTarget: number;
    pickupSummary: string;
    dropSummary: string;
    requestedBy: string;
    clientName?: string | null;
  }) {
    return indentRepository.createFromExecutionPlan(input);
  },
};
