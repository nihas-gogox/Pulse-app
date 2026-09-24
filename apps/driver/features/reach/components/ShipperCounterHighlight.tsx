/**
 * Shipper counter highlight — draws the bidder’s eye to a pending counter-offer.
 * Soft gold wash + gentle pulse on the amount (Reanimated).
 * When the bidder’s quote already equals the counter, shows Matched.
 */
import Theme from '@pulse/core/constants/Theme';
import { formatINR } from '@pulse/core/lib/format';
import { Check, Zap } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  counterAmountInr: number;
  /** Bidder’s original quote, when known — shows the delta context. */
  yourQuoteInr?: number | null;
};

export function ShipperCounterHighlight({
  counterAmountInr,
  yourQuoteInr = null,
}: Props) {
  const pulse = useSharedValue(0);

  const yourQuote =
    yourQuoteInr != null &&
    Number.isFinite(yourQuoteInr) &&
    yourQuoteInr > 0
      ? Math.round(yourQuoteInr)
      : null;

  const counterRounded = Math.round(counterAmountInr);
  const isMatched = yourQuote != null && yourQuote === counterRounded;

  useEffect(() => {
    if (isMatched) {
      pulse.value = withTiming(0, { duration: 200 });
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [pulse, isMatched]);

  const amountStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.045 }],
    opacity: 0.88 + pulse.value * 0.12,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: isMatched ? 0.2 : 0.35 + pulse.value * 0.45,
  }));

  return (
    <View
      style={[styles.wrap, isMatched && styles.wrapMatched]}
      accessibilityLabel={
        isMatched
          ? `Matched shipper counter ${formatINR(counterRounded)}.`
          : `Shipper countered ${formatINR(counterRounded)}. Respond to revise your bid.`
      }
    >
      <Animated.View
        style={[styles.glow, isMatched && styles.glowMatched, glowStyle]}
        pointerEvents="none"
      />
      <View style={styles.header}>
        <View style={[styles.badge, isMatched && styles.badgeMatched]}>
          {isMatched ? (
            <Check size={11} color={Theme.textSecondary} strokeWidth={2.6} />
          ) : (
            <Zap
              size={11}
              color={Theme.warning}
              strokeWidth={2.4}
              fill={Theme.accentGoldMuted}
            />
          )}
          <Text style={[styles.badgeText, isMatched && styles.badgeTextMatched]}>
            {isMatched ? 'Matched' : 'Shipper countered'}
          </Text>
        </View>
        <Text style={[styles.reactHint, isMatched && styles.reactHintMatched]}>
          {isMatched ? 'Matched' : 'Respond'}
        </Text>
      </View>

      <View style={styles.amountRow}>
        <Text style={[styles.label, isMatched && styles.labelMatched]}>
          {isMatched ? 'Agreed rate' : 'Their offer'}
        </Text>
        <Animated.Text
          style={[styles.amount, isMatched && styles.amountMatched, amountStyle]}
        >
          {formatINR(counterRounded)}
        </Animated.Text>
      </View>

      {isMatched ? (
        <Text style={[styles.vsLine, styles.vsLineMatched]} numberOfLines={1}>
          Your quote matches the shipper counter
        </Text>
      ) : yourQuote != null ? (
        <Text style={styles.vsLine} numberOfLines={1}>
          Your quote was {formatINR(yourQuote)}
        </Text>
      ) : (
        <Text style={styles.vsLine}>Shipper wants you to revise or accept</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 206, 68, 0.28)',
    backgroundColor: 'rgba(254, 243, 199, 0.38)',
    overflow: 'hidden',
    gap: 6,
  },
  wrapMatched: {
    borderColor: Theme.borderMedium,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 206, 68, 0.08)',
  },
  glowMatched: {
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Theme.cardWhite,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.accentGoldBorder,
  },
  badgeMatched: {
    borderColor: Theme.borderMedium,
    backgroundColor: Theme.surfaceGray,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Theme.warning,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  badgeTextMatched: {
    color: Theme.textSecondary,
  },
  reactHint: {
    fontSize: 10,
    fontWeight: '800',
    color: Theme.accentGoldPressed,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  reactHintMatched: {
    color: Theme.textMuted,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: Theme.accentBrownDeep,
  },
  labelMatched: {
    color: Theme.textSecondary,
  },
  amount: {
    fontSize: 20,
    fontWeight: '800',
    color: Theme.textPrimaryDark,
    letterSpacing: -0.4,
  },
  amountMatched: {
    color: Theme.textPrimaryDark,
  },
  vsLine: {
    fontSize: 11,
    fontWeight: '500',
    color: Theme.accentBrownLight,
    zIndex: 1,
  },
  vsLineMatched: {
    color: Theme.textMuted,
  },
});
