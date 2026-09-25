import { memo } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  PULSE_PILL_BUTTON_BORDER_WIDTH,
  PULSE_PILL_BUTTON_RADIUS,
  pulsePillButtonContainerDefault,
  pulsePillButtonContainerFullWidth,
  pulsePillButtonDisabled,
  pulsePillButtonLabelLarge,
  pulsePillButtonPressed,
} from '@pulse/core/constants/PulsePillButtonChrome';
import Theme from '@pulse/core/constants/Theme';
import { DESKTOP_BREAKPOINT } from '@pulse/domain/features/auth/signup/signUpConstants';
import { PULSE_SIGNUP, type SignUpTheme } from '@pulse/domain/features/auth/signup/signUpPulseTheme';

export interface SignUpPulsePrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'solid' | 'ready';
  style?: StyleProp<ViewStyle>;
  theme?: SignUpTheme;
  testID?: string;
}

export const SignUpPulsePrimaryButton = memo(function SignUpPulsePrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'solid',
  style,
  theme = PULSE_SIGNUP,
  testID,
}: SignUpPulsePrimaryButtonProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < DESKTOP_BREAKPOINT;
  const inactive = disabled || loading;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.btn,
        isMobile && styles.btnMobile,
        pulsePillButtonContainerDefault,
        pulsePillButtonContainerFullWidth,
        inactive
          ? { backgroundColor: theme.disabledBg, borderColor: theme.disabledText }
          : variant === 'ready'
            ? {
                backgroundColor: theme.primaryLight,
                borderColor: theme.primaryDark,
              }
            : {
                backgroundColor: theme.primary,
                borderColor: theme.primaryDark,
              },
        pressed && !inactive && pulsePillButtonPressed,
        inactive && pulsePillButtonDisabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={theme.primaryButtonText ?? Theme.buttonPrimaryText} size="small" />
      ) : (
        <Text
          style={[
            pulsePillButtonLabelLarge,
            isMobile && styles.labelMobile,
            !inactive && theme.primaryButtonText
              ? { color: theme.primaryButtonText }
              : null,
            inactive && { color: theme.disabledText },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: PULSE_PILL_BUTTON_RADIUS,
    borderWidth: PULSE_PILL_BUTTON_BORDER_WIDTH,
    minHeight: 40,
    maxWidth: '100%',
    ...Platform.select({
      web: { boxSizing: 'border-box' } as object,
    }),
  },
  btnMobile: {
    minHeight: 48,
    paddingVertical: 12,
  },
  labelMobile: {
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
