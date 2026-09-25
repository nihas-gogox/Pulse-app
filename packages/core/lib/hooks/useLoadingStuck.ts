import { useEffect, useState } from 'react';

/** True after `timeoutMs` while `active` stays true — surfaces retry UI for hung fetches. */
export function useLoadingStuck(active: boolean, timeoutMs = 12_000): boolean {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (!active) {
      setStuck(false);
      return;
    }
    const id = setTimeout(() => setStuck(true), timeoutMs);
    return () => clearTimeout(id);
  }, [active, timeoutMs]);

  return stuck;
}
