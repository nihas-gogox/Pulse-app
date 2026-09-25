import { memo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { DESKTOP_BREAKPOINT } from '@pulse/domain/features/auth/signup/signUpConstants';
import { PULSE_SIGNUP } from '@pulse/domain/features/auth/signup/signUpPulseTheme';
import { createPulseSignUpTextStyles } from '@pulse/domain/features/auth/signup/signUpTypography';

export interface SignUpOtpBoxesProps {
  digits: string;
  length: number;
  /** Fixed-width boxes centered as a group (verification step). */
  centered?: boolean;
}

const BOX_SIZE_DESKTOP = 36;
const BOX_SIZE_MOBILE = 42;
const BOX_GAP_DESKTOP = 5;
const BOX_GAP_MOBILE = 6;

export const SignUpOtpBoxes = memo(function SignUpOtpBoxes({
  digits,
  length,
  centered = false,
}: SignUpOtpBoxesProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < DESKTOP_BREAKPOINT;
  const text = createPulseSignUpTextStyles(PULSE_SIGNUP);
  const boxSize = isMobile ? BOX_SIZE_MOBILE : BOX_SIZE_DESKTOP;
  const boxGap = isMobile ? BOX_GAP_MOBILE : BOX_GAP_DESKTOP;
  const chars = digits.padEnd(length, ' ').split('').slice(0, length);

  return (
    <View style={[styles.row, centered && [styles.rowCentered, { gap: boxGap }]]}>
      {chars.map((c, i) => {
        const filled = c.trim() !== '';
        const active = i === digits.length && digits.length < length;
        return (
          <View
            key={i}
            style={[
              styles.box,
              centered && { width: boxSize, maxWidth: boxSize, height: boxSize + 4 },
              !centered && isMobile && styles.boxMobile,
              filled && styles.boxFilled,
              active && styles.boxActive,
            ]}
          >
            <Text
              style={[
                isMobile ? text.otpDigitMobile : text.otpDigit,
                { color: 'transparent' },
                filled && text.otpDigitFilled,
              ]}
            >
              {filled ? c : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 5,
    paddingVertical: 6,
    marginBottom: 6,
    width: '100%',
  },
  rowCentered: {
    alignSelf: 'center',
    justifyContent: 'center',
    width: 'auto',
    maxWidth: '100%',
  },
  box: {
    flex: 1,
    maxWidth: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: PULSE_SIGNUP.border,
    backgroundColor: PULSE_SIGNUP.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxMobile: {
    maxWidth: 44,
    height: 44,
  },
  boxFilled: {
    borderColor: PULSE_SIGNUP.primaryDark,
  },
  boxActive: {
    borderColor: PULSE_SIGNUP.primaryDark,
    opacity: 0.85,
    shadowColor: PULSE_SIGNUP.primaryDark,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
});
