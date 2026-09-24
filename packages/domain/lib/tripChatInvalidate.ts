/**
 * Trip chat loads conversations in-memory in TripChatProvider. Ledger rows are often
 * created via DB triggers; Supabase realtime may omit tables not in publication.
 * Calling notifyTripChatMessagesChanged() after ledger writes triggers a lightweight refetch.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeTripChatMessagesChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyTripChatMessagesChanged(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      // non-fatal
    }
  }
}
