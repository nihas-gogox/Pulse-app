/**
 * Mounts the driver app according to decideDriverGate (lib/driverAppGate.ts):
 * splash while resolving, sign-in without a session, a clean rejection for signed-in
 * non-drivers, and the data plane (org/workspace providers) once a session is attached.
 */
import { AppLoadingSplash } from '@pulse/ui/components/AppLoadingSplash';
import { useAuth } from '@pulse/domain/contexts/AuthContext';
import Constants from 'expo-constants';
import { Redirect, usePathname, type Href } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { decideDriverGate } from '../lib/driverAppGate';
import { DRIVER_ROUTES, isPublicDriverPath } from '../lib/routes';
import { NotDriverScreen } from './NotDriverScreen';

const WEB_BASE_URL = Constants.expoConfig?.experiments?.baseUrl ?? '';

type Props = {
  children: ReactNode;
  /** Wraps children in the authenticated data plane (organization/workspace providers). */
  renderDataPlane: (children: ReactNode) => ReactNode;
};

export function DriverAppGate({ children, renderDataPlane }: Props) {
  const { sessionAttached, status, loading, profile } = useAuth();
  const pathname = usePathname();
  const decision = decideDriverGate({
    sessionAttached,
    status,
    loading,
    hasProfile: Boolean(profile),
    role: profile?.role,
    publicRoute: isPublicDriverPath(pathname, WEB_BASE_URL),
  });

  switch (decision) {
    case 'public':
      return <>{children}</>;
    case 'sign-in':
      return <SignInBounce>{renderDataPlane(children)}</SignInBounce>;
    case 'splash':
      return <AppLoadingSplash variant="session" />;
    case 'not-driver':
      return <NotDriverScreen />;
    case 'public-with-session':
    case 'driver':
      return <>{renderDataPlane(children)}</>;
  }
}

/**
 * Expo Router throws if a Redirect runs before the root navigator has painted once
 * (same guard as the main app's shouldApplyUnsignedDataPlaneRedirect). First paint keeps
 * the Stack — inside the data plane, so a private screen never renders without its
 * providers — then redirects to sign-in.
 */
function SignInBounce({ children }: { children: ReactNode }) {
  const [navigatorMounted, setNavigatorMounted] = useState(false);
  useEffect(() => setNavigatorMounted(true), []);
  if (navigatorMounted) return <Redirect href={DRIVER_ROUTES.SIGN_IN as Href} />;
  return <>{children}</>;
}
