/**
 * Significant app resume — not every Chrome tab flick.
 *
 * Native: background → active (and inactive → active).
 * Web: document was hidden ≥ minHiddenMs, or AppState background → active.
 */
import { AppState, Platform, type AppStateStatus } from 'react-native';

export type SignificantAppResumeOptions = {
  /** Web: minimum time hidden before resume fires. Default 60s. */
  minHiddenMs?: number;
};

export function subscribeSignificantAppResume(
  onResume: () => void,
  options?: SignificantAppResumeOptions,
): () => void {
  const minHiddenMs = options?.minHiddenMs ?? 60_000;
  let appState: AppStateStatus = AppState.currentState;
  let hiddenAt: number | null =
    typeof document !== 'undefined' && document.hidden ? Date.now() : null;

  const fire = () => {
    try {
      onResume();
    } catch {
      /* ignore subscriber errors */
    }
  };

  const onAppStateChange = (next: AppStateStatus) => {
    const prev = appState;
    appState = next;
    if (next !== 'active') return;

    if (prev === 'background') {
      fire();
      return;
    }
    // Native brief inactive (control center / permission sheet) still counts.
    if (prev === 'inactive' && Platform.OS !== 'web') {
      fire();
    }
  };

  const sub = AppState.addEventListener('change', onAppStateChange);

  let onVisibility: (() => void) | null = null;
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt == null) return;
      const elapsed = Date.now() - hiddenAt;
      hiddenAt = null;
      if (elapsed >= minHiddenMs) fire();
    };
    document.addEventListener('visibilitychange', onVisibility);
  }

  return () => {
    sub.remove();
    if (onVisibility && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
}
