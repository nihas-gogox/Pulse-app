import type { PlatformDomainEvent } from './types';

/** Event bus contract — implementation in Phase 3. */
export type EventBus = {
  publish<TPayload>(event: PlatformDomainEvent<TPayload>): Promise<void>;
  subscribe<TPayload>(
    name: PlatformDomainEvent['name'],
    handler: (event: PlatformDomainEvent<TPayload>) => void | Promise<void>,
  ): () => void;
};
