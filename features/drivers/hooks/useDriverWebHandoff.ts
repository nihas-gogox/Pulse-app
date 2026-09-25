/**
 * Web hand-off (driver extraction Phase 4A, permanent since 4D): drivers (and the old
 * driver entry pages) leave the main app for the Pulse Driver web app at /driver.
 * No-op on native. Rules: driverAppHandoff.util.ts.
 */
import { useOptionalAuth } from '@/contexts/AuthContext';
import {
  driverAppPathFor,
  shouldHandOffToDriverApp,
} from '@/features/drivers/utils/driverAppHandoff.util';
import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export function useDriverWebHandoff(): void {
  const pathname = usePathname();
  const auth = useOptionalAuth();
  const sessionAttached = Boolean(auth?.sessionAttached);
  const isDriver = auth?.profile?.role === 'driver';
  const signedOut = auth?.status === 'unauthenticated';

  useEffect(() => {
    const enabled = Platform.OS === 'web';
    if (!shouldHandOffToDriverApp({ enabled, pathname, sessionAttached, isDriver, signedOut })) return;
    if (typeof window === 'undefined') return;
    window.location.replace(driverAppPathFor(pathname, window.location.search));
  }, [pathname, sessionAttached, isDriver, signedOut]);
}
