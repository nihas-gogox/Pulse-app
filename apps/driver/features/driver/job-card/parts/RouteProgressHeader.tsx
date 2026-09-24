import { Pressable, StyleSheet, Text, View } from 'react-native';
import Layout from '@pulse/core/constants/Layout';
import { getDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';

type Colors = ReturnType<typeof getDriverThemeColors>;

type Props = {
  colors: Colors;
  done: number;
  total: number;
  orderCount: number;
  remainingKmLabel: string | null;
  onViewTripPlan?: () => void;
};

export function RouteProgressHeader({
  colors,
  done,
  total,
  orderCount,
  remainingKmLabel,
  onViewTripPlan,
}: Props) {
  const ordersLabel = orderCount > 0
    ? `${orderCount} ${orderCount === 1 ? 'order' : 'orders'}`
    : null;

  return (
    <View style={styles.wrap} testID="multi-order-route-header">
      <View style={styles.top}>
        <Text style={[styles.kicker, { color: colors.emerald }]}>Today's route</Text>
        {onViewTripPlan ? (
          <Pressable
            onPress={onViewTripPlan}
            accessibilityRole="button"
            accessibilityLabel="View trip plan on map"
            hitSlop={Layout.touchTargetHitSlop}
            style={styles.planLink}
          >
            <Text style={[styles.planLinkText, { color: colors.emerald }]}>View plan</Text>
          </Pressable>
        ) : (
          <Text style={[styles.pill, { color: colors.emerald }]}>
            {done}/{total}
          </Text>
        )}
      </View>
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        {done} of {total} {total === 1 ? 'stop' : 'stops'}
        {ordersLabel ? ` · ${ordersLabel}` : ''}
        {remainingKmLabel ? ` · ${remainingKmLabel}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 3 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  meta: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  pill: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  planLink: {
    minHeight: 28,
    justifyContent: 'center',
  },
  planLinkText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
