/**
 * Expo Router route-level ErrorBoundary for Pulse Driver (D21). Same behavior as the
 * main app's root ErrorBoundary (app/_layout.tsx): session expired → sign out and go to
 * sign-in; stale deploy/bundle → recover; anything else → reported, with the shared
 * ContentErrorState screen. Only the sign-in route differs (the driver's own).
 */
import { tGlobal } from '@pulse/core/contexts/LanguageContext';
import { captureException } from '@pulse/core/lib/crashReporter';
import { SUPABASE_CONFIG_MISSING_MESSAGE } from '@pulse/core/lib/supabase';
import {
  isStaleNativeBundleError,
  isStaleWebChunkError,
  recoverStaleNativeBundle,
  recoverStaleWebDeploy,
} from '@pulse/core/lib/webDeployRecovery';
import * as authService from '@pulse/domain/features/auth/services/auth.service';
import { ContentErrorState } from '@pulse/ui/components/ContentErrorState';
import Constants from 'expo-constants';
import { useRouter, type ErrorBoundaryProps, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DRIVER_ROUTES } from '../lib/routes';

const isNetworkError = (error: Error) =>
  error.message === 'Network request failed' ||
  error.message === 'Failed to fetch' ||
  /network|failed to fetch|fetch failed|load failed/i.test(error.message) ||
  /AuthRetryableFetchError|network request failed/i.test(error.message);

const isConfigMissingError = (error: Error) =>
  error.message.includes('Missing Supabase config') || error.message === SUPABASE_CONFIG_MISSING_MESSAGE;

export function DriverRouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sessionExpired = authService.isSessionExpiredError(error);

  useEffect(() => {
    if (!sessionExpired) return;
    authService.signOut().catch(() => {});
    try {
      router.replace(DRIVER_ROUTES.SIGN_IN as Href);
    } catch {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const base = (Constants.expoConfig?.experiments?.baseUrl ?? '').replace(/\/+$/, '');
        window.location.replace(`${base}${DRIVER_ROUTES.SIGN_IN}`);
      }
    }
  }, [sessionExpired, router]);

  useEffect(() => {
    if (isStaleWebChunkError(error)) {
      recoverStaleWebDeploy();
      return;
    }
    if (isStaleNativeBundleError(error)) recoverStaleNativeBundle();
  }, [error]);

  useEffect(() => {
    if (sessionExpired || isStaleWebChunkError(error) || isStaleNativeBundleError(error)) return;
    captureException(error, { source: 'root-error-boundary' });
  }, [error, sessionExpired]);

  if (sessionExpired) return null;

  const staleDeploy = isStaleWebChunkError(error);
  const staleNativeBundle = isStaleNativeBundleError(error);
  const configMissing = isConfigMissingError(error);
  const network = isNetworkError(error);
  const variant = configMissing ? 'config' : staleDeploy ? 'update' : network ? 'connection' : 'generic';

  return (
    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <ContentErrorState
        variant={variant}
        tone="dark"
        layout="full"
        title={
          configMissing
            ? tGlobal('appNotConfigured')
            : staleDeploy
              ? undefined
              : network
                ? tGlobal('connectionErrorShort')
                : tGlobal('somethingWentWrong')
        }
        message={
          configMissing || staleDeploy || network
            ? undefined
            : staleNativeBundle
              ? 'The dev bundle is out of date. Stop all Metro servers, run npm run start:clean, reopen Expo Go, and try again.'
              : error.message
        }
        technicalDetails={error.stack ?? error.message}
        onRetry={
          configMissing || staleDeploy
            ? undefined
            : () => {
                if (staleNativeBundle && recoverStaleNativeBundle()) return;
                retry();
              }
        }
        retryLabel={tGlobal('tryAgain')}
      />
    </View>
  );
}
