import { StyleSheet, Text, View } from 'react-native';
import Layout from '@pulse/core/constants/Layout';
import { getDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import { Pressable } from 'react-native';

type Colors = ReturnType<typeof getDriverThemeColors>;

type Props = {
  colors: Colors;
  role: 'Pickup' | 'Delivery';
  stopIndex: number;
  stopTotal: number;
  review?: boolean;
  onBack: () => void;
};

export function StopVerificationHeader({ colors, role, stopIndex, stopTotal, review, onBack }: Props) {
  return (
    <View style={[styles.wrap, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={Layout.touchTargetHitSlop}
        style={styles.side}
      >
        <Text style={[styles.backText, { color: colors.emerald }]}>Back</Text>
      </Pressable>
      <View style={styles.center}>
        <Text style={[styles.role, { color: colors.emerald }]}>{role}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
          {review ? 'Details' : 'Verify'} · Stop {stopIndex} of {stopTotal}
        </Text>
      </View>
      <View style={styles.side} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
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
  backText: {
    fontSize: 13,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  role: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  meta: {
    fontSize: 11,
    fontWeight: '500',
  },
});
