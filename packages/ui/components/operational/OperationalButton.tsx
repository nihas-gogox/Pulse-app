import { memo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  PULSE_PILL_BUTTON_BORDER_WIDTH,
  PULSE_PILL_BUTTON_RADIUS,
  pulsePillButtonContainerDefault,
  pulsePillButtonContainerFullWidth,
  pulsePillButtonPressed,
} from '@pulse/core/constants/PulsePillButtonChrome';
import Theme from '@pulse/core/constants/Theme';
import { colors } from '@pulse/core/design-system/colors';
import { type DensityTier } from '@pulse/core/design-system/density';
import { space, touchTargetMin } from '@pulse/core/design-system/spacing';

/**
 * Operational button intents — not generic “primary/secondary”.
 * Encodes hierarchy, ergonomics, and operational urgency.
 */
export type OperationalButtonIntent =
  | 'primary'
  | 'approval'
  | 'destructiveFinancial'
  | 'utility'
  | 'list'
  | 'bottomSticky';

export interface OperationalButtonProps {
  intent: OperationalButtonIntent;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Full width (default for primary, approval, bottomSticky). */
  fullWidth?: boolean;
  density?: DensityTier;
  icon?: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export const OperationalButton = memo(function OperationalButton({
  intent,
  label,
  onPress,
  disabled = false,
  loading = false,
  fullWidth,
  density: densityTier = 'medium',
  icon,
  accessibilityLabel,
  style,
}: OperationalButtonProps) {
  const isDisabled = disabled || loading || !onPress;
  const config = INTENT_STYLES[intent];
  const padY = densityTier === 'high' ? space[2] : densityTier === 'low' ? space[4] : space[3];
  const padX = intent === 'list' ? space[3] : space[4];
  const shouldFill =
    fullWidth ??
    (intent === 'primary' || intent === 'approval' || intent === 'bottomSticky');

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        intent === 'primary' || intent === 'bottomSticky'
          ? pulsePillButtonContainerDefault
          : null,
        {
          backgroundColor: config.background,
          borderColor: config.border,
          borderWidth: config.borderWidth,
          paddingVertical: padY,
          paddingHorizontal: padX,
          minHeight: intent === 'list' ? 36 : touchTargetMin,
          opacity: isDisabled ? 0.5 : pressed ? 0.92 : 1,
        },
        (intent === 'primary' || intent === 'bottomSticky') &&
          pressed &&
          !isDisabled &&
          pulsePillButtonPressed,
        shouldFill && styles.fullWidth,
        shouldFill && pulsePillButtonContainerFullWidth,
        intent === 'bottomSticky' && styles.bottomSticky,
        style,
      ]}
    >
      <View style={[styles.inner, icon ? styles.innerWithIcon : null]}>
        {loading ? (
          <ActivityIndicator color={config.text} size="small" />
        ) : (
          <>
            {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
            <Text
              style={[
                styles.label,
                { color: config.text, fontSize: config.fontSize },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
});

const INTENT_STYLES: Record<
  OperationalButtonIntent,
  {
    background: string;
    border: string;
    borderWidth: number;
    text: string;
    fontSize: number;
  }
> = {
  primary: {
    background: Theme.buttonPrimary,
    border: Theme.buttonPrimaryBorder,
    borderWidth: PULSE_PILL_BUTTON_BORDER_WIDTH,
    text: Theme.buttonPrimaryText,
    fontSize: 15,
  },
  approval: {
    background: Theme.success,
    border: Theme.success,
    borderWidth: 0,
    text: '#ffffff',
    fontSize: 15,
  },
  destructiveFinancial: {
    background: '#fef2f2',
    border: '#fecaca',
    borderWidth: 1,
    text: colors.cost,
    fontSize: 14,
  },
  utility: {
    background: 'transparent',
    border: colors.borderDefault,
    borderWidth: 1,
    text: colors.textPrimary,
    fontSize: 14,
  },
  list: {
    background: colors.surface,
    border: colors.borderSubtle,
    borderWidth: 1,
    text: colors.textPrimary,
    fontSize: 13,
  },
  bottomSticky: {
    background: Theme.buttonPrimary,
    border: Theme.buttonPrimaryBorder,
    borderWidth: PULSE_PILL_BUTTON_BORDER_WIDTH,
    text: Theme.buttonPrimaryText,
    fontSize: 16,
  },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: PULSE_PILL_BUTTON_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  bottomSticky: {
    borderRadius: PULSE_PILL_BUTTON_RADIUS,
    minHeight: 48,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerWithIcon: {
    gap: space[2],
  },
  iconSlot: {
    marginRight: 2,
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
