import { recordPlatformEventLog } from './PlatformEventLog';
import type { PlatformDomainEvent } from './types';
import type { EventBus } from './EventBus.contract';

type Handler = (event: PlatformDomainEvent) => void | Promise<void>;

export class InProcessEventBus implements EventBus {
  private readonly handlers = new Map<PlatformDomainEvent['name'], Set<Handler>>();

  async publish<TPayload>(event: PlatformDomainEvent<TPayload>): Promise<void> {
    recordPlatformEventLog(event as PlatformDomainEvent);
    const subs = this.handlers.get(event.name);
    if (!subs?.size) return;
    await Promise.all([...subs].map((handler) => handler(event as PlatformDomainEvent)));
  }

  subscribe<TPayload>(
    name: PlatformDomainEvent['name'],
    handler: (event: PlatformDomainEvent<TPayload>) => void | Promise<void>,
  ): () => void {
    const set = this.handlers.get(name) ?? new Set<Handler>();
    const wrapped = handler as Handler;
    set.add(wrapped);
    this.handlers.set(name, set);
    return () => {
      set.delete(wrapped);
      if (set.size === 0) this.handlers.delete(name);
    };
  }
}

let bus: InProcessEventBus | null = null;

export function getPlatformEventBus(): InProcessEventBus {
  if (!bus) bus = new InProcessEventBus();
  return bus;
}

export function resetPlatformEventBusForTests(): void {
  bus = null;
}
