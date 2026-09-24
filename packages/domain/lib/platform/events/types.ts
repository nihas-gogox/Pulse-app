/** Domain events — facts that have already occurred. Subscribers react; publishers do not await side effects. */

export type PlatformDomainEventName =
  | 'OrderReadyForDispatch'
  | 'IndentCreated'
  | 'TripAssigned'
  | 'TripStarted'
  | 'TripDelivered'
  | 'PODUploaded';

export type PlatformDomainEvent<TPayload = Record<string, unknown>> = {
  name: PlatformDomainEventName;
  workspaceId: string;
  correlationId: string;
  payload: TPayload;
  occurredAt: string;
};
