import type {
  PublishExecutionPlanCommand,
  PublishExecutionPlanResult,
  PublishIndentCommand,
  PublishIndentResult,
} from './types';

/**
 * Execution orchestrator contract — thin coordinator only.
 * Implementation: Phase 3.
 */
export type ExecutionOrchestrator = {
  /**
   * Primary entry point — accepts a command envelope.
   * Convenience wrappers may build the envelope from session context.
   */
  publishIndent(command: PublishIndentCommand): Promise<PublishIndentResult>;

  /**
   * Creates the execution plan graph and a linked Core indent in Give Load
   * **draft** (editable). Claims selected sales orders atomically inside
   * `create_execution_plan_with_graph` (Pending Consolidation + execution_plan_id IS NULL).
   * Does not mark the plan published and does not
   * broadcast/share the indent. Idempotent per (workspaceId, payload.clientPlanId).
   * broadcast/share the indent. Idempotent per (workspaceId, payload.clientPlanId).
   * Use shareExecutionPlanToOperations for Operations visibility and
   * Share for Bidding for draft → broadcast.
   */
  publishExecutionPlan(command: PublishExecutionPlanCommand): Promise<PublishExecutionPlanResult>;

  /**
   * Marks an already-converted plan `published` so Commerce Operations can list it.
   * Idempotent. Does not create a second indent.
   */
  shareExecutionPlanToOperations(input: {
    workspaceId: string;
    executionPlanId: string;
  }): Promise<{ executionPlanId: string; alreadyShared: boolean }>;
};
