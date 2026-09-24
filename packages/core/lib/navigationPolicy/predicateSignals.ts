/**
 * Notify NavigationPolicy when onboarding predicate sync flags change.
 * Flag setters live outside React; without this, evaluate would stay stale.
 */

type Listener = () => void;

let version = 0;
const listeners = new Set<Listener>();

export function getPredicateSignalVersion(): number {
  return version;
}

export function bumpPredicateSignals(): void {
  version += 1;
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // never throw from signal fan-out
    }
  }
}

export function subscribePredicateSignals(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
