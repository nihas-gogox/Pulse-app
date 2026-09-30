import { useGlobalSyncStore } from '@/lib/globalSync/useGlobalSyncStore';
import { useEffect, useState } from 'react';

/** True once `get_global_app_bootstrap` (+ invite slices) finished for this org. */
export function useBootstrapReady(orgId: string | null): boolean {
  const bootstrapStatus = useGlobalSyncStore((s) => s.bootstrapStatus);
  const bootstrappedOrgId = useGlobalSyncStore((s) => s.bootstrappedOrgId);
  return bootstrapStatus === 'ready' && bootstrappedOrgId === orgId && !!orgId;
}

/**
 * Returns false briefly after orgId is set so boot-critical RPCs (global bootstrap)
 * are not competing with dozens of parallel TanStack queryFns on cold start.
 */
export function useQueryBootDefer(orgId: string | null, delayMs = 200): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    if (!orgId) return;
    const t = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(t);
  }, [orgId, delayMs]);
  return ready;
}
