/**
 * Platform commands — intent to perform an action.
 * Commands are handled by orchestrators or product services; they are not facts.
 *
 * Contrast with `PlatformDomainEvent` in ./types.ts — events describe what already happened.
 */

export type PlatformCommandName =
  | 'PublishIndent'
  | 'AssignTrip'
  | 'CompleteDelivery';

export type PlatformCommand<TPayload = Record<string, unknown>> = {
  name: PlatformCommandName;
  workspaceId: string;
  correlationId: string;
  requestedBy: string;
  requestedAt: string;
  payload: TPayload;
};

export type PublishIndentCommandPayload = {
  orderId: string;
};

export type PublishIndentCommand = PlatformCommand<PublishIndentCommandPayload>;
