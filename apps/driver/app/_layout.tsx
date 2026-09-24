/**
 * Pulse Driver root layout (driver extraction, Phase 3).
 *
 * Provider order and root-shell pieces follow the main app's app/_layout.tsx, limited to
 * what the driver relies on (D21, docs/DRIVER_EXTRACTION_D20_D21.json): web shell + RN-web
 * patches, background GPS task, alert host, error boundaries, deploy recovery, crash
 * reporting, realtime foreground pruning, driver-invite deep links. Dispatcher-only pieces
 * (tab bars, global sync, org gates, dispatcher chat, confirm host, push) stay main-only.
 */
import 'react-native-gesture-handler';
// Shadow / pointerEvents RN Web compat — must run before any StyleSheet.create in the tree.
import { ensureWebShellParity } from '@pulse/core/lib/htmlShell';
import '@pulse/core/lib/installWebRnCompatPatches';
import { ensureWebRnCompatPatches } from '@pulse/core/lib/installWebRnCompatPatches';
// Background GPS task must be registered before any component mounts — keep it here.
import '@pulse/domain/lib/tracking/backgroundTasks';
import 'react-native-reanimated';
import { AppAlertHost } from '@pulse/ui/components/AppAlertHost';
import { AppErrorBoundary } from '@pulse/ui/components/AppErrorBoundary';
import { AppLoadingSplash } from '@pulse/ui/components/AppLoadingSplash';
import { useColorScheme } from '@pulse/ui/components/useColorScheme';
import { QUERY_CACHE_BUSTER } from '@pulse/core/lib/cache/cacheBuster';
import { initCrashReporter } from '@pulse/core/lib/crashReporter';
import { installForegroundPruning } from '@pulse/core/lib/realtimeRegistry';
import {
  clearNativeBundleReloadGuard,
  installNativeBundleRecoveryHandler,
  installWebDeployRecoveryListener,
} from '@pulse/core/lib/webDeployRecovery';
import { installWebViewportHeight } from '@pulse/core/lib/webViewportHeight';
import { installDriverInviteDeepLinkListener } from '@pulse/domain/lib/driverInviteDeepLink.util';
import { hydrateSignupFlowFlags } from '@pulse/domain/lib/onboarding/businessSignupBranding.util';
import { LanguageProvider } from '@pulse/core/contexts/LanguageContext';
import { NetworkProvider } from '@pulse/core/contexts/NetworkContext';
import Theme from '@pulse/core/constants/Theme';
import { makeQueryClient } from '@pulse/core/lib/queryClient';
import { routeStackScreenOptions } from '@pulse/core/lib/routeStackOptions';
import { hasSupabaseConfig } from '@pulse/core/lib/supabase';
import { ActiveWorkspaceProvider } from '@pulse/domain/contexts/ActiveWorkspaceContext';
import { AuthProvider } from '@pulse/domain/contexts/AuthContext';
import { OrganizationProvider } from '@pulse/domain/contexts/OrganizationContext';
import {
  isLinkedOrgDisplayQueryKey,
  purgeLinkedOrgDisplayQueries,
} from '@pulse/domain/lib/queries/linkedOrgDisplayCache';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DriverAppGate } from '../components/DriverAppGate';
import { DriverRouteErrorBoundary } from '../components/DriverRouteErrorBoundary';

// Own persisted-cache key: on web both apps share the gogopulse.com origin, and the
// driver app must not hydrate the main app's cache (or the reverse).
const DRIVER_QUERY_CACHE_KEY = 'pulse-driver-cache-v1';

initCrashReporter();
// Dev (web.output "single") skips +html.tsx — inject its shell CSS/JS at runtime.
ensureWebShellParity();

export { DriverRouteErrorBoundary as ErrorBoundary };

export default function DriverRootLayout() {
  useEffect(() => {
    ensureWebRnCompatPatches();
    clearNativeBundleReloadGuard();
    installNativeBundleRecoveryHandler();
    installWebDeployRecoveryListener();
    installForegroundPruning();
    void hydrateSignupFlowFlags();
    if (Platform.OS !== 'web') return;
    return installWebViewportHeight();
  }, []);
  useEffect(() => installDriverInviteDeepLinkListener(), []);

  const [fontsLoaded] = useFonts({
    SpaceMono: require('@/assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });
  const queryClient = useMemo(() => makeQueryClient(), []);
  const persister = useMemo(
    () => createAsyncStoragePersister({ storage: AsyncStorage, key: DRIVER_QUERY_CACHE_KEY, throttleTime: 10_000 }),
    [],
  );

  if (!fontsLoaded && Platform.OS !== 'web') {
    return (
      <SafeAreaProvider>
        <LanguageProvider>
          <AppLoadingSplash variant="preparing" useGlobalI18n />
        </LanguageProvider>
      </SafeAreaProvider>
    );
  }

  if (!hasSupabaseConfig()) {
    return (
      <SafeAreaProvider>
        <ConfigErrorScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AppErrorBoundary>
        <GestureHandlerRootView style={styles.ghRoot}>
          <PersistQueryClientProvider
            client={queryClient}
            onSuccess={() => purgeLinkedOrgDisplayQueries(queryClient)}
            persistOptions={{
              persister,
              buster: QUERY_CACHE_BUSTER,
              maxAge: 6 * 60 * 60 * 1000,
              dehydrateOptions: {
                shouldDehydrateQuery: (query) => {
                  if (query.state.status !== 'success') return false;
                  const data = query.state.data;
                  if (Array.isArray(data) && data.length === 0) return false;
                  if (isLinkedOrgDisplayQueryKey(query.queryKey)) return false;
                  return true;
                },
              },
            }}
          >
            <NetworkProvider>
              <AuthProvider>
                <DriverAppGate
                  renderDataPlane={(children) => (
                    <OrganizationProvider>
                      <ActiveWorkspaceProvider>{children}</ActiveWorkspaceProvider>
                    </OrganizationProvider>
                  )}
                >
                  <DriverStack />
                </DriverAppGate>
              </AuthProvider>
            </NetworkProvider>
          </PersistQueryClientProvider>
        </GestureHandlerRootView>
        </AppErrorBoundary>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

function DriverStack() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppAlertHost />
      <Stack screenOptions={routeStackScreenOptions}>
        <Stack.Screen name="(driver)" />
        <Stack.Screen name="(auth)/sign-in" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)/sign-up" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)/onboarding/index" options={{ animation: 'fade' }} />
        <Stack.Screen name="trip" options={{ animation: 'slide_from_right', headerShown: false }} />
        <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
        <Stack.Screen name="+not-found" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}

function ConfigErrorScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.configError, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.configErrorTitle}>App not configured</Text>
      <Text style={styles.configErrorMessage}>
        Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to the repo-root .env, then restart.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ghRoot: {
    flex: 1,
    ...(Platform.OS === 'web' ? { backgroundColor: Theme.screenBackground, overflow: 'hidden' as const } : null),
  },
  configError: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: Theme.screenBackground,
  },
  configErrorTitle: { fontSize: 18, fontWeight: '700', color: Theme.textPrimary, marginBottom: 12 },
  configErrorMessage: { fontSize: 14, lineHeight: 20, color: Theme.textSecondary },
});
