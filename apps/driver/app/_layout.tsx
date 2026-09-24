/**
 * Pulse Driver root layout (driver extraction, Phase 3).
 *
 * Provider order follows the main app's app/_layout.tsx, limited to providers that are
 * already shared packages. Root-shell pieces the main layout also mounts (alert/confirm
 * hosts, error boundary, web RN compat patches, background-task registration, chat
 * providers, global sync, …) are not classified yet — decision D21 — and are NOT
 * mounted here until they are. See docs/DRIVER_EXTRACTION_DECISIONS.md (Phase 3).
 */
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { AppLoadingSplash } from '@pulse/ui/components/AppLoadingSplash';
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
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DriverAppGate } from '../components/DriverAppGate';

// Own persisted-cache key: on web both apps share the gogopulse.com origin, and the
// driver app must not hydrate the main app's cache (or the reverse).
const DRIVER_QUERY_CACHE_KEY = 'pulse-driver-cache-v1';
// Same build-scoped buster rule as the main app (lib/cache/cacheBuster.ts, not yet
// shared — D21): any deploy discards caches written by older code.
const buildId = Constants.expoConfig?.extra?.buildId;
const DRIVER_QUERY_CACHE_BUSTER = `2:${typeof buildId === 'string' && buildId ? buildId : 'dev'}`;

export default function DriverRootLayout() {
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
        <GestureHandlerRootView style={styles.ghRoot}>
          <PersistQueryClientProvider
            client={queryClient}
            onSuccess={() => purgeLinkedOrgDisplayQueries(queryClient)}
            persistOptions={{
              persister,
              buster: DRIVER_QUERY_CACHE_BUSTER,
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
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

function DriverStack() {
  // Main app: web is always light (components/useColorScheme.web.ts), native follows the OS.
  const systemScheme = useColorScheme();
  const scheme = Platform.OS === 'web' ? 'light' : systemScheme;
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={routeStackScreenOptions}>
        <Stack.Screen name="(driver)" />
        <Stack.Screen name="(auth)/sign-in" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)/sign-up" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)/onboarding/index" options={{ animation: 'fade' }} />
        <Stack.Screen name="trip" options={{ animation: 'slide_from_right', headerShown: false }} />
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
