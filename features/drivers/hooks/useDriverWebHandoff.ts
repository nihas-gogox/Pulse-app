/**
 * Phase 4A web hand-off: when EXPO_PUBLIC_DRIVER_APP_EXTRACTION_ENABLED is on, drivers
 * (and the old driver entry pages) leave the main app for the Pulse Driver web app at
 * /driver. No-op on native and when the flag is off. Rules: driverAppHandoff.util.ts.
 */
import { useOptionalAuth } from '@/contexts/AuthContext';
import {
  driverAppPathFor,
  isDriverWebHandoffEnabled,
  shouldHandOffToDriverApp,
} from '@/features/drivers/utils/driverAppHandoff.util';
import { usePathname } from 'expo-router';
import { useEffect } from 'react';

export function useDriverWebHandoff(): void {
  const pathname = usePathname();
  const auth = useOptionalAuth();
  const sessionAttached = Boolean(auth?.sessionAttached);
  const isDriver = auth?.profile?.role === 'driver';

  useEffect(() => {
    const enabled = isDriverWebHandoffEnabled();
    if (!shouldHandOffToDriverApp({ enabled, pathname, sessionAttached, isDriver })) return;
    if (typeof window === 'undefined') return;
    window.location.replace(driverAppPathFor(pathname, window.location.search));
  }, [pathname, sessionAttached, isDriver]);
}
