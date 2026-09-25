import Theme from '@pulse/core/constants/Theme';
import Layout from '@pulse/core/constants/Layout';
import { useDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import type { DriverTripStopOrderMission } from '../commerce-mission/driverTripStopOrders.types';
import type { DriverStopExecutionStop } from '../execution/driverStopExecution.types';
import { StopVerificationActionBar } from './parts/StopVerificationActionBar';
import {
  buildTripCompletionSummary,
  stopStatusLabel,
  tripCompletionHeadline,
} from './tripCompletionSummary';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  stops: readonly DriverStopExecutionStop[];
  mission: DriverTripStopOrderMission | null;
  tripCompleted: boolean;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onMarkCompleted: () => void;
};

export function DriverTripCompletionScreen({
  stops,
  mission,
  tripCompleted,
  busy,
  error,
  onBack,
  onMarkCompleted,
}: Props) {
  const colors = useDriverThemeColors();
  const insets = useSafeAreaInsets();
  const summary = buildTripCompletionSummary(stops, mission);
  const footerPad =
    Math.max(insets.bottom, 10) + (Platform.OS === 'web' ? Layout.tabBarDockHeight + 8 : 8);

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onBack}>
      <View
        testID="driver-trip-completion"
        style={[styles.page, { backgroundColor: colors.background, paddingTop: insets.top }]}
      >
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={Layout.touchTargetHitSlop}
            style={styles.side}
          >
            <Text style={[styles.back, { color: colors.emerald }]}>Back</Text>
          </Pressable>
          <View style={styles.center}>
            <Text style={[styles.kicker, { color: colors.emerald }]}>
              {tripCompleted ? 'Completed' : 'Summary'}
            </Text>
            <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
              {tripCompleted ? 'Delivery completed' : 'Review route and mark complete'}
            </Text>
          </View>
          <View style={styles.side} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.headline, { color: colors.text }]}>{tripCompletionHeadline(summary)}</Text>
          <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
            Stop and order completion only. Item-level delivered quantity is not recorded on this trip.
          </Text>

          {summary.stops.map((row) => (
            <View
              key={row.stopId}
              style={[styles.stopCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <View style={styles.stopHead}>
                <Text style={[styles.role, { color: colors.emerald }]}>{row.role}</Text>
                <Text style={[styles.status, { color: colors.textMuted }]}>{stopStatusLabel(row.status)}</Text>
              </View>
              <Text style={[styles.place, { color: colors.text }]} numberOfLines={1}>
                {row.place}
              </Text>
              {row.customerName ? (
                <Text style={[styles.customer, { color: colors.text }]} numberOfLines={1}>
                  {row.customerName}
                </Text>
              ) : null}
              {row.orderLabels.length > 0 ? (
                <Text style={[styles.orders, { color: colors.textMuted }]} numberOfLines={2}>
                  {row.orderLabels.join(' · ')}
                </Text>
              ) : null}
              {row.expectedQty != null ? (
                <Text style={[styles.qty, { color: colors.textMuted }]}>
                  {row.expectedQty} {row.expectedQty === 1 ? 'item' : 'items'} on this stop
                </Text>
              ) : null}
            </View>
          ))}
          {error ? (
            <Text style={[styles.error, { color: Theme.negative }]} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <StopVerificationActionBar
          colors={colors}
          cta={tripCompleted ? 'Done' : 'Mark delivery completed'}
          busy={busy}
          bottomInset={footerPad}
          onPress={tripCompleted ? onBack : onMarkCompleted}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  side: {
    width: 64,
    minHeight: Layout.minTouchTargetSize,
    justifyContent: 'center',
  },
  back: { fontSize: 13, fontWeight: '600' },
  center: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  meta: { fontSize: 11, fontWeight: '500' },
  scroll: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
  },
  headline: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  disclaimer: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  stopCard: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  stopHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  role: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  status: { fontSize: 10, fontWeight: '600' },
  place: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  customer: { fontSize: 12, fontWeight: '600' },
  orders: { fontSize: 11, fontWeight: '500' },
  qty: { fontSize: 11, fontWeight: '500' },
  error: { fontSize: 12, fontWeight: '600' },
});
