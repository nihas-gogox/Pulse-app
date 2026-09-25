import Layout from '@pulse/core/constants/Layout';
import { LoadingIndicator } from '@pulse/ui/components/LoadingIndicator';
import { getDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Colors = ReturnType<typeof getDriverThemeColors>;

type Props = {
  colors: Colors;
  cta: string;
  busy: boolean;
  disabled?: boolean;
  bottomInset?: number;
  onPress: () => void;
};

export function StopVerificationActionBar({
  colors,
  cta,
  busy,
  disabled,
  bottomInset = 16,
  onPress,
}: Props) {
  return (
    <View
      style={[
        styles.bar,
        {
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
          paddingBottom: bottomInset,
        },
      ]}
    >
      <Pressable
        testID="stop-verification-confirm"
        onPress={onPress}
        disabled={busy || disabled}
        accessibilityRole="button"
        accessibilityLabel={cta}
        style={({ pressed }) => [
          styles.cta,
          {
            backgroundColor: colors.emerald,
            opacity: busy || disabled ? 0.55 : pressed ? 0.88 : 1,
          },
        ]}
      >
        {busy ? (
          <LoadingIndicator size="small" color={colors.textOnPrimary} />
        ) : (
          <Text style={[styles.ctaText, { color: colors.textOnPrimary }]}>{cta}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cta: {
    minHeight: Layout.minTouchTargetSize,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
