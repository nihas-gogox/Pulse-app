/**
 * Supported platform public contract (versioned API surface).
 *
 * Rule: only symbols exported from this file are part of the supported platform
 * contract. Everything else under `lib/platform/` is internal and may change
 * without notice. Import via `@/lib/platform` (Core) or `@pulse-platform/index`
 * (Commerce). Never import from `repositories/`, `mappers/`, or `services/` directly.
 */
export { configurePlatformDb, getPlatformDb, requirePlatformDb } from '@pulse/core/lib/platform/db/platformDb';
export { CustomerService } from './services/CustomerService';
export { WarehouseService } from './services/WarehouseService';
export { ProductService } from './services/ProductService';
export { PlatformReadinessService } from './services/PlatformReadinessService';
export { IndentService } from './services/IndentService';
export type {
  PlatformCustomer,
  PlatformWarehouse,
  PlatformProduct,
  WorkspaceId,
  CreatePlatformCustomerInput,
  CreatePlatformWarehouseInput,
  CreatePlatformProductInput,
  UpdatePlatformCustomerInput,
  UpdatePlatformWarehouseInput,
  UpdatePlatformProductInput,
} from './types/master-data';
export type { UpdateClientHubProfileInput } from './types/client-hub-profile';
export { getPlatformEventBus, resetPlatformEventBusForTests } from './events/InProcessEventBus';
export {
  clearPlatformEventLog,
  getPlatformEventLog,
  getPlatformEventLogByCorrelationId,
  isPlatformEventLogEnabled,
  setPlatformEventLogEnabled,
} from './events/PlatformEventLog';
export type { PlatformEventLogEntry } from './events/PlatformEventLog';
export { verifyPublishIndentAcceptance } from './orchestration/verifyPublishAcceptance';
export type {
  PublishAcceptanceEventRow,
  PublishAcceptanceVerification,
} from './orchestration/verifyPublishAcceptance';
export type { EventBus } from './events/EventBus.contract';
export {
  createExecutionOrchestrator,
  getExecutionOrchestrator,
  resetExecutionOrchestratorForTests,
} from './orchestration/ExecutionOrchestrator';
export type { ExecutionOrchestrator } from './orchestration/ExecutionOrchestrator.contract';
export type {
  OrchestrationCommandEnvelope,
  PublishIndentCommand,
  PublishIndentCommandPayload,
  PublishIndentResult,
  PublishExecutionPlanCommand,
  PublishExecutionPlanCommandPayload,
  PublishExecutionPlanStopInput,
  PublishExecutionPlanAllocationInput,
  PublishExecutionPlanOrderInput,
  PublishExecutionPlanResult,
  OrchestrationError,
  OrchestrationErrorCode,
} from './orchestration/types';
export type { PlatformCommand, PlatformCommandName } from './events/commands';
export type { PlatformDomainEvent, PlatformDomainEventName } from './events/types';
