/**
 * Module-level pending set for "Add to books" RPCs.
 * Subscribed via useSyncExternalStore so only ledger rows re-render while the DB works,
 * without ChatScreen setState on the active message id.
 */

type Listener = () => void;

let pendingIds = new Set<string>();
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      // non-fatal
    }
  }
}

export function subscribeLedgerBookPending(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLedgerBookPendingSnapshot(): ReadonlySet<string> {
  return pendingIds;
}

export function markLedgerBookPending(messageId: string): void {
  if (pendingIds.has(messageId)) return;
  pendingIds = new Set(pendingIds);
  pendingIds.add(messageId);
  emit();
}

export function clearLedgerBookPending(messageId: string): void {
  if (!pendingIds.has(messageId)) return;
  pendingIds = new Set(pendingIds);
  pendingIds.delete(messageId);
  emit();
}
