/**
 * Driver Commerce Mission — first read-only presentation slice.
 *
 * Delivery Mission → Stops → Orders. Data comes only from Primitive A
 * (`useDriverCommerceMission` → `fetchDriverTripStopOrders`).
 *
 * Read-only: no Arrive / Complete / Skip / Fail / POD. This file does not
 * import DriverMissionStopsList, DriverTripFlowCard, useDriverStopExecution,
 * or features/driver/execution/*.
 *
 * Navigation: reachable via ROUTES.driverCommerceMission(tripId) only.
 * Home / FlowCard CTAs are a later explicit step — do not wire them here.
 */
import { CenteredLoadingView } from '@pulse/ui/components/CenteredLoadingView';
import {
  DRIVER_DETAIL_HORIZONTAL_PAD,
  DriverSubScreenHeader,
  driverDetailPageBackground,
} from '../../../components/driver/DriverSubScreenHeader';
import { DriverCommerceMissionView } from './DriverCommerceMissionView';
import { useDriverCommerceMission } from './useDriverCommerceMission';
import { useDriverTheme, useDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
    return value[0];
  }
  return null;
}

export function DriverCommerceMissionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark } = useDriverTheme();
  const colors = useDriverThemeColors();
  const pageBg = driverDetailPageBackground(isDark, colors.background);
  const params = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = firstParam(params.tripId);
  const state = useDriverCommerceMission(tripId);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(driver)');
  }, [router]);

  const viewColors = useMemo(
    () => ({
      text: colors.text,
      textMuted: colors.textMuted,
      surface: colors.surface,
      border: colors.borderSubtle,
    }),
    [colors.borderSubtle, colors.surface, colors.text, colors.textMuted],
  );

  return (
    <View style={[styles.root, { backgroundColor: pageBg }]}>
      <DriverSubScreenHeader
        title="Delivery Mission"
        subtitle="Orders on this trip"
        onBack={handleBack}
      />

      {!tripId ? (
        <View style={styles.centered}>
          <Text style={[styles.centeredText, { color: colors.textMuted }]}>No trip selected.</Text>
        </View>
      ) : null}

      {tripId && state.status === 'loading' ? (
        <CenteredLoadingView message="Loading delivery mission" />
      ) : null}

      {tripId && state.status !== 'loading' ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{
            paddingHorizontal: DRIVER_DETAIL_HORIZONTAL_PAD,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 16) + 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          <DriverCommerceMissionView
            mission={state.mission}
            loadError={state.status === 'error' ? state.error.message : null}
            colors={viewColors}
          />
        </ScrollView>
      ) : null}
    </View>
  );
}

export default DriverCommerceMissionScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  centeredText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
