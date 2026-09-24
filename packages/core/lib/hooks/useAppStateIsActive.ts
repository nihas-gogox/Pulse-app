import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/** True when the app is in the foreground (active). */
export function useAppStateIsActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      setActive(next === 'active');
    });
    return () => sub.remove();
  }, []);

  return active;
}
